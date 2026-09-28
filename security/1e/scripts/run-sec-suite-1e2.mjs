#!/usr/bin/env node
/**
 * Security 1E.2 — hardening de diet_requests (pool / visibilidade / claim).
 *
 * PHASE=before | a | b
 *   before → estado f20ebab (SEC-001…004 devem estar vulneráveis)
 *   a      → após migration de visibilidade (1E.2A)
 *   b      → após migration de claim (1E.2B) + concorrência + realtime
 *
 * - Supabase LOCAL apenas (assertLocal)
 * - Service role LOCAL somente para prepare/teardown (canal privilegiado do harness)
 * - Toda ação sob teste usa JWT de usuário normal (ou anon)
 * - Não altera evidências/harnesses anteriores
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const MARKER = "SECURITY_1E2_FIXTURE";
const POOL_STATUSES = ["pending", "in_review", "processing", "awaiting_validation"];

function requireEnv(name) {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing env ${name}`);
  return v.trim();
}

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host) && !host.endsWith(".local")) {
    throw new Error(`Refusing non-local SUPABASE_URL host=${host}`);
  }
}

function summarizeError(error) {
  if (!error) return null;
  return {
    message: error.message || String(error),
    code: error.code || null,
    details: error.details || null,
    hint: error.hint || null,
  };
}

function is42P17(error) {
  return !!(error && (error.code === "42P17" || /infinite recursion/i.test(error.message || "")));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const phase = (process.env.PHASE || "").trim();
  if (!["before", "a", "b"].includes(phase)) throw new Error("PHASE must be before|a|b");

  const url = requireEnv("SUPABASE_URL");
  assertLocal(url);
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const fixturesPath =
    process.env.FIXTURE_RUNTIME_IN?.trim() ||
    resolve(homedir(), "nutriaprova-security-1c-local/runtime/fixtures.json");
  const defaultOut = {
    before: "security/1e/evidence/results-1e2-before.json",
    a: "security/1e/evidence/results-1e2a.json",
    b: "security/1e/evidence/results-1e2b.json",
  }[phase];
  const outPath = resolve(process.env.SEC_EVIDENCE_OUT?.trim() || defaultOut);

  const fx = JSON.parse(await readFile(fixturesPath, "utf8"));
  const password = fx.password;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const U = {
    C1: fx.users.C1,
    C2: fx.users.C2,
    N1: fx.users.N1,
    N2: fx.users.N2,
    P1: fx.users.P1,
    A1: fx.users.A1,
    N0: { key: "N0", email: "n0-1e2@local.test", role: "nutritionist", userId: null },
  };

  // ── Snapshot inicial (para teardown determinístico) ─────────────────────
  const trackedProfiles = ["C1", "C2", "N1", "N2", "P1", "A1"];
  const initialProfiles = {};
  for (const k of trackedProfiles) {
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, role, approved, credits, plan_tier, deleted_at")
      .eq("user_id", U[k].userId)
      .single();
    if (error) throw new Error(`snapshot ${k}: ${error.message}`);
    initialProfiles[k] = data;
  }

  // ── Setup: N0 (nutritionist approved=false) ──────────────────────────────
  {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => u.email === U.N0.email);
    if (existing) {
      await admin.auth.admin.deleteUser(existing.id);
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email: U.N0.email,
      password,
      email_confirm: true,
      user_metadata: { role: "nutritionist", full_name: "Fixture Nutri N0", crn_number: "CRN-3 00000" },
    });
    if (error) throw new Error(`create N0: ${error.message}`);
    U.N0.userId = created.user.id;
    for (let i = 0; i < 20; i++) {
      const { data: p } = await admin.from("profiles").select("user_id").eq("user_id", U.N0.userId).maybeSingle();
      if (p) break;
      await sleep(100);
    }
  }

  const PROFILE_BASELINE = {
    N0: { role: "nutritionist", approved: false, credits: 5, plan_tier: "basic", deleted_at: null },
    N1: { role: "nutritionist", approved: true, credits: 5, plan_tier: "basic", deleted_at: null },
    N2: { role: "nutritionist", approved: true, credits: 5, plan_tier: "basic", deleted_at: null },
    C1: { role: "client", approved: false, credits: 0, plan_tier: "basic", deleted_at: null },
    C2: { role: "client", approved: false, credits: 0, plan_tier: "basic", deleted_at: null },
    P1: { role: "personal_trainer", approved: false, credits: 0, plan_tier: "basic", deleted_at: null },
    A1: { role: "admin", approved: true, credits: 0, plan_tier: "basic", deleted_at: null },
  };

  async function resetProfile(k, overrides = {}) {
    const { error } = await admin
      .from("profiles")
      .update({ ...PROFILE_BASELINE[k], ...overrides })
      .eq("user_id", U[k].userId);
    if (error) throw new Error(`resetProfile ${k}: ${error.message}`);
  }

  async function getProfile(k) {
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, role, approved, credits, plan_tier")
      .eq("user_id", U[k].userId)
      .single();
    if (error) throw new Error(`getProfile ${k}: ${error.message}`);
    return data;
  }

  // ── Setup: requests R1…R7 ───────────────────────────────────────────────
  const REQ_BASELINE = {
    R1: { status: "pending", nutritionist_id: null, assigned_nutritionist_id: null },
    R2: { status: "pending", nutritionist_id: null, assigned_nutritionist_id: () => U.N1.userId },
    R3: { status: "in_review", nutritionist_id: null, assigned_nutritionist_id: null },
    R4: { status: "processing", nutritionist_id: null, assigned_nutritionist_id: null },
    R5: { status: "awaiting_validation", nutritionist_id: null, assigned_nutritionist_id: null },
    R6: { status: "in_review", nutritionist_id: () => U.N2.userId, assigned_nutritionist_id: null },
    R7: { status: "completed", nutritionist_id: null, assigned_nutritionist_id: null },
  };
  const R = {};

  function baselineRow(key) {
    const b = REQ_BASELINE[key];
    const val = (v) => (typeof v === "function" ? v() : v);
    return {
      client_id: U.C2.userId,
      status: b.status,
      nutritionist_id: val(b.nutritionist_id),
      assigned_nutritionist_id: val(b.assigned_nutritionist_id),
      notes: `${MARKER}:${key}`,
      ai_draft: null,
      client_data: { fullName: `Fixture ${key}`, notes: `${MARKER} — synthetic, not real patient data` },
    };
  }

  // limpeza de execuções anteriores abortadas
  await admin.from("diet_requests").delete().like("notes", `${MARKER}%`);

  for (const key of Object.keys(REQ_BASELINE)) {
    const { data, error } = await admin.from("diet_requests").insert(baselineRow(key)).select("id").single();
    if (error) throw new Error(`insert ${key}: ${error.message}`);
    R[key] = data.id;
  }

  async function resetRequest(key) {
    const { error } = await admin.from("diet_requests").update(baselineRow(key)).eq("id", R[key]);
    if (error) throw new Error(`resetRequest ${key}: ${error.message}`);
  }

  async function resetAllRequests() {
    for (const key of Object.keys(REQ_BASELINE)) await resetRequest(key);
  }

  async function getRequest(key) {
    const { data, error } = await admin
      .from("diet_requests")
      .select("id, client_id, status, nutritionist_id, assigned_nutritionist_id, notes")
      .eq("id", R[key])
      .single();
    if (error) throw new Error(`getRequest ${key}: ${error.message}`);
    return data;
  }

  function reqIsBaseline(key, row) {
    const b = baselineRow(key);
    return (
      row.status === b.status &&
      row.nutritionist_id === b.nutritionist_id &&
      row.assigned_nutritionist_id === b.assigned_nutritionist_id &&
      row.client_id === b.client_id &&
      row.notes === b.notes
    );
  }

  async function deleteRequestTxs() {
    for (const id of Object.values(R)) {
      await admin.from("transactions").delete().like("description", `%#${id.slice(0, 8)}%`);
    }
  }

  async function countJobTxs(key) {
    const { data } = await admin
      .from("transactions")
      .select("amount, type, user_id")
      .like("description", `%#${R[key].slice(0, 8)}%`);
    return data ?? [];
  }

  async function resetWorld() {
    for (const k of Object.keys(PROFILE_BASELINE)) await resetProfile(k);
    await resetAllRequests();
    await deleteRequestTxs();
  }

  // ── Sessões ──────────────────────────────────────────────────────────────
  const sessions = {};
  async function session(k) {
    if (sessions[k]) return sessions[k];
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: U[k].email, password });
    if (error) throw new Error(`login ${k}: ${error.message}`);
    sessions[k] = client;
    return client;
  }
  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Registro ─────────────────────────────────────────────────────────────
  const results = [];
  let recursionSeen = false;

  async function identityMeta(k) {
    if (k === "anon") return { identity: "anon", role: null, approved: null };
    const p = await getProfile(k);
    return { identity: k, role: p.role, approved: p.approved };
  }

  function requestMeta(key, row) {
    if (!key) return {};
    return {
      request: key,
      requestId: R[key],
      status: row?.status ?? null,
      assigned_nutritionist_id: row?.assigned_nutritionist_id ?? null,
      nutritionist_id: row?.nutritionist_id ?? null,
    };
  }

  function record(entry) {
    for (const e of entry.errors ?? []) if (is42P17(e)) recursionSeen = true;
    delete entry.errors;
    results.push(entry);
    const mark = entry.pass === null ? "INFO" : entry.pass ? "PASS" : "FAIL";
    console.log(`${mark}\t${entry.id}\t${entry.identity}\t${entry.operation}\t${entry.result ?? ""}`);
  }

  // ── Helpers de teste ─────────────────────────────────────────────────────
  async function selectTest({ id, actor, reqKey, expectVisible, secId }) {
    await resetWorld();
    const meta = await identityMeta(actor);
    const before = await getRequest(reqKey);
    const client = actor === "anon" ? anonClient : await session(actor);
    const { data, error } = await client
      .from("diet_requests")
      .select("id, client_id, status, client_data, nutritionist_id, assigned_nutritionist_id")
      .eq("id", R[reqKey]);
    const rows = data?.length ?? 0;
    const visible = !error && rows > 0;
    const after = await getRequest(reqKey);
    record({
      id,
      secId: secId ?? null,
      ...meta,
      ...requestMeta(reqKey, before),
      operation: `SELECT diet_requests ${reqKey}`,
      rows,
      httpOrSql: { error: summarizeError(error) },
      expectation: expectVisible ? "visível" : "0 rows",
      result: visible ? "VISÍVEL" : "0 rows",
      pass: phase === "before" ? null : visible === expectVisible,
      vulnerableObserved: secId ? visible : undefined,
      teardown: reqIsBaseline(reqKey, after) ? "OK" : "DIVERGENTE",
      errors: [error],
    });
    return visible;
  }

  async function directClaimAttack({ id, actor, reqKey, secId }) {
    await resetWorld();
    const meta = await identityMeta(actor);
    const before = await getRequest(reqKey);
    const client = await session(actor);
    const { error } = await client
      .from("diet_requests")
      .update({
        nutritionist_id: U[actor].userId,
        status: "in_review",
        notes: `${MARKER}:${id}_DIRECT_CLAIM`,
      })
      .eq("id", R[reqKey]);
    const after = await getRequest(reqKey);
    const claimed = after.nutritionist_id === U[actor].userId;
    await resetRequest(reqKey);
    const post = await getRequest(reqKey);
    record({
      id,
      secId: secId ?? null,
      ...meta,
      ...requestMeta(reqKey, before),
      operation: `direct UPDATE ${reqKey} nutritionist_id=${actor} status=in_review`,
      rows: claimed ? 1 : 0,
      httpOrSql: { error: summarizeError(error), afterAttack: after },
      expectation: "BLOQUEADO",
      result: claimed ? "CLAIM EFETIVADO" : "BLOQUEADO",
      pass: phase === "before" && secId ? null : !claimed,
      vulnerableObserved: secId ? claimed : undefined,
      teardown: reqIsBaseline(reqKey, post) ? "OK" : "DIVERGENTE",
      errors: [error],
    });
    return claimed;
  }

  async function profileGuard({ id, column, value }) {
    await resetWorld();
    const meta = await identityMeta("C1");
    const before = await getProfile("C1");
    const client = await session("C1");
    const { error } = await client.from("profiles").update({ [column]: value }).eq("user_id", U.C1.userId);
    const after = await getProfile("C1");
    const changed = after[column] !== before[column];
    await resetProfile("C1");
    record({
      id,
      secId: id,
      ...meta,
      operation: `C1 UPDATE profiles.${column} → ${value}`,
      rows: changed ? 1 : 0,
      httpOrSql: { error: summarizeError(error) },
      expectation: "BLOQUEADO (regression guard 1E.1)",
      result: changed ? "ALTERADO" : "BLOQUEADO",
      pass: !changed,
      vulnerableObserved: changed,
      teardown: "OK",
      errors: [error],
    });
  }

  async function rpcClaim(actor, key) {
    const client = await session(actor);
    const { data, error } = await client.rpc("claim_diet_request", { p_request_id: R[key] });
    return { data, error };
  }

  // =========================================================================
  // SEC-001…004 (matriz alvo) + SEC-005…007 (regression guards)
  // =========================================================================
  await selectTest({ id: "SEC-001", secId: "SEC-001", actor: "C1", reqKey: "R1", expectVisible: false });
  await selectTest({ id: "SEC-002", secId: "SEC-002", actor: "P1", reqKey: "R1", expectVisible: false });
  await directClaimAttack({ id: "SEC-003", secId: "SEC-003", actor: "C1", reqKey: "R1" });
  await directClaimAttack({ id: "SEC-004", secId: "SEC-004", actor: "P1", reqKey: "R1" });
  await profileGuard({ id: "SEC-005", column: "role", value: "admin" });
  await profileGuard({ id: "SEC-006", column: "credits", value: 9999 });
  await profileGuard({ id: "SEC-007", column: "plan_tier", value: "premium" });

  // =========================================================================
  // 1E.2A — visibilidade (executado em before como snapshot informativo)
  // =========================================================================
  const aCases = [
    { id: "A-01", actor: "N0", reqKey: "R1", expectVisible: false },
    { id: "A-02", actor: "N1", reqKey: "R1", expectVisible: true },
    { id: "A-03", actor: "N1", reqKey: "R2", expectVisible: true },
    { id: "A-04", actor: "N2", reqKey: "R2", expectVisible: false },
    { id: "A-05", actor: "N1", reqKey: "R3", expectVisible: true },
    { id: "A-06", actor: "N1", reqKey: "R4", expectVisible: true },
    { id: "A-07", actor: "N1", reqKey: "R5", expectVisible: true },
    { id: "A-08", actor: "N1", reqKey: "R6", expectVisible: false },
    { id: "A-09", actor: "N2", reqKey: "R6", expectVisible: true },
    { id: "A-12", actor: "anon", reqKey: "R1", expectVisible: false },
    { id: "A-13", actor: "N1", reqKey: "R7", expectVisible: false },
  ];
  for (const c of aCases) await selectTest(c);

  // A-10 C2 vê próprias
  {
    await resetWorld();
    const meta = await identityMeta("C2");
    const client = await session("C2");
    const { data, error } = await client
      .from("diet_requests")
      .select("id")
      .in("id", Object.values(R));
    const rows = data?.length ?? 0;
    const pass = !error && rows === Object.keys(R).length;
    record({
      id: "A-10",
      ...meta,
      operation: "C2 SELECT requests próprias (R1…R7)",
      rows,
      httpOrSql: { error: summarizeError(error) },
      expectation: `${Object.keys(R).length} rows`,
      result: `${rows} rows`,
      pass: phase === "before" ? null : pass,
      teardown: "OK",
      errors: [error],
    });
  }

  // A-11 A1 global
  {
    await resetWorld();
    const meta = await identityMeta("A1");
    const client = await session("A1");
    const { data, error } = await client
      .from("diet_requests")
      .select("id")
      .in("id", Object.values(R));
    const rows = data?.length ?? 0;
    const pass = !error && rows === Object.keys(R).length;
    record({
      id: "A-11",
      ...meta,
      operation: "A1 SELECT global (R1…R7)",
      rows,
      httpOrSql: { error: summarizeError(error) },
      expectation: `${Object.keys(R).length} rows`,
      result: `${rows} rows`,
      pass: phase === "before" ? null : pass,
      teardown: "OK",
      errors: [error],
    });
  }

  // A-14 N1 lista pool agregado (sanity do dashboard: fetchRequests sem filtro)
  {
    await resetWorld();
    const meta = await identityMeta("N1");
    const client = await session("N1");
    const { data, error } = await client
      .from("diet_requests")
      .select("id, status, nutritionist_id, assigned_nutritionist_id")
      .in("id", Object.values(R));
    const seen = new Set((data ?? []).map((r) => r.id));
    const expected = ["R1", "R2", "R3", "R4", "R5"];
    const forbidden = ["R6", "R7"];
    const pass =
      !error && expected.every((k) => seen.has(R[k])) && forbidden.every((k) => !seen.has(R[k]));
    record({
      id: "A-14",
      ...meta,
      operation: "N1 SELECT agregado (equivalente a fetchRequests do dashboard)",
      rows: data?.length ?? 0,
      httpOrSql: { error: summarizeError(error) },
      expectation: "R1–R5 visíveis; R6/R7 ocultos",
      result: Object.keys(R).filter((k) => seen.has(R[k])).join(","),
      pass: phase === "before" ? null : pass,
      teardown: "OK",
      errors: [error],
    });
  }

  // =========================================================================
  // 1E.2B — claim / update
  // =========================================================================
  if (phase === "b") {
    // B-SEC-003 / B-SEC-004 são SEC-003 / SEC-004 acima (mesmo ataque)

    // B-01…B-03: identidades não autorizadas chamando a RPC
    for (const [id, actor] of [
      ["B-01", "C1"],
      ["B-02", "P1"],
      ["B-03", "N0"],
    ]) {
      await resetWorld();
      const meta = await identityMeta(actor);
      const before = await getRequest("R1");
      const creditsBefore = actor === "N0" ? (await getProfile("N0")).credits : null;
      const { data, error } = await rpcClaim(actor, "R1");
      const after = await getRequest("R1");
      const unchanged = reqIsBaseline("R1", after);
      const denied = unchanged && (error || (data && data.status !== "claimed"));
      const creditsAfter = actor === "N0" ? (await getProfile("N0")).credits : null;
      record({
        id,
        ...meta,
        ...requestMeta("R1", before),
        operation: "rpc claim_diet_request(R1)",
        rows: unchanged ? 0 : 1,
        httpOrSql: { error: summarizeError(error), data },
        expectation: "NEGADO",
        result: denied ? `NEGADO (${data?.status ?? error?.code})` : "CLAIM EFETIVADO",
        pass: !!denied && creditsBefore === creditsAfter,
        teardown: "OK",
        errors: [error],
      });
    }

    // B-04 / B-05 / B-06 / B-07: N1 claim R1 pending (com débito atômico)
    {
      await resetWorld();
      const meta = await identityMeta("N1");
      const before = await getRequest("R1");
      const credBefore = (await getProfile("N1")).credits;
      const { data, error } = await rpcClaim("N1", "R1");
      const after = await getRequest("R1");
      const credAfter = (await getProfile("N1")).credits;
      const txs = await countJobTxs("R1");
      const pass04 = !error && data?.status === "claimed";
      record({
        id: "B-04",
        ...meta,
        ...requestMeta("R1", before),
        operation: "N1 rpc claim_diet_request(R1 pending)",
        rows: 1,
        httpOrSql: { error: summarizeError(error), data },
        expectation: "SUCESSO",
        result: data?.status ?? error?.message,
        pass: pass04,
        teardown: "deferred",
        errors: [error],
      });
      const pass05 =
        after.nutritionist_id === U.N1.userId &&
        after.status === "in_review" &&
        credAfter === credBefore - 1 &&
        txs.length === 1 &&
        txs[0].amount === -1 &&
        txs[0].user_id === U.N1.userId;
      record({
        id: "B-05",
        ...meta,
        ...requestMeta("R1", after),
        operation: "estado final R1 após claim",
        rows: 1,
        httpOrSql: { credits: { before: credBefore, after: credAfter }, jobTransactions: txs },
        expectation: "nutritionist_id=N1, status=in_review, débito único de 1 crédito (consume_job_credit)",
        result: `status=${after.status} owner=${after.nutritionist_id === U.N1.userId ? "N1" : after.nutritionist_id} credits ${credBefore}→${credAfter} txs=${txs.length}`,
        pass: pass05,
        teardown: "deferred",
      });

      const { data: d6, error: e6 } = await rpcClaim("N1", "R1");
      const cred6 = (await getProfile("N1")).credits;
      const txs6 = await countJobTxs("R1");
      record({
        id: "B-06",
        ...meta,
        ...requestMeta("R1", await getRequest("R1")),
        operation: "N1 repete claim R1",
        rows: 0,
        httpOrSql: { error: summarizeError(e6), data: d6 },
        expectation: "idempotente (already_owned), sem novo débito",
        result: `${d6?.status} credits=${cred6} txs=${txs6.length}`,
        pass: !e6 && d6?.status === "already_owned" && cred6 === credAfter && txs6.length === 1,
        teardown: "deferred",
        errors: [e6],
      });

      const metaN2 = await identityMeta("N2");
      const credN2Before = (await getProfile("N2")).credits;
      const { data: d7, error: e7 } = await rpcClaim("N2", "R1");
      const after7 = await getRequest("R1");
      const credN2After = (await getProfile("N2")).credits;
      record({
        id: "B-07",
        ...metaN2,
        ...requestMeta("R1", after7),
        operation: "N2 tenta claim de R1 (já de N1)",
        rows: 0,
        httpOrSql: { error: summarizeError(e7), data: d7 },
        expectation: "NEGADO/CONFLICT",
        result: d7?.status ?? e7?.message,
        pass:
          after7.nutritionist_id === U.N1.userId &&
          (e7 || d7?.status !== "claimed") &&
          credN2After === credN2Before,
        teardown: "OK",
        errors: [e7],
      });
    }

    // B-08 / B-09: lead exclusivo R2 (assigned=N1)
    {
      await resetWorld();
      const metaN2 = await identityMeta("N2");
      const { data: d9, error: e9 } = await rpcClaim("N2", "R2");
      const after9 = await getRequest("R2");
      record({
        id: "B-09",
        ...metaN2,
        ...requestMeta("R2", after9),
        operation: "N2 claim R2 (assigned=N1)",
        rows: 0,
        httpOrSql: { error: summarizeError(e9), data: d9 },
        expectation: "NEGADO",
        result: d9?.status ?? e9?.message,
        pass: reqIsBaseline("R2", after9) && (e9 || d9?.status !== "claimed"),
        teardown: "OK",
        errors: [e9],
      });

      const metaN1 = await identityMeta("N1");
      const { data: d8, error: e8 } = await rpcClaim("N1", "R2");
      const after8 = await getRequest("R2");
      record({
        id: "B-08",
        ...metaN1,
        ...requestMeta("R2", after8),
        operation: "N1 claim R2 (assigned=N1)",
        rows: 1,
        httpOrSql: { error: summarizeError(e8), data: d8 },
        expectation: "SUCESSO",
        result: d8?.status ?? e8?.message,
        pass:
          !e8 && d8?.status === "claimed" && after8.nutritionist_id === U.N1.userId && after8.status === "in_review",
        teardown: "OK",
        errors: [e8],
      });
    }

    // B-10: N1 aprovado tenta claim por UPDATE direto (pending e in_review)
    for (const [id, key] of [
      ["B-10", "R1"],
      ["B-10b", "R3"],
    ]) {
      await resetWorld();
      const meta = await identityMeta("N1");
      const before = await getRequest(key);
      const client = await session("N1");
      const { error } = await client
        .from("diet_requests")
        .update({ nutritionist_id: U.N1.userId })
        .eq("id", R[key]);
      const after = await getRequest(key);
      record({
        id,
        ...meta,
        ...requestMeta(key, before),
        operation: `N1 direct UPDATE ${key} (unclaimed) nutritionist_id=N1`,
        rows: after.nutritionist_id === U.N1.userId ? 1 : 0,
        httpOrSql: { error: summarizeError(error) },
        expectation: "BLOQUEADO (RPC é o único caminho de claim)",
        result: after.nutritionist_id === U.N1.userId ? "CLAIM EFETIVADO" : "BLOQUEADO",
        pass: reqIsBaseline(key, after),
        teardown: "OK",
        errors: [error],
      });
    }

    // B-11…B-13: owner N1 com R3 assumida (claim in_review sem custo)
    {
      await resetWorld();
      const meta = await identityMeta("N1");
      const credBefore = (await getProfile("N1")).credits;
      const { data: dc, error: ec } = await rpcClaim("N1", "R3");
      const claimed = await getRequest("R3");
      const credAfter = (await getProfile("N1")).credits;
      record({
        id: "B-11a",
        ...meta,
        ...requestMeta("R3", claimed),
        operation: "N1 claim R3 (in_review unclaimed)",
        rows: 1,
        httpOrSql: { error: summarizeError(ec), data: dc },
        expectation: "claimed, status in_review preservado, sem débito",
        result: `${dc?.status} status=${claimed.status} credits ${credBefore}→${credAfter}`,
        pass:
          !ec &&
          dc?.status === "claimed" &&
          claimed.nutritionist_id === U.N1.userId &&
          claimed.status === "in_review" &&
          credAfter === credBefore,
        teardown: "deferred",
        errors: [ec],
      });

      const client = await session("N1");
      const { error: e11 } = await client
        .from("diet_requests")
        .update({ notes: `${MARKER}:R3`, ai_draft: { draft: "B-11 synthetic" } })
        .eq("id", R["R3"]);
      const { data: r11 } = await admin.from("diet_requests").select("ai_draft").eq("id", R["R3"]).single();
      record({
        id: "B-11",
        ...meta,
        ...requestMeta("R3", await getRequest("R3")),
        operation: "N1 UPDATE legítimo (ai_draft/notes) de request própria",
        rows: r11?.ai_draft?.draft === "B-11 synthetic" ? 1 : 0,
        httpOrSql: { error: summarizeError(e11) },
        expectation: "OK",
        result: r11?.ai_draft?.draft === "B-11 synthetic" ? "OK" : "FALHOU",
        pass: !e11 && r11?.ai_draft?.draft === "B-11 synthetic",
        teardown: "deferred",
        errors: [e11],
      });

      for (const [id, target, label] of [
        ["B-12", U.N2.userId, "N2"],
        ["B-13", null, "NULL"],
      ]) {
        const { error } = await client
          .from("diet_requests")
          .update({ nutritionist_id: target })
          .eq("id", R["R3"]);
        const after = await getRequest("R3");
        record({
          id,
          ...meta,
          ...requestMeta("R3", after),
          operation: `N1 UPDATE request própria nutritionist_id → ${label}`,
          rows: after.nutritionist_id === U.N1.userId ? 0 : 1,
          httpOrSql: { error: summarizeError(error) },
          expectation: "BLOQUEADO",
          result: after.nutritionist_id === U.N1.userId ? "BLOQUEADO" : "ALTERADO",
          pass: after.nutritionist_id === U.N1.userId,
          teardown: "deferred",
          errors: [error],
        });
      }

      // B-11b: validação final (status completed) em request própria
      const { error: eAp } = await client
        .from("diet_requests")
        .update({ status: "completed" })
        .eq("id", R["R3"])
        .eq("nutritionist_id", U.N1.userId);
      const ap = await getRequest("R3");
      record({
        id: "B-11b",
        ...meta,
        ...requestMeta("R3", ap),
        operation: "N1 valida request própria (status → completed)",
        rows: ap.status === "completed" ? 1 : 0,
        httpOrSql: { error: summarizeError(eAp) },
        expectation: "OK",
        result: ap.status,
        pass: !eAp && ap.status === "completed" && ap.nutritionist_id === U.N1.userId,
        teardown: "deferred",
        errors: [eAp],
      });

      // B-11c: owner continua vendo completed próprio
      const { data: own } = await client.from("diet_requests").select("id").eq("id", R["R3"]);
      record({
        id: "B-11c",
        ...meta,
        ...requestMeta("R3", ap),
        operation: "N1 SELECT completed próprio",
        rows: own?.length ?? 0,
        expectation: "visível",
        result: (own?.length ?? 0) > 0 ? "VISÍVEL" : "0 rows",
        pass: (own?.length ?? 0) === 1,
        teardown: "OK",
      });
    }

    // B-14: N1 tenta UPDATE de request de N2
    {
      await resetWorld();
      const meta = await identityMeta("N1");
      const client = await session("N1");
      const { error } = await client
        .from("diet_requests")
        .update({ notes: "B-14 hijack", nutritionist_id: U.N1.userId })
        .eq("id", R["R6"]);
      const after = await getRequest("R6");
      record({
        id: "B-14",
        ...meta,
        ...requestMeta("R6", after),
        operation: "N1 UPDATE R6 (de N2)",
        rows: reqIsBaseline("R6", after) ? 0 : 1,
        httpOrSql: { error: summarizeError(error) },
        expectation: "BLOQUEADO",
        result: reqIsBaseline("R6", after) ? "BLOQUEADO" : "ALTERADO",
        pass: reqIsBaseline("R6", after),
        teardown: "OK",
        errors: [error],
      });
    }

    // B-15: concorrência N1 × N2 (várias rodadas)
    {
      const rounds = [];
      let allOk = true;
      for (let i = 0; i < 5; i++) {
        await resetWorld();
        const [c1, c2] = await Promise.all([session("N1"), session("N2")]);
        const [r1, r2] = await Promise.all([
          c1.rpc("claim_diet_request", { p_request_id: R["R1"] }),
          c2.rpc("claim_diet_request", { p_request_id: R["R1"] }),
        ]);
        const after = await getRequest("R1");
        const txs = await countJobTxs("R1");
        const winners = [r1, r2].filter((r) => r.data?.status === "claimed").length;
        const losersSafe = [r1, r2].filter(
          (r) => r.data?.status === "already_claimed" || (r.error && !is42P17(r.error)),
        ).length;
        const owner =
          after.nutritionist_id === U.N1.userId ? "N1" : after.nutritionist_id === U.N2.userId ? "N2" : after.nutritionist_id;
        const ok = winners === 1 && losersSafe === 1 && (owner === "N1" || owner === "N2") && txs.length === 1;
        if (!ok) allOk = false;
        rounds.push({
          round: i + 1,
          N1: r1.data?.status ?? r1.error?.message,
          N2: r2.data?.status ?? r2.error?.message,
          owner,
          jobTransactions: txs.length,
          ok,
        });
        for (const r of [r1, r2]) if (is42P17(r.error)) recursionSeen = true;
      }
      record({
        id: "B-15",
        identity: "N1×N2",
        role: "nutritionist",
        approved: true,
        request: "R1",
        requestId: R["R1"],
        status: "pending",
        assigned_nutritionist_id: null,
        nutritionist_id: null,
        operation: "claim concorrente N1 × N2 em R1 (5 rodadas)",
        rows: rounds.length,
        httpOrSql: { rounds },
        expectation: "exatamente 1 vencedor e 1 débito por rodada",
        result: allOk ? "1 vencedor em todas as rodadas" : "FALHA",
        pass: allOk,
        teardown: "OK",
      });
    }

    // B-16: admin legítimo
    {
      await resetWorld();
      const meta = await identityMeta("A1");
      const client = await session("A1");
      const { data: sel, error: es } = await client.from("diet_requests").select("id").in("id", Object.values(R));
      const { error: eu } = await client
        .from("diet_requests")
        .update({ notes: `${MARKER}:R6:ADMIN_EDIT` })
        .eq("id", R["R6"]);
      const after = await getRequest("R6");
      const { data: dClaim } = await client.rpc("claim_diet_request", { p_request_id: R["R1"] });
      const r1After = await getRequest("R1");
      record({
        id: "B-16",
        ...meta,
        ...requestMeta("R6", after),
        operation: "A1 SELECT global + UPDATE administrativo (R6.notes); A1 claim via RPC",
        rows: sel?.length ?? 0,
        httpOrSql: { selectError: summarizeError(es), updateError: summarizeError(eu), adminClaimRpc: dClaim },
        expectation: "admin lê tudo e atualiza; RPC de claim exige nutritionist aprovado",
        result: `select=${sel?.length} updated=${after.notes.endsWith("ADMIN_EDIT")} claimRpc=${dClaim?.status}`,
        pass:
          !es &&
          (sel?.length ?? 0) === Object.keys(R).length &&
          !eu &&
          after.notes.endsWith("ADMIN_EDIT") &&
          reqIsBaseline("R1", r1After),
        teardown: "OK",
        errors: [es, eu],
      });
    }

    // B-18: saldo insuficiente → claim de pending revertido atomicamente
    {
      await resetWorld();
      await resetProfile("N1", { credits: 0 });
      const meta = await identityMeta("N1");
      const { data, error } = await rpcClaim("N1", "R1");
      const after = await getRequest("R1");
      const cred = (await getProfile("N1")).credits;
      const txs = await countJobTxs("R1");
      record({
        id: "B-18",
        ...meta,
        ...requestMeta("R1", after),
        operation: "N1 (credits=0, basic) claim R1 pending",
        rows: 0,
        httpOrSql: { error: summarizeError(error), data },
        expectation: "insufficient_credits; R1 intacto; credits 0; sem transaction",
        result: `${data?.status ?? error?.message} credits=${cred} txs=${txs.length}`,
        pass: data?.status === "insufficient_credits" && reqIsBaseline("R1", after) && cred === 0 && txs.length === 0,
        teardown: "OK",
        errors: [error],
      });
    }

    // B-19: clinic → custo 0 preservado no claim de pending
    {
      await resetWorld();
      await resetProfile("N1", { plan_tier: "clinic", credits: 2 });
      const meta = await identityMeta("N1");
      const { data, error } = await rpcClaim("N1", "R1");
      const after = await getRequest("R1");
      const cred = (await getProfile("N1")).credits;
      const txs = await countJobTxs("R1");
      record({
        id: "B-19",
        ...meta,
        ...requestMeta("R1", after),
        operation: "N1 clinic claim R1 pending",
        rows: 1,
        httpOrSql: { error: summarizeError(error), data },
        expectation: "claimed; credits inalterados; 1 transaction amount=0",
        result: `${data?.status} credits=${cred} txs=${JSON.stringify(txs.map((t) => t.amount))}`,
        pass:
          data?.status === "claimed" &&
          after.nutritionist_id === U.N1.userId &&
          cred === 2 &&
          txs.length === 1 &&
          txs[0].amount === 0,
        teardown: "OK",
        errors: [error],
      });
    }

    // B-20: processing / awaiting_validation preservam status; completed não é elegível
    for (const [id, key, expectClaim] of [
      ["B-20a", "R4", true],
      ["B-20b", "R5", true],
      ["B-20c", "R7", false],
    ]) {
      await resetWorld();
      const meta = await identityMeta("N1");
      const before = await getRequest(key);
      const credBefore = (await getProfile("N1")).credits;
      const { data, error } = await rpcClaim("N1", key);
      const after = await getRequest(key);
      const credAfter = (await getProfile("N1")).credits;
      const pass = expectClaim
        ? data?.status === "claimed" &&
          after.nutritionist_id === U.N1.userId &&
          after.status === before.status &&
          credAfter === credBefore
        : data?.status !== "claimed" && reqIsBaseline(key, after);
      record({
        id,
        ...meta,
        ...requestMeta(key, before),
        operation: `N1 claim ${key} (${before.status})`,
        rows: expectClaim ? 1 : 0,
        httpOrSql: { error: summarizeError(error), data },
        expectation: expectClaim ? "claimed, status preservado, sem débito" : "not_eligible",
        result: `${data?.status ?? error?.message} status=${after.status}`,
        pass,
        teardown: "OK",
        errors: [error],
      });
    }

    // B-21: pós-claim, R1 some do pool de N2 e segue visível para N1
    {
      await resetWorld();
      await rpcClaim("N1", "R1");
      const n2 = await session("N2");
      const n1 = await session("N1");
      const { data: s2 } = await n2.from("diet_requests").select("id").eq("id", R["R1"]);
      const { data: s1 } = await n1.from("diet_requests").select("id").eq("id", R["R1"]);
      record({
        id: "B-21",
        identity: "N1/N2",
        role: "nutritionist",
        approved: true,
        ...requestMeta("R1", await getRequest("R1")),
        operation: "após claim de N1: SELECT R1 por N2 e por N1",
        rows: (s1?.length ?? 0) + (s2?.length ?? 0),
        expectation: "N2: 0 rows; N1: visível",
        result: `N2=${s2?.length ?? 0} N1=${s1?.length ?? 0}`,
        pass: (s2?.length ?? 0) === 0 && (s1?.length ?? 0) === 1,
        teardown: "OK",
      });
    }

    // RT-01: realtime não entrega linhas bloqueadas por RLS
    {
      await resetWorld();
      // eventos WAL do reset podem chegar após o SUBSCRIBE
      await sleep(3000);
      const listeners = ["N1", "N2", "C1", "C2", "P1", "N0"];
      const received = Object.fromEntries(listeners.map((k) => [k, new Set()]));
      const channels = [];
      const subscribed = {};
      for (const k of listeners) {
        const c = await session(k);
        const { data: s } = await c.auth.getSession();
        c.realtime.setAuth(s.session.access_token);
        const ch = c
          .channel(`rt-1e2-${k}-${Date.now()}`)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "diet_requests" }, (payload) => {
            const id = payload.new?.id;
            const key = Object.keys(R).find((kk) => R[kk] === id);
            if (key) received[k].add(key);
          });
        subscribed[k] = await new Promise((resolveSub) => {
          const t = setTimeout(() => resolveSub("TIMEOUT"), 8000);
          ch.subscribe((status) => {
            if (status === "SUBSCRIBED") {
              clearTimeout(t);
              resolveSub("SUBSCRIBED");
            }
          });
        });
        channels.push({ c, ch });
      }
      await sleep(1500);
      for (const key of ["R1", "R2", "R6"]) {
        await admin.from("diet_requests").update({ notes: `${MARKER}:${key}` , ai_draft: { rt: Date.now() } }).eq("id", R[key]);
      }
      await sleep(4000);
      for (const { c, ch } of channels) await c.removeChannel(ch);

      const got = Object.fromEntries(listeners.map((k) => [k, [...received[k]].sort()]));
      const expected = {
        N1: ["R1", "R2"],
        N2: ["R1", "R6"],
        C1: [],
        C2: ["R1", "R2", "R6"],
        P1: [],
        N0: [],
      };
      // RLS-visíveis no baseline: qualquer evento fora disto é vazamento
      const allowed = {
        N1: ["R1", "R2", "R3", "R4", "R5"],
        N2: ["R1", "R3", "R4", "R5", "R6"],
        C1: [],
        C2: ["R1", "R2", "R3", "R4", "R5", "R6", "R7"],
        P1: [],
        N0: [],
      };
      const allSubscribed = Object.values(subscribed).every((s) => s === "SUBSCRIBED");
      const leaks = Object.fromEntries(listeners.map((k) => [k, got[k].filter((x) => !allowed[k].includes(x))]));
      const missing = Object.fromEntries(listeners.map((k) => [k, expected[k].filter((x) => !got[k].includes(x))]));
      const pass =
        allSubscribed && listeners.every((k) => leaks[k].length === 0 && missing[k].length === 0);
      record({
        id: "RT-01",
        identity: listeners.join(","),
        role: "mixed",
        approved: null,
        operation: "realtime postgres_changes UPDATE em R1/R2/R6 (service role)",
        rows: null,
        httpOrSql: { subscribed, received: got, expected, allowed, leaks, missing },
        expectation: "cada identidade recebe os UPDATEs esperados e nenhuma linha fora do RLS",
        result: allSubscribed ? JSON.stringify(got) : "SUBSCRIBE TIMEOUT",
        pass: allSubscribed ? pass : null,
        teardown: "OK",
      });
    }

    // UI-SMOKE: replay das chamadas do NutritionistDashboard/ClientDashboard pós-1E.2B
    {
      await resetWorld();
      const n1 = await session("N1");
      const credBefore = (await getProfile("N1")).credits;
      const { data: claim, error: eClaim } = await n1.rpc("claim_diet_request", { p_request_id: R["R1"] });
      const { data: branded, error: eBrand } = await n1
        .from("diet_requests")
        .update({ client_data: { fullName: "Fixture R1", notes: `${MARKER} — synthetic`, clinicBranding: { professionalTier: "basic" } } })
        .eq("id", R["R1"])
        .eq("nutritionist_id", U.N1.userId)
        .select("id");
      const { data: feed } = await n1.from("diet_requests").select("*").order("created_at", { ascending: false });
      const r1 = (feed ?? []).find((r) => r.id === R["R1"]);
      const credAfter = (await getProfile("N1")).credits;
      const txs = await countJobTxs("R1");
      record({
        id: "UI-01",
        identity: "N1",
        role: "nutritionist",
        approved: true,
        ...requestMeta("R1", await getRequest("R1")),
        operation: "handleAcceptJob: rpc claim → UPDATE client_data (own) → fetchRequests",
        rows: branded?.length ?? 0,
        httpOrSql: { claim, claimError: summarizeError(eClaim), brandError: summarizeError(eBrand) },
        expectation: "claimed; branding gravado; R1 in_review/N1 no feed; 1 débito",
        result: `claim=${claim?.status} branded=${branded?.length ?? 0} feedR1=${r1?.status ?? "none"} credits ${credBefore}→${credAfter} txs=${txs.length}`,
        pass:
          claim?.status === "claimed" &&
          (branded?.length ?? 0) === 1 &&
          r1?.status === "in_review" &&
          r1?.nutritionist_id === U.N1.userId &&
          credAfter === credBefore - 1 &&
          txs.length === 1,
        teardown: "OK",
        errors: [eClaim, eBrand],
      });
    }

    {
      await resetWorld();
      const n1 = await session("N1");
      const credBefore = (await getProfile("N1")).credits;
      const { data: claim } = await n1.rpc("claim_diet_request", { p_request_id: R["R3"] });
      const { data: draft, error: eDraft } = await n1
        .from("diet_requests")
        .update({ ai_draft: "# plano sintético" })
        .eq("id", R["R3"])
        .eq("nutritionist_id", U.N1.userId)
        .select("id");
      const { data: approved, error: eAp } = await n1
        .from("diet_requests")
        .update({ status: "completed", notes: `${MARKER}:R3` })
        .eq("id", R["R3"])
        .eq("nutritionist_id", U.N1.userId)
        .select("id");
      const { data: history } = await n1
        .from("diet_requests")
        .select("id")
        .eq("nutritionist_id", U.N1.userId)
        .eq("status", "completed");
      const credAfter = (await getProfile("N1")).credits;
      const inHistory = (history ?? []).some((r) => r.id === R["R3"]);
      record({
        id: "UI-02",
        identity: "N1",
        role: "nutritionist",
        approved: true,
        ...requestMeta("R3", await getRequest("R3")),
        operation: "Editar e Validar (in_review sem dono): ensureOwnedForWrite → save draft → handleApprove → histórico",
        rows: approved?.length ?? 0,
        httpOrSql: { claim, draftError: summarizeError(eDraft), approveError: summarizeError(eAp) },
        expectation: "claim gratuito; draft e aprovação gravam 1 linha; R3 no histórico; sem débito",
        result: `claim=${claim?.status} draft=${draft?.length ?? 0} approve=${approved?.length ?? 0} history=${inHistory} credits ${credBefore}→${credAfter}`,
        pass:
          claim?.status === "claimed" &&
          (draft?.length ?? 0) === 1 &&
          (approved?.length ?? 0) === 1 &&
          inHistory &&
          credAfter === credBefore,
        teardown: "OK",
        errors: [eDraft, eAp],
      });
    }

    {
      await resetWorld();
      const n1 = await session("N1");
      const { data, error } = await n1
        .from("diet_requests")
        .update({ status: "in_review", nutritionist_id: U.N1.userId })
        .eq("id", R["R1"])
        .eq("status", "pending")
        .select()
        .single();
      const after = await getRequest("R1");
      record({
        id: "UI-03",
        identity: "N1",
        role: "nutritionist",
        approved: true,
        ...requestMeta("R1", after),
        operation: "caminho legado pré-1E.2B de handleAcceptJob (UPDATE direto claim)",
        rows: data ? 1 : 0,
        httpOrSql: { error: summarizeError(error) },
        expectation: "0 linhas; R1 inalterado",
        result: data ? "CLAIM EFETIVADO" : "BLOQUEADO",
        pass: !data && reqIsBaseline("R1", after),
        teardown: "OK",
        errors: [error],
      });
    }

    {
      await resetWorld();
      const n0 = await session("N0");
      const { data: feed } = await n0.from("diet_requests").select("id");
      const fixtureRows = (feed ?? []).filter((r) => Object.values(R).includes(r.id)).length;
      const { data: claim } = await n0.rpc("claim_diet_request", { p_request_id: R["R1"] });
      const c2 = await session("C2");
      const { data: own } = await c2.from("diet_requests").select("id").eq("client_id", U.C2.userId);
      const ownFixtures = (own ?? []).filter((r) => Object.values(R).includes(r.id)).length;
      record({
        id: "UI-04",
        identity: "N0/C2",
        role: "mixed",
        approved: null,
        operation: "dashboard N0 (feed + aceitar) e ClientDashboard C2 (próprias)",
        rows: fixtureRows,
        expectation: "N0: feed vazio, claim not_approved; C2: 7 próprias",
        result: `N0 feed=${fixtureRows} claim=${claim?.status} C2 own=${ownFixtures}`,
        pass: fixtureRows === 0 && claim?.status === "not_approved" && ownFixtures === 7 && reqIsBaseline("R1", await getRequest("R1")),
        teardown: "OK",
      });
    }
  }

  // 42P17 global
  record({
    id: phase === "b" ? "B-17" : phase === "a" ? "A-42P17" : "BEFORE-42P17",
    identity: "all",
    role: null,
    approved: null,
    operation: "nenhum 42P17 em toda a suíte",
    rows: null,
    expectation: "CLEAR",
    result: recursionSeen ? "42P17 DETECTADO" : "CLEAR",
    pass: !recursionSeen,
    teardown: "OK",
  });

  // ── Teardown ─────────────────────────────────────────────────────────────
  await deleteRequestTxs();
  await admin.from("diet_requests").delete().like("notes", `${MARKER}%`);
  for (const k of trackedProfiles) {
    const s = initialProfiles[k];
    await admin
      .from("profiles")
      .update({ role: s.role, approved: s.approved, credits: s.credits, plan_tier: s.plan_tier, deleted_at: s.deleted_at })
      .eq("user_id", s.user_id);
  }
  await admin.from("profiles").delete().eq("user_id", U.N0.userId);
  await admin.auth.admin.deleteUser(U.N0.userId);
  for (const c of Object.values(sessions)) await c.auth.signOut();

  const { count: leftReq } = await admin
    .from("diet_requests")
    .select("id", { count: "exact", head: true })
    .like("notes", `${MARKER}%`);
  let leftTx = 0;
  for (const id of Object.values(R)) {
    const { count } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .like("description", `%#${id.slice(0, 8)}%`);
    leftTx += count ?? 0;
  }
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const n0Left = !!list?.users?.find((u) => u.email === U.N0.email);
  const profilesRestored = [];
  for (const k of trackedProfiles) {
    const { data } = await admin
      .from("profiles")
      .select("user_id, role, approved, credits, plan_tier, deleted_at")
      .eq("user_id", U[k].userId)
      .single();
    const s = initialProfiles[k];
    profilesRestored.push(
      data.role === s.role &&
        data.approved === s.approved &&
        data.credits === s.credits &&
        data.plan_tier === s.plan_tier &&
        data.deleted_at === s.deleted_at,
    );
  }
  const teardown = {
    residualRequests: leftReq ?? 0,
    residualTransactions: leftTx,
    n0Removed: !n0Left,
    profilesRestored: profilesRestored.every(Boolean),
  };
  teardown.clean =
    teardown.residualRequests === 0 && teardown.residualTransactions === 0 && teardown.n0Removed && teardown.profilesRestored;

  const graded = results.filter((r) => r.pass !== null);
  const passed = graded.filter((r) => r.pass).length;
  const failed = graded.filter((r) => !r.pass).length;
  const secMatrix = Object.fromEntries(
    results
      .filter((r) => r.secId)
      .map((r) => [
        r.secId,
        r.vulnerableObserved ? "VULNERABILIDADE CONFIRMADA" : "BLOQUEADA",
      ]),
  );

  const evidence = {
    createdAt: new Date().toISOString(),
    stage: `1E.2-${phase}`,
    supabaseUrl: url,
    fixtures: {
      identities: {
        C1: "client",
        C2: "client",
        N0: "nutritionist approved=false (criado/removido pelo harness)",
        N1: "nutritionist approved=true",
        N2: "nutritionist approved=true",
        P1: "personal_trainer",
        A1: "admin",
        anon: "não autenticado",
      },
      requests: Object.fromEntries(
        Object.entries(REQ_BASELINE).map(([k, b]) => [
          k,
          {
            client_id: "C2",
            status: b.status,
            nutritionist_id: k === "R6" ? "N2" : null,
            assigned_nutritionist_id: k === "R2" ? "N1" : null,
          },
        ]),
      ),
    },
    secMatrix,
    summary: { total: results.length, graded: graded.length, passed, failed, recursionSeen },
    teardown,
    results,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(`\nSEC MATRIX: ${JSON.stringify(secMatrix)}`);
  console.log(`TEARDOWN: ${JSON.stringify(teardown)}`);
  console.log(`SUMMARY: ${passed}/${graded.length} passed, ${failed} failed`);
  console.log(`EVIDENCE: ${outPath}`);
  if (failed > 0 || !teardown.clean) process.exitCode = 1;
}

main().catch((err) => {
  console.error("1E.2_SUITE_FAILED:", err?.stack || err?.message || err);
  process.exit(1);
});
