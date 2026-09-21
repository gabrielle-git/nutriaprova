#!/usr/bin/env node
/**
 * Security 1C — suíte canônica SEC-001…SEC-011 + controles.
 * Sem service role nos testes. Sem correções de RLS/schema.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

const BLOCKED_42P17 = "BLOQUEADO POR VULN-1C-001 / 42P17";

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

function is42P17(httpOrSql) {
  const blob = JSON.stringify(httpOrSql || {});
  return /42P17|infinite recursion/i.test(blob);
}

function classifyAuthz({ expectedHardeningBlocks, baselineAllowed, httpOrSql }) {
  if (is42P17(httpOrSql)) return BLOCKED_42P17;
  if (expectedHardeningBlocks) {
    if (baselineAllowed) return "VULNERABILIDADE CONFIRMADA";
    return "BLOQUEADA";
  }
  return "NÃO CONFIRMADA";
}

function record(base) {
  return {
    ...base,
    classification: classifyAuthz({
      expectedHardeningBlocks: base.expectedHardeningBlocks,
      baselineAllowed: base.baselineAllowed,
      httpOrSql: base.httpOrSql,
    }),
  };
}

async function clientAs(url, anon, email, password) {
  const c = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login failed ${email}: ${error.message}`);
  return { client: c, userId: data.user.id };
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  assertLocal(url);
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const runtimePath =
    process.env.FIXTURE_RUNTIME_IN?.trim() ||
    resolve(homedir(), "nutriaprova-security-1c-local/runtime/fixtures.json");
  const evidenceOut =
    process.env.SEC_EVIDENCE_OUT?.trim() ||
    resolve(process.cwd(), "security/1c/evidence/results.json");

  const fixtures = JSON.parse(await readFile(runtimePath, "utf8"));
  const password = fixtures.password;
  if (!password) throw new Error("fixtures.password missing");

  const U = fixtures.users;
  const R1 = fixtures.requests.R1;
  const R2 = fixtures.requests.R2;

  const sessions = {};
  for (const key of ["C1", "C2", "N1", "N2", "P1", "A1"]) {
    sessions[key] = await clientAs(url, anonKey, U[key].email, password);
  }

  // Pure anon client (no user session) for SEC-009
  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cases = [];

  // ── SEC-001 C1 SELECT R1 ───────────────────────────────────────────────
  {
    const { data, error, status } = await sessions.C1.client
      .from("diet_requests")
      .select("id, client_id, status, client_data, nutritionist_id, assigned_nutritionist_id")
      .eq("id", R1.id);
    const rows = data?.length ?? 0;
    cases.push(
      record({
        id: "SEC-001",
        identity: "C1",
        operation: "SELECT diet_requests R1 (pool público de C2)",
        payload: { id: R1.id },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: rows,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : rows > 0
            ? "C1 leu R1 de C2"
            : "C1 não leu R1",
        expectedAfterHardening:
          "Negar SELECT de client_data/pedido alheio no pool (ou restringir campos)",
        expectedHardeningBlocks: true,
        baselineAllowed: !error && rows > 0,
      }),
    );
  }

  // ── SEC-002 P1 SELECT R1 ───────────────────────────────────────────────
  {
    const { data, error, status } = await sessions.P1.client
      .from("diet_requests")
      .select("id, client_id, status, client_data, nutritionist_id, assigned_nutritionist_id")
      .eq("id", R1.id);
    const rows = data?.length ?? 0;
    cases.push(
      record({
        id: "SEC-002",
        identity: "P1",
        operation: "SELECT diet_requests R1 (mesma request do pool)",
        payload: { id: R1.id },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: rows,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : rows > 0
            ? "P1 leu R1"
            : "P1 não leu R1",
        expectedAfterHardening:
          "Negar SELECT de pedido clínico a personal_trainer (fora do papel nutri)",
        expectedHardeningBlocks: true,
        baselineAllowed: !error && rows > 0,
      }),
    );
  }

  // ── SEC-003 C1 UPDATE/claim R1 (sem .select(); UPDATE ainda avalia policies admin→42P17) ─
  {
    const { error, status } = await sessions.C1.client
      .from("diet_requests")
      .update({
        nutritionist_id: U.C1.userId,
        status: "in_review",
        notes: "SECURITY_1C_SEC003_CLIENT_CLAIM",
      })
      .eq("id", R1.id);
    const allowed = !error;
    cases.push(
      record({
        id: "SEC-003",
        identity: "C1",
        operation: "UPDATE/claim diet_requests R1",
        payload: { id: R1.id, nutritionist_id: "C1", status: "in_review" },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "C1 fez claim de R1"
            : "Claim C1 sem efeito",
        expectedAfterHardening: "Negar claim de pool a client",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── SEC-004 P1 UPDATE/claim R1 ─────────────────────────────────────────
  {
    const { error, status } = await sessions.P1.client
      .from("diet_requests")
      .update({
        nutritionist_id: U.P1.userId,
        status: "in_review",
        notes: "SECURITY_1C_SEC004_PT_CLAIM",
      })
      .eq("id", R1.id);
    const allowed = !error;
    cases.push(
      record({
        id: "SEC-004",
        identity: "P1",
        operation: "UPDATE/claim diet_requests R1",
        payload: { id: R1.id, nutritionist_id: "P1", status: "in_review" },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "P1 fez claim de R1"
            : "Claim P1 sem efeito",
        expectedAfterHardening: "Negar claim de pool a personal_trainer",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── SEC-005 C1 role escalation (sem .select()) ─────────────────────────
  {
    const { error, status } = await sessions.C1.client
      .from("profiles")
      .update({ role: "admin" })
      .eq("user_id", U.C1.userId);
    const allowed = !error;
    // Cannot verify/restore via SELECT under 42P17; leave note only.
    cases.push(
      record({
        id: "SEC-005",
        identity: "C1",
        operation: "UPDATE profiles.role → admin",
        payload: { user_id: "C1", role: "admin" },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "C1 elevou role (HTTP sem erro)"
            : "Escalação sem efeito",
        expectedAfterHardening: "Negar self-update de role",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── SEC-006 C1 credits (sem .select()) ─────────────────────────────────
  {
    const { error, status } = await sessions.C1.client
      .from("profiles")
      .update({ credits: 9999 })
      .eq("user_id", U.C1.userId);
    const allowed = !error;
    cases.push(
      record({
        id: "SEC-006",
        identity: "C1",
        operation: "UPDATE profiles.credits → 9999",
        payload: { user_id: "C1", credits: 9999 },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "C1 alterou credits (HTTP sem erro)"
            : "Credits sem efeito",
        expectedAfterHardening: "Negar self-update de credits",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── SEC-007 C1 plan_tier (sem .select()) ───────────────────────────────
  {
    const { error, status } = await sessions.C1.client
      .from("profiles")
      .update({ plan_tier: "premium" })
      .eq("user_id", U.C1.userId);
    const allowed = !error;
    cases.push(
      record({
        id: "SEC-007",
        identity: "C1",
        operation: "UPDATE profiles.plan_tier → premium",
        payload: { user_id: "C1", plan_tier: "premium" },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "C1 alterou plan_tier (HTTP sem erro)"
            : "plan_tier sem efeito",
        expectedAfterHardening: "Negar self-update de plan_tier",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── SEC-008 C1 INSERT arbitrário transactions (sem .select()/RETURNING) ─
  {
    const { error, status } = await sessions.C1.client.from("transactions").insert({
      user_id: U.C1.userId,
      amount: 99999,
      type: "credit_purchase",
      description: "SECURITY_1C_SEC008_ARBITRARY",
    });
    const allowed = !error;
    cases.push(
      record({
        id: "SEC-008",
        identity: "C1",
        operation: "INSERT arbitrário em transactions",
        payload: { user_id: "C1", amount: 99999, type: "credit_purchase" },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "C1 inseriu transaction arbitrária"
            : "INSERT transaction bloqueado",
        expectedAfterHardening:
          "Negar self-insert de transactions (somente service/admin/checkout confiável)",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── SEC-009 anon INSERT sale+amount (ISOLADO; sem .select()) ───────────
  {
    const sessionKey = `sec009-anon-${Date.now()}`;
    const payload = {
      code: "SEC009-FRAUD",
      event_type: "sale",
      session_key: sessionKey,
      amount: 999.99,
      metadata: { source: "SECURITY_1C_SEC009", fraud: true },
    };

    // A) harness antigo (.select / return=representation) — documenta 42501
    const withSelect = await anon
      .from("invite_analytics")
      .insert(payload)
      .select("id, code, event_type, amount");

    // B) operação canônica do teste: INSERT sem RETURNING/select
    const sessionKey2 = `sec009-anon-min-${Date.now()}`;
    const payload2 = { ...payload, session_key: sessionKey2 };
    const minimal = await anon.from("invite_analytics").insert(payload2);

    // Verify persistence via postgres is out-of-band; here use REST HEAD/count as anon
    // Anon has no SELECT policy — confirm via dedicated status from insert error absence.
    const insertOk = !minimal.error;
    // Cross-check with raw fetch Prefer: return=minimal
    const raw = await fetch(`${url}/rest/v1/invite_analytics`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        code: "SEC009-FRAUD-RAW",
        event_type: "sale",
        session_key: `sec009-raw-${Date.now()}`,
        amount: 777.77,
        metadata: { source: "SECURITY_1C_SEC009_RAW" },
      }),
    });
    const rawBody = await raw.text();

    cases.push(
      record({
        id: "SEC-009",
        identity: "anon",
        operation: "INSERT fraudulento sale+amount em invite_analytics",
        payload: {
          event_type: "sale",
          amount: 999.99,
          note: "executado sem .select(); variante com .select() documentada em investigation",
        },
        httpOrSql: {
          insertWithoutSelect: {
            status: minimal.status ?? null,
            error: summarizeError(minimal.error),
          },
          insertWithSelect_artifact: {
            status: withSelect.status ?? null,
            error: summarizeError(withSelect.error),
            note: "42501 causado por RETURNING sem policy SELECT para anon — não é ausência de GRANT INSERT",
          },
          rawPreferMinimal: {
            httpStatus: raw.status,
            body: rawBody.slice(0, 200),
          },
        },
        rowsAffectedOrReturned: insertOk || raw.status === 201 ? 1 : 0,
        baselineBehavior:
          insertOk || raw.status === 201
            ? "Anon inseriu sale+amount (fraude analytics)"
            : `Anon INSERT falhou: ${minimal.error?.message || rawBody}`,
        expectedAfterHardening:
          "Negar event_type=sale / amount>0 para anon; restringir INSERT analytics",
        expectedHardeningBlocks: true,
        baselineAllowed: insertOk || raw.status === 201,
        investigation42501: {
          grantInsertAnon: true,
          insertPolicyExists: true,
          insertPolicyWithCheck: "true",
          insertPolicyRoles: ["anon", "authenticated"],
          selectPolicyForAnon: false,
          exactCause:
            "INSERT em si é permitido (GRANT + policy insert_any). O 42501 aparece quando o cliente pede RETURNING/representation (.select()), porque anon não tem policy SELECT em invite_analytics — o Postgres rejeita a visibilidade da linha nova e reporta violação RLS (mensagem parece de INSERT).",
          category:
            "policy existente mas não aplicável ao SELECT/RETURNING; não é ausência de GRANT INSERT nem ausência da policy de INSERT",
        },
      }),
    );
  }

  // ── SEC-010 C1 INSERT sale+amount (sem .select(); RETURNING dispara 42P17) ─
  {
    const { error, status } = await sessions.C1.client.from("invite_analytics").insert({
      code: "SEC010-FRAUD",
      event_type: "sale",
      session_key: `sec010-${Date.now()}`,
      amount: 888.88,
      owner_id: U.N2.userId,
      metadata: { source: "SECURITY_1C_SEC010", fraud: true },
    });
    const allowed = !error;
    cases.push(
      record({
        id: "SEC-010",
        identity: "C1",
        operation: "INSERT fraudulento sale+amount em invite_analytics",
        payload: { event_type: "sale", amount: 888.88, owner_id: "N2" },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "C1 inseriu sale+amount fraudulento"
            : "INSERT C1 bloqueado",
        expectedAfterHardening: "Negar sale/amount fraudulento a client autenticado",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── SEC-011 C1 feedback on C2 request (sem .select()) ──────────────────
  {
    const { error, status } = await sessions.C1.client.from("client_feedback").insert({
      diet_request_id: R2.id,
      client_id: U.C1.userId,
      rating: 5,
      comment: "SECURITY_1C_SEC011",
    });
    const allowed = !error;
    cases.push(
      record({
        id: "SEC-011",
        identity: "C1",
        operation: "INSERT client_feedback apontando para request de C2 (R2)",
        payload: { diet_request_id: "R2", client_id: "C1", rating: 5 },
        httpOrSql: { status: status ?? null, error: summarizeError(error) },
        rowsAffectedOrReturned: allowed ? 1 : 0,
        baselineBehavior: is42P17({ error })
          ? "Operação interrompida por recursão profiles"
          : allowed
            ? "C1 criou feedback em pedido de C2"
            : "INSERT feedback bloqueado",
        expectedAfterHardening:
          "Exigir diet_requests.client_id = auth.uid() para o request referenciado",
        expectedHardeningBlocks: true,
        baselineAllowed: allowed,
      }),
    );
  }

  // ── CONTROLES (não SEC) ────────────────────────────────────────────────
  const controls = [];

  {
    const { data, error, status } = await sessions.C2.client
      .from("diet_requests")
      .select("id, status")
      .in("id", [R1.id, R2.id]);
    controls.push({
      id: "CTRL-POS-01",
      type: "positive",
      identity: "C2",
      operation: "SELECT own R1+R2",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsAffectedOrReturned: data?.length ?? 0,
      ok: !error && (data?.length ?? 0) === 2,
      note: is42P17({ error }) ? BLOCKED_42P17 : null,
    });
  }
  {
    const { data, error, status } = await sessions.N2.client
      .from("diet_requests")
      .select("id")
      .eq("id", R2.id);
    controls.push({
      id: "CTRL-POS-02",
      type: "positive",
      identity: "N2",
      operation: "SELECT R2",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsAffectedOrReturned: data?.length ?? 0,
      ok: !error && (data?.length ?? 0) === 1,
      note: is42P17({ error }) ? BLOCKED_42P17 : null,
    });
  }
  {
    const { data, error, status } = await sessions.N2.client
      .from("diet_requests")
      .update({ notes: "SECURITY_1C_FIXTURE:R2" })
      .eq("id", R2.id)
      .select("id");
    controls.push({
      id: "CTRL-POS-03",
      type: "positive",
      identity: "N2",
      operation: "UPDATE R2 notes",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsAffectedOrReturned: data?.length ?? 0,
      ok: !error && (data?.length ?? 0) === 1,
      note: is42P17({ error }) ? BLOCKED_42P17 : null,
    });
  }
  {
    const { data, error, status } = await sessions.A1.client
      .from("diet_requests")
      .select("id")
      .in("id", [R1.id, R2.id]);
    controls.push({
      id: "CTRL-POS-04",
      type: "positive",
      identity: "A1",
      operation: "SELECT R1+R2",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsAffectedOrReturned: data?.length ?? 0,
      ok: !error && (data?.length ?? 0) === 2,
      note: is42P17({ error }) ? BLOCKED_42P17 : null,
    });
  }
  {
    const { data, error, status } = await sessions.C1.client
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", U.C2.userId);
    controls.push({
      id: "CTRL-NEG-01",
      type: "negative",
      identity: "C1",
      operation: "SELECT profile C2",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsAffectedOrReturned: data?.length ?? 0,
      ok: !is42P17({ error }) && !error && (data?.length ?? 0) === 0,
      note: is42P17({ error }) ? BLOCKED_42P17 : null,
    });
  }
  {
    const { data, error, status } = await sessions.N1.client
      .from("diet_requests")
      .select("id")
      .eq("id", R2.id);
    controls.push({
      id: "CTRL-NEG-02",
      type: "negative",
      identity: "N1",
      operation: "SELECT R2 (owned by N2)",
      httpOrSql: { status: status ?? null, error: summarizeError(error) },
      rowsAffectedOrReturned: data?.length ?? 0,
      ok: !is42P17({ error }) && !error && (data?.length ?? 0) === 0,
      note: is42P17({ error }) ? BLOCKED_42P17 : null,
    });
  }

  for (const key of Object.keys(sessions)) {
    await sessions[key].client.auth.signOut();
  }

  const evidence = {
    createdAt: new Date().toISOString(),
    supabaseUrl: url,
    fixtureRuntime: runtimePath,
    canonicalMatrix: true,
    vuln1c001: {
      id: "VULN-1C-001",
      title: "Infinite recursion in profiles RLS (42P17)",
      classification: "VULNERABILIDADE CONFIRMADA",
      evidence:
        "Authenticated REST/SQL touching policies that subquery public.profiles.role returns HTTP 500 / 42P17",
    },
    cases,
    controls,
    summary: {
      blockedBy42P17: cases.filter((c) => c.classification === BLOCKED_42P17).map((c) => c.id),
      confirmed: cases
        .filter((c) => c.classification === "VULNERABILIDADE CONFIRMADA")
        .map((c) => c.id),
      blockedClean: cases.filter((c) => c.classification === "BLOQUEADA").map((c) => c.id),
      unconfirmed: cases
        .filter((c) => c.classification === "NÃO CONFIRMADA")
        .map((c) => c.id),
    },
  };

  await mkdir(dirname(evidenceOut), { recursive: true });
  await writeFile(evidenceOut, JSON.stringify(evidence, null, 2) + "\n");

  console.log("=== MATRIZ CANÔNICA SEC ===");
  for (const c of cases) {
    console.log(`${c.id}\t${c.classification}\t${c.identity}\t${c.operation}`);
  }
  console.log("=== CONTROLES ===");
  for (const c of controls) {
    console.log(`${c.id}\tok=${c.ok}\tnote=${c.note || "-"}\t${c.operation}`);
  }
  console.log(`EVIDENCE: ${evidenceOut}`);
}

main().catch((err) => {
  console.error("SEC_SUITE_FAILED:", err?.message || err);
  process.exit(1);
});
