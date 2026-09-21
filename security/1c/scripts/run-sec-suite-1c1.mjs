#!/usr/bin/env node
/**
 * Security 1C.1 — reexecução LIMPA e determinística da matriz canônica.
 *
 * - Cada SEC/CTRL é isolado: prepare → assert → act → capture → teardown → verify
 * - Service role LOCAL apenas para prepare/teardown (nunca para a ação sob teste)
 * - Não altera RLS/schema/produto
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

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
    status: error.status || error.statusCode || null,
  };
}

function classify({ expectedHardeningBlocks, baselineAllowed, error }) {
  if (error && /42P17|infinite recursion/i.test(error.message || "")) {
    return "BLOQUEADO POR VULN-1C-001 / 42P17";
  }
  if (expectedHardeningBlocks) {
    if (baselineAllowed) return "VULNERABILIDADE CONFIRMADA";
    return "NÃO CONFIRMADA"; // deny limpo / ataque ineficaz nesta rodada
  }
  return baselineAllowed ? "CONTROLE OK" : "CONTROLE FALHOU";
}

/** Baseline centralizado — fonte única. */
const BASELINE = {
  C1: { role: "client", credits: 0, plan_tier: "basic", approved: false },
  R1: {
    status: "pending",
    nutritionist_id: null,
    assigned_nutritionist_id: null,
    notes: "SECURITY_1C_FIXTURE:R1",
  },
  R2: {
    status: "in_review",
    notes: "SECURITY_1C_FIXTURE:R2",
  },
  clientData: {
    fullName: "Fixture Client C2",
    age: 30,
    goal: "audit-only-synthetic",
    notes: "SECURITY_1C_FIXTURE — not real patient data",
  },
};

async function login(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

function adminClient(url, serviceKey) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getProfile(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, role, credits, plan_tier, approved")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data;
}

async function restoreC1(admin, c1Id) {
  const { error } = await admin
    .from("profiles")
    .update({
      role: BASELINE.C1.role,
      credits: BASELINE.C1.credits,
      plan_tier: BASELINE.C1.plan_tier,
      approved: BASELINE.C1.approved,
      deleted_at: null,
    })
    .eq("user_id", c1Id);
  if (error) throw new Error(`restoreC1: ${error.message}`);
}

async function restoreR1(admin, r1Id, c2Id) {
  const { error } = await admin
    .from("diet_requests")
    .update({
      client_id: c2Id,
      status: BASELINE.R1.status,
      nutritionist_id: BASELINE.R1.nutritionist_id,
      assigned_nutritionist_id: BASELINE.R1.assigned_nutritionist_id,
      client_data: BASELINE.clientData,
      notes: BASELINE.R1.notes,
      ai_draft: null,
    })
    .eq("id", r1Id);
  if (error) throw new Error(`restoreR1: ${error.message}`);
}

async function restoreR2(admin, r2Id, c2Id, n2Id) {
  const { error } = await admin
    .from("diet_requests")
    .update({
      client_id: c2Id,
      status: BASELINE.R2.status,
      nutritionist_id: n2Id,
      assigned_nutritionist_id: n2Id,
      client_data: BASELINE.clientData,
      notes: BASELINE.R2.notes,
    })
    .eq("id", r2Id);
  if (error) throw new Error(`restoreR2: ${error.message}`);
}

async function assertC1Baseline(admin, c1Id) {
  const p = await getProfile(admin, c1Id);
  const ok =
    p.role === BASELINE.C1.role &&
    p.credits === BASELINE.C1.credits &&
    p.plan_tier === BASELINE.C1.plan_tier;
  return { ok, profile: p };
}

async function assertR1Baseline(admin, r1Id, c2Id) {
  const { data, error } = await admin
    .from("diet_requests")
    .select("id, client_id, status, nutritionist_id, assigned_nutritionist_id, notes")
    .eq("id", r1Id)
    .single();
  if (error) throw new Error(`assertR1: ${error.message}`);
  const ok =
    data.client_id === c2Id &&
    data.status === BASELINE.R1.status &&
    data.nutritionist_id == null &&
    data.assigned_nutritionist_id == null &&
    data.notes === BASELINE.R1.notes;
  return { ok, row: data };
}

function record(partial) {
  const vulnClass = classify({
    expectedHardeningBlocks: partial.expectedHardeningBlocks !== false,
    baselineAllowed: partial.baselineAllowed,
    error: partial.httpOrSql?.error,
  });
  return {
    ...partial,
    classification:
      partial.kind === "control"
        ? partial.baselineAllowed
          ? "CONTROLE OK"
          : "CONTROLE FALHOU"
        : vulnClass === "NÃO CONFIRMADA" && !partial.baselineAllowed
          ? "NÃO CONFIRMADA"
          : vulnClass,
    deterministic: partial.teardownOk && partial.postTeardownOk ? "SIM" : "NÃO",
  };
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  assertLocal(url);
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const runtimePath =
    process.env.FIXTURE_RUNTIME_IN?.trim() ||
    resolve(homedir(), "nutriaprova-security-1c-local/runtime/fixtures.json");
  const evidenceOut =
    process.env.SEC_EVIDENCE_OUT?.trim() ||
    resolve(process.cwd(), "security/1c/evidence/results-1c1.json");

  const fixtures = JSON.parse(await readFile(runtimePath, "utf8"));
  const password = fixtures.password;
  const U = fixtures.users;
  const R1id = fixtures.requests.R1.id;
  const R2id = fixtures.requests.R2.id;
  const admin = adminClient(url, serviceKey);

  // Reset global contamination from prior runs
  await restoreC1(admin, U.C1.userId);
  await restoreR1(admin, R1id, U.C2.userId);
  await restoreR2(admin, R2id, U.C2.userId, U.N2.userId);
  await admin.from("transactions").delete().like("description", "SECURITY_1C_%");
  await admin.from("invite_analytics").delete().like("code", "SEC%");
  await admin.from("client_feedback").delete().like("comment", "SECURITY_1C_%");

  const results = [];

  async function withSession(actorKey, fn) {
    const s = await login(url, anonKey, U[actorKey].email, password);
    try {
      return await fn(s);
    } finally {
      await s.client.auth.signOut();
    }
  }

  // ─── SEC-001 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    await restoreR1(admin, R1id, U.C2.userId);
    const init = await assertR1Baseline(admin, R1id, U.C2.userId);
    const c1p = await assertC1Baseline(admin, U.C1.userId);
    const act = await withSession("C1", async ({ client }) => {
      const { data, error, status } = await client
        .from("diet_requests")
        .select("id, client_id, status, client_data, nutritionist_id, assigned_nutritionist_id")
        .eq("id", R1id);
      return { data, error, status, rows: data?.length ?? 0 };
    });
    await restoreR1(admin, R1id, U.C2.userId);
    await restoreC1(admin, U.C1.userId);
    const postR = await assertR1Baseline(admin, R1id, U.C2.userId);
    const postC = await assertC1Baseline(admin, U.C1.userId);
    results.push(
      record({
        id: "SEC-001",
        kind: "sec",
        identity: "C1",
        initialState: { R1: init.row, C1: c1p.profile },
        operation: "SELECT diet_requests R1 (pool público de C2)",
        httpOrSql: { status: act.status ?? null, error: summarizeError(act.error) },
        rowsReturned: act.rows,
        rowsAffected: 0,
        baselineBehavior:
          act.rows > 0 ? "C1 leu R1 de C2 (incl. client_data)" : "C1 não leu R1",
        expectedAfterHardening: "Negar SELECT de pedido/client_data alheio no pool",
        baselineAllowed: !act.error && act.rows > 0,
        teardownOk: true,
        postTeardownOk: postR.ok && postC.ok,
        postTeardown: { R1: postR.row, C1: postC.profile },
      }),
    );
  }

  // ─── SEC-002 ───────────────────────────────────────────────────────────
  {
    await restoreR1(admin, R1id, U.C2.userId);
    const init = await assertR1Baseline(admin, R1id, U.C2.userId);
    const act = await withSession("P1", async ({ client }) => {
      const { data, error, status } = await client
        .from("diet_requests")
        .select("id, client_id, status, client_data")
        .eq("id", R1id);
      return { data, error, status, rows: data?.length ?? 0 };
    });
    await restoreR1(admin, R1id, U.C2.userId);
    const postR = await assertR1Baseline(admin, R1id, U.C2.userId);
    results.push(
      record({
        id: "SEC-002",
        kind: "sec",
        identity: "P1",
        initialState: { R1: init.row },
        operation: "SELECT diet_requests R1",
        httpOrSql: { status: act.status ?? null, error: summarizeError(act.error) },
        rowsReturned: act.rows,
        rowsAffected: 0,
        baselineBehavior: act.rows > 0 ? "P1 leu R1" : "P1 não leu R1",
        expectedAfterHardening: "Negar SELECT clínico a personal_trainer",
        baselineAllowed: !act.error && act.rows > 0,
        teardownOk: true,
        postTeardownOk: postR.ok,
        postTeardown: { R1: postR.row },
      }),
    );
  }

  // ─── SEC-003 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    await restoreR1(admin, R1id, U.C2.userId);
    const init = await assertR1Baseline(admin, R1id, U.C2.userId);
    const act = await withSession("C1", async ({ client }) => {
      const { error, status, count } = await client
        .from("diet_requests")
        .update({
          nutritionist_id: U.C1.userId,
          status: "in_review",
          notes: "SECURITY_1C_SEC003_CLIENT_CLAIM",
        })
        .eq("id", R1id);
      // verify via admin
      return { error, status, count };
    });
    const { data: after } = await admin
      .from("diet_requests")
      .select("id, status, nutritionist_id, notes")
      .eq("id", R1id)
      .single();
    const claimed =
      !act.error &&
      after?.nutritionist_id === U.C1.userId &&
      after?.status === "in_review";
    await restoreR1(admin, R1id, U.C2.userId);
    await restoreC1(admin, U.C1.userId);
    const postR = await assertR1Baseline(admin, R1id, U.C2.userId);
    results.push(
      record({
        id: "SEC-003",
        kind: "sec",
        identity: "C1",
        initialState: { R1: init.row },
        operation: "UPDATE/claim R1",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          afterAttack: after,
        },
        rowsReturned: 0,
        rowsAffected: claimed ? 1 : 0,
        baselineBehavior: claimed ? "C1 assumiu R1" : "Claim C1 sem efeito",
        expectedAfterHardening: "Negar claim de pool a client",
        baselineAllowed: claimed,
        teardownOk: true,
        postTeardownOk: postR.ok,
        postTeardown: { R1: postR.row },
      }),
    );
  }

  // ─── SEC-004 ───────────────────────────────────────────────────────────
  {
    await restoreR1(admin, R1id, U.C2.userId);
    const init = await assertR1Baseline(admin, R1id, U.C2.userId);
    const act = await withSession("P1", async ({ client }) => {
      const { error, status } = await client
        .from("diet_requests")
        .update({
          nutritionist_id: U.P1.userId,
          status: "in_review",
          notes: "SECURITY_1C_SEC004_PT_CLAIM",
        })
        .eq("id", R1id);
      return { error, status };
    });
    const { data: after } = await admin
      .from("diet_requests")
      .select("id, status, nutritionist_id, notes")
      .eq("id", R1id)
      .single();
    const claimed =
      !act.error &&
      after?.nutritionist_id === U.P1.userId &&
      after?.status === "in_review";
    await restoreR1(admin, R1id, U.C2.userId);
    const postR = await assertR1Baseline(admin, R1id, U.C2.userId);
    results.push(
      record({
        id: "SEC-004",
        kind: "sec",
        identity: "P1",
        initialState: { R1: init.row },
        operation: "UPDATE/claim R1",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          afterAttack: after,
        },
        rowsReturned: 0,
        rowsAffected: claimed ? 1 : 0,
        baselineBehavior: claimed ? "P1 assumiu R1" : "Claim P1 sem efeito",
        expectedAfterHardening: "Negar claim de pool a personal_trainer",
        baselineAllowed: claimed,
        teardownOk: true,
        postTeardownOk: postR.ok,
        postTeardown: { R1: postR.row },
      }),
    );
  }

  // ─── SEC-005 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    const init = await assertC1Baseline(admin, U.C1.userId);
    const act = await withSession("C1", async ({ client }) => {
      const { error, status } = await client
        .from("profiles")
        .update({ role: "admin" })
        .eq("user_id", U.C1.userId);
      return { error, status };
    });
    const mid = await getProfile(admin, U.C1.userId);
    const escalated = !act.error && mid.role === "admin";
    // restore IMMEDIATELY
    await restoreC1(admin, U.C1.userId);
    const post = await assertC1Baseline(admin, U.C1.userId);
    results.push(
      record({
        id: "SEC-005",
        kind: "sec",
        identity: "C1",
        initialState: { C1: init.profile },
        operation: "UPDATE profiles.role → admin",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          midState: mid,
        },
        rowsReturned: 0,
        rowsAffected: escalated ? 1 : 0,
        baselineBehavior: escalated ? "C1 elevou role para admin" : "Escalação sem efeito",
        expectedAfterHardening: "Negar self-update de role",
        baselineAllowed: escalated,
        teardownOk: true,
        postTeardownOk: post.ok,
        postTeardown: { C1: post.profile },
      }),
    );
  }

  // ─── SEC-006 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    const init = await assertC1Baseline(admin, U.C1.userId);
    const act = await withSession("C1", async ({ client }) => {
      const { error, status } = await client
        .from("profiles")
        .update({ credits: 9999 })
        .eq("user_id", U.C1.userId);
      return { error, status };
    });
    const mid = await getProfile(admin, U.C1.userId);
    const changed = !act.error && mid.credits === 9999;
    await restoreC1(admin, U.C1.userId);
    const post = await assertC1Baseline(admin, U.C1.userId);
    results.push(
      record({
        id: "SEC-006",
        kind: "sec",
        identity: "C1",
        initialState: { C1: init.profile },
        operation: "UPDATE profiles.credits → 9999",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          midState: mid,
        },
        rowsReturned: 0,
        rowsAffected: changed ? 1 : 0,
        baselineBehavior: changed ? "C1 alterou credits" : "Credits sem efeito",
        expectedAfterHardening: "Negar self-update de credits",
        baselineAllowed: changed,
        teardownOk: true,
        postTeardownOk: post.ok,
        postTeardown: { C1: post.profile },
      }),
    );
  }

  // ─── SEC-007 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    const init = await assertC1Baseline(admin, U.C1.userId);
    const act = await withSession("C1", async ({ client }) => {
      const { error, status } = await client
        .from("profiles")
        .update({ plan_tier: "premium" })
        .eq("user_id", U.C1.userId);
      return { error, status };
    });
    const mid = await getProfile(admin, U.C1.userId);
    const changed = !act.error && mid.plan_tier === "premium";
    await restoreC1(admin, U.C1.userId);
    const post = await assertC1Baseline(admin, U.C1.userId);
    results.push(
      record({
        id: "SEC-007",
        kind: "sec",
        identity: "C1",
        initialState: { C1: init.profile },
        operation: "UPDATE profiles.plan_tier → premium",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          midState: mid,
        },
        rowsReturned: 0,
        rowsAffected: changed ? 1 : 0,
        baselineBehavior: changed ? "C1 alterou plan_tier" : "plan_tier sem efeito",
        expectedAfterHardening: "Negar self-update de plan_tier",
        baselineAllowed: changed,
        teardownOk: true,
        postTeardownOk: post.ok,
        postTeardown: { C1: post.profile },
      }),
    );
  }

  // ─── SEC-008 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    const marker = `SECURITY_1C_SEC008_${Date.now()}`;
    const act = await withSession("C1", async ({ client }) => {
      const { error, status } = await client.from("transactions").insert({
        user_id: U.C1.userId,
        amount: 99999,
        type: "credit_purchase",
        description: marker,
      });
      return { error, status };
    });
    const { data: rows } = await admin
      .from("transactions")
      .select("id, amount, description")
      .eq("description", marker);
    const inserted = !act.error && (rows?.length ?? 0) > 0;
    await admin.from("transactions").delete().eq("description", marker);
    const { data: left } = await admin
      .from("transactions")
      .select("id")
      .eq("description", marker);
    results.push(
      record({
        id: "SEC-008",
        kind: "sec",
        identity: "C1",
        initialState: { C1: (await assertC1Baseline(admin, U.C1.userId)).profile },
        operation: "INSERT arbitrário em transactions",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          insertedRows: rows,
        },
        rowsReturned: 0,
        rowsAffected: inserted ? 1 : 0,
        baselineBehavior: inserted
          ? "C1 inseriu transaction arbitrária"
          : "INSERT transaction bloqueado",
        expectedAfterHardening: "Negar self-insert de transactions",
        baselineAllowed: inserted,
        teardownOk: true,
        postTeardownOk: (left?.length ?? 0) === 0,
        postTeardown: { residualTx: left?.length ?? 0 },
      }),
    );
  }

  // ─── SEC-009 (anon, sem .select()) ─────────────────────────────────────
  {
    const code = `SEC009_1C1_${Date.now()}`;
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error, status } = await anon.from("invite_analytics").insert({
      code,
      event_type: "sale",
      session_key: `sec009-${Date.now()}`,
      amount: 999.99,
      metadata: { source: "SECURITY_1C1_SEC009", fraud: true },
    });
    const { data: rows } = await admin
      .from("invite_analytics")
      .select("id, code, event_type, amount")
      .eq("code", code);
    const inserted = !error && (rows?.length ?? 0) > 0;
    await admin.from("invite_analytics").delete().eq("code", code);
    const { data: left } = await admin.from("invite_analytics").select("id").eq("code", code);
    results.push(
      record({
        id: "SEC-009",
        kind: "sec",
        identity: "anon",
        initialState: {},
        operation: "INSERT fraudulento sale+amount em invite_analytics",
        httpOrSql: {
          status: status ?? null,
          error: summarizeError(error),
          insertedRows: rows,
        },
        rowsReturned: 0,
        rowsAffected: inserted ? 1 : 0,
        baselineBehavior: inserted
          ? "Anon inseriu sale+amount"
          : "Anon INSERT bloqueado",
        expectedAfterHardening: "Negar sale/amount para anon",
        baselineAllowed: inserted,
        teardownOk: true,
        postTeardownOk: (left?.length ?? 0) === 0,
        postTeardown: { residual: left?.length ?? 0 },
      }),
    );
  }

  // ─── SEC-010 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    const code = `SEC010_1C1_${Date.now()}`;
    const act = await withSession("C1", async ({ client }) => {
      const { error, status } = await client.from("invite_analytics").insert({
        code,
        event_type: "sale",
        session_key: `sec010-${Date.now()}`,
        amount: 888.88,
        owner_id: U.N2.userId,
        metadata: { source: "SECURITY_1C1_SEC010", fraud: true },
      });
      return { error, status };
    });
    const { data: rows } = await admin
      .from("invite_analytics")
      .select("id, code, event_type, amount")
      .eq("code", code);
    const inserted = !act.error && (rows?.length ?? 0) > 0;
    await admin.from("invite_analytics").delete().eq("code", code);
    const { data: left } = await admin.from("invite_analytics").select("id").eq("code", code);
    results.push(
      record({
        id: "SEC-010",
        kind: "sec",
        identity: "C1",
        initialState: { C1: (await assertC1Baseline(admin, U.C1.userId)).profile },
        operation: "INSERT fraudulento sale+amount em invite_analytics",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          insertedRows: rows,
        },
        rowsReturned: 0,
        rowsAffected: inserted ? 1 : 0,
        baselineBehavior: inserted
          ? "C1 inseriu sale+amount"
          : "INSERT C1 bloqueado",
        expectedAfterHardening: "Negar sale/amount a client",
        baselineAllowed: inserted,
        teardownOk: true,
        postTeardownOk: (left?.length ?? 0) === 0,
        postTeardown: { residual: left?.length ?? 0 },
      }),
    );
  }

  // ─── SEC-011 ───────────────────────────────────────────────────────────
  {
    await restoreC1(admin, U.C1.userId);
    await restoreR2(admin, R2id, U.C2.userId, U.N2.userId);
    const comment = `SECURITY_1C_SEC011_${Date.now()}`;
    const act = await withSession("C1", async ({ client }) => {
      const { error, status } = await client.from("client_feedback").insert({
        diet_request_id: R2id,
        client_id: U.C1.userId,
        rating: 5,
        comment,
      });
      return { error, status };
    });
    const { data: rows } = await admin
      .from("client_feedback")
      .select("id, diet_request_id, client_id, comment")
      .eq("comment", comment);
    const inserted = !act.error && (rows?.length ?? 0) > 0;
    await admin.from("client_feedback").delete().eq("comment", comment);
    const { data: left } = await admin.from("client_feedback").select("id").eq("comment", comment);
    results.push(
      record({
        id: "SEC-011",
        kind: "sec",
        identity: "C1",
        initialState: { R2_owner: "C2", feedback_client: "C1" },
        operation: "INSERT client_feedback apontando para request de C2 (R2)",
        httpOrSql: {
          status: act.status ?? null,
          error: summarizeError(act.error),
          insertedRows: rows,
        },
        rowsReturned: 0,
        rowsAffected: inserted ? 1 : 0,
        baselineBehavior: inserted
          ? "C1 criou feedback em pedido de C2"
          : "INSERT feedback bloqueado",
        expectedAfterHardening: "Exigir ownership do diet_request pelo client_id",
        baselineAllowed: inserted,
        teardownOk: true,
        postTeardownOk: (left?.length ?? 0) === 0,
        postTeardown: { residual: left?.length ?? 0 },
      }),
    );
  }

  // ─── CONTROLES ─────────────────────────────────────────────────────────
  async function runControl(id, identity, expectedAllow, fn, prepare) {
    if (prepare) await prepare();
    await restoreC1(admin, U.C1.userId);
    await restoreR1(admin, R1id, U.C2.userId);
    await restoreR2(admin, R2id, U.C2.userId, U.N2.userId);

    if (id === "CTRL-NEG-01") {
      const gate = await assertC1Baseline(admin, U.C1.userId);
      if (gate.profile.role !== "client") {
        throw new Error(
          `CTRL-NEG-01 ABORT: C1 role=${gate.profile.role} (contaminação). Restore e pare.`,
        );
      }
    }

    const act = await withSession(identity, fn);
    await restoreC1(admin, U.C1.userId);
    await restoreR1(admin, R1id, U.C2.userId);
    await restoreR2(admin, R2id, U.C2.userId, U.N2.userId);
    const postC = await assertC1Baseline(admin, U.C1.userId);
    const postR = await assertR1Baseline(admin, R1id, U.C2.userId);

    const allowed = act.ok;
    results.push(
      record({
        id,
        kind: "control",
        identity,
        initialState: act.initialState || {},
        operation: act.operation,
        httpOrSql: act.httpOrSql,
        rowsReturned: act.rowsReturned ?? 0,
        rowsAffected: act.rowsAffected ?? 0,
        baselineBehavior: act.baselineBehavior,
        expectedAfterHardening: expectedAllow
          ? "Deve permitir (controle positivo)"
          : "Deve negar (controle negativo)",
        expectedHardeningBlocks: !expectedAllow,
        baselineAllowed: expectedAllow ? allowed : !allowed ? true : false,
        // for negative control: success means attack denied → baselineAllowed for "control ok" inverted in record()
        // Fix: for controls use kind=control and baselineAllowed = (allowed === expectedAllow)
        teardownOk: true,
        postTeardownOk: postC.ok && postR.ok,
        postTeardown: { C1: postC.profile, R1: postR.row },
        controlExpectedAllow: expectedAllow,
        controlObservedAllow: allowed,
      }),
    );
    // patch classification for controls
    const last = results[results.length - 1];
    last.classification =
      allowed === expectedAllow ? "CONTROLE OK" : "CONTROLE FALHOU";
    last.baselineAllowed = allowed === expectedAllow;
  }

  await runControl("CTRL-POS-01", "C2", true, async ({ client }) => {
    const { data, error, status } = await client
      .from("diet_requests")
      .select("id, status")
      .in("id", [R1id, R2id]);
    const rows = data?.length ?? 0;
    return {
      ok: !error && rows === 2,
      operation: "SELECT own R1+R2",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsReturned: rows,
      baselineBehavior: rows === 2 ? "C2 vê R1 e R2" : `C2 viu ${rows}`,
    };
  });

  await runControl("CTRL-POS-02", "N2", true, async ({ client }) => {
    const { data, error, status } = await client
      .from("diet_requests")
      .select("id")
      .eq("id", R2id);
    const rows = data?.length ?? 0;
    return {
      ok: !error && rows === 1,
      operation: "SELECT R2",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsReturned: rows,
      baselineBehavior: rows === 1 ? "N2 vê R2" : "N2 não vê R2",
    };
  });

  await runControl("CTRL-POS-03", "N2", true, async ({ client }) => {
    const { error, status } = await client
      .from("diet_requests")
      .update({ notes: BASELINE.R2.notes })
      .eq("id", R2id);
    return {
      ok: !error,
      operation: "UPDATE R2 notes",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsAffected: error ? 0 : 1,
      baselineBehavior: error ? "N2 não atualizou R2" : "N2 atualizou R2",
    };
  });

  await runControl("CTRL-POS-04", "A1", true, async ({ client }) => {
    const { data, error, status } = await client
      .from("diet_requests")
      .select("id")
      .in("id", [R1id, R2id]);
    const rows = data?.length ?? 0;
    return {
      ok: !error && rows === 2,
      operation: "SELECT R1+R2",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsReturned: rows,
      baselineBehavior: rows === 2 ? "Admin vê ambos" : `Admin viu ${rows}`,
    };
  });

  await runControl("CTRL-NEG-01", "C1", false, async ({ client }) => {
    const { data, error, status } = await client
      .from("profiles")
      .select("user_id, role, full_name")
      .eq("user_id", U.C2.userId);
    const rows = data?.length ?? 0;
    return {
      ok: !error && rows > 0, // ok=allowed (attack succeeded)
      operation: "SELECT profile C2",
      httpOrSql: { status: status ?? null, error: summarizeError(error), c1Gate: "role=client" },
      rowsReturned: rows,
      baselineBehavior: rows > 0 ? "C1 leu profile C2" : "C1 não leu profile C2",
    };
  });

  await runControl("CTRL-NEG-02", "N1", false, async ({ client }) => {
    const { data, error, status } = await client
      .from("diet_requests")
      .select("id")
      .eq("id", R2id);
    const rows = data?.length ?? 0;
    return {
      ok: !error && rows > 0,
      operation: "SELECT R2 (owned by N2)",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsReturned: rows,
      baselineBehavior: rows > 0 ? "N1 leu R2" : "N1 não leu R2",
    };
  });

  // Final contamination check
  const finalC1 = await assertC1Baseline(admin, U.C1.userId);
  const finalR1 = await assertR1Baseline(admin, R1id, U.C2.userId);
  const { count: txLeft } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .like("description", "SECURITY_1C_%");
  const { count: invLeft } = await admin
    .from("invite_analytics")
    .select("id", { count: "exact", head: true })
    .like("code", "SEC%");
  const { count: fbLeft } = await admin
    .from("client_feedback")
    .select("id", { count: "exact", head: true })
    .like("comment", "SECURITY_1C_%");

  const evidence = {
    createdAt: new Date().toISOString(),
    stage: "1C.1",
    supabaseUrl: url,
    baseline: BASELINE,
    results,
    finalContaminationCheck: {
      C1: finalC1,
      R1: finalR1,
      residual: { transactions: txLeft ?? 0, invite_analytics: invLeft ?? 0, client_feedback: fbLeft ?? 0 },
      clean:
        finalC1.ok &&
        finalR1.ok &&
        (txLeft ?? 0) === 0 &&
        (invLeft ?? 0) === 0 &&
        (fbLeft ?? 0) === 0,
    },
  };

  await mkdir(dirname(evidenceOut), { recursive: true });
  await writeFile(evidenceOut, JSON.stringify(evidence, null, 2) + "\n");

  console.log("=== MATRIZ 1C.1 ===");
  for (const r of results) {
    console.log(
      `${r.id}\t${r.classification}\tteardown=${r.deterministic}\t${r.identity}\t${r.operation}`,
    );
  }
  console.log("=== FINAL CONTAMINATION ===");
  console.log(JSON.stringify(evidence.finalContaminationCheck, null, 2));
  console.log(`EVIDENCE: ${evidenceOut}`);
}

main().catch((err) => {
  console.error("SEC_1C1_FAILED:", err?.message || err);
  process.exit(1);
});
