#!/usr/bin/env node
/**
 * Security 1E.1A — Hardening de identidade privilegiada (role / approved).
 *
 * - NÃO altera results-1c1.json
 * - Service role LOCAL apenas para prepare/teardown e signup admin-channel
 * - JWT de usuário normal para todas as ações sob teste
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

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

function has42P17(error) {
  return !!(error && /42P17|infinite recursion/i.test(error.message || ""));
}

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
    .select("user_id, role, credits, plan_tier, approved, full_name, phone, client_data, crn_number, deleted_at")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(`getProfile: ${error.message}`);
  return data;
}

async function restoreC1(admin, c1Id) {
  const { error } = await admin
    .from("profiles")
    .update({
      role: "client",
      credits: 0,
      plan_tier: "basic",
      approved: false,
      deleted_at: null,
      full_name: "Fixture Client C1",
      phone: null,
      client_data: {},
      crn_number: null,
    })
    .eq("user_id", c1Id);
  if (error) throw new Error(`restoreC1: ${error.message}`);
}

async function restoreProfessional(admin, userId, role) {
  const { error } = await admin
    .from("profiles")
    .update({
      role,
      approved: false,
      deleted_at: null,
      crn_number: role === "nutritionist" ? "CRN-1 12345" : null,
    })
    .eq("user_id", userId);
  if (error) throw new Error(`restoreProfessional ${role}: ${error.message}`);
}

function uniqueEmail(prefix) {
  return `${prefix}-${randomBytes(4).toString("hex")}@local.test`;
}

async function signupWithMeta(url, anonKey, email, password, meta) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: meta },
  });
  return { client, data, error };
}

async function deleteUserHard(admin, userId) {
  if (!userId) return;
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  assertLocal(url);
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const fixturesPath =
    process.env.FIXTURE_RUNTIME_IN?.trim() ||
    resolve(homedir(), "nutriaprova-security-1c-local/runtime/fixtures.json");
  const outPath =
    process.env.SEC_EVIDENCE_OUT?.trim() ||
    resolve("security/1e/evidence/results-1e1a.json");

  const fx = JSON.parse(await readFile(fixturesPath, "utf8"));
  const password = fx.password;
  const admin = adminClient(url, serviceKey);
  const c1Id = fx.users.C1.userId;
  const n1Id = fx.users.N1.userId;
  const p1Id = fx.users.P1.userId;
  const a1Id = fx.users.A1.userId;

  const results = [];
  const createdUsers = [];
  let recursionSeen = false;

  function record(entry) {
    if (has42P17(entry.httpOrSql?.error) || entry.classification?.includes?.("42P17")) {
      recursionSeen = true;
    }
    results.push(entry);
    const mark = entry.pass ? "PASS" : "FAIL";
    console.log(`${mark} ${entry.id}: ${entry.operation}`);
  }

  // ─── A-01 C1 UPDATE role=admin ─────────────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const before = await getProfile(admin, c1Id);
    const { error } = await client.from("profiles").update({ role: "admin" }).eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const blocked = after.role === "client" && after.role !== "admin";
    record({
      id: "A-01",
      operation: "C1 direct UPDATE role='admin'",
      expected: "BLOQUEADO",
      httpOrSql: { error: summarizeError(error) },
      before: { role: before.role },
      after: { role: after.role },
      pass: blocked,
      classification: blocked ? "BLOQUEADO" : "FALHA — escalação",
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-02 C1 UPDATE role=nutritionist ──────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error } = await client
      .from("profiles")
      .update({ role: "nutritionist" })
      .eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const blocked = after.role === "client";
    record({
      id: "A-02",
      operation: "C1 direct UPDATE role='nutritionist'",
      expected: "BLOQUEADO",
      httpOrSql: { error: summarizeError(error) },
      after: { role: after.role },
      pass: blocked,
      classification: blocked ? "BLOQUEADO" : "FALHA",
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-03 C1 UPDATE approved=true ──────────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error } = await client
      .from("profiles")
      .update({ approved: true })
      .eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const blocked = after.approved === false;
    record({
      id: "A-03",
      operation: "C1 direct UPDATE approved=true",
      expected: "BLOQUEADO",
      httpOrSql: { error: summarizeError(error) },
      after: { approved: after.approved },
      pass: blocked,
      classification: blocked ? "BLOQUEADO" : "FALHA",
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-04 signup metadata role=admin → client ──────────────────────────
  {
    const email = uniqueEmail("a04-adminmeta");
    const { data, error: signErr } = await signupWithMeta(url, anonKey, email, password, {
      role: "admin",
      full_name: "A04 Admin Meta",
    });
    const uid = data?.user?.id;
    if (uid) createdUsers.push(uid);
    // trigger async — wait briefly
    let profile = null;
    for (let i = 0; i < 10 && uid; i++) {
      const { data: p } = await admin.from("profiles").select("*").eq("user_id", uid).maybeSingle();
      if (p) {
        profile = p;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const pass = !!profile && profile.role === "client" && profile.role !== "admin";
    record({
      id: "A-04",
      operation: "signup metadata role='admin'",
      expected: "profile role=client (nunca admin)",
      httpOrSql: { error: summarizeError(signErr) },
      after: profile ? { role: profile.role, approved: profile.approved } : null,
      pass,
      classification: pass ? "OK" : "FALHA",
    });
    if (uid) await deleteUserHard(admin, uid);
  }

  // ─── A-05 signup client ────────────────────────────────────────────────
  {
    const email = uniqueEmail("a05-client");
    const { data, error: signErr } = await signupWithMeta(url, anonKey, email, password, {
      role: "client",
      full_name: "A05 Client",
    });
    const uid = data?.user?.id;
    if (uid) createdUsers.push(uid);
    let profile = null;
    for (let i = 0; i < 10 && uid; i++) {
      const { data: p } = await admin.from("profiles").select("*").eq("user_id", uid).maybeSingle();
      if (p) {
        profile = p;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const pass = !!profile && profile.role === "client" && !signErr;
    record({
      id: "A-05",
      operation: "signup client",
      expected: "OK role=client",
      httpOrSql: { error: summarizeError(signErr) },
      after: profile ? { role: profile.role } : null,
      pass,
    });
    if (uid) await deleteUserHard(admin, uid);
  }

  // ─── A-06 signup nutritionist ──────────────────────────────────────────
  {
    const email = uniqueEmail("a06-nutri");
    const { data, error: signErr } = await signupWithMeta(url, anonKey, email, password, {
      role: "nutritionist",
      full_name: "A06 Nutri",
      crn_number: "CRN-1 12345",
    });
    const uid = data?.user?.id;
    if (uid) createdUsers.push(uid);
    let profile = null;
    for (let i = 0; i < 10 && uid; i++) {
      const { data: p } = await admin.from("profiles").select("*").eq("user_id", uid).maybeSingle();
      if (p) {
        profile = p;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const pass =
      !!profile && profile.role === "nutritionist" && profile.approved === false && !signErr;
    record({
      id: "A-06",
      operation: "signup nutritionist",
      expected: "role=nutritionist approved=false",
      httpOrSql: { error: summarizeError(signErr) },
      after: profile ? { role: profile.role, approved: profile.approved, credits: profile.credits } : null,
      pass,
    });
    if (uid) await deleteUserHard(admin, uid);
  }

  // ─── A-07 signup personal_trainer ──────────────────────────────────────
  {
    const email = uniqueEmail("a07-pt");
    const { data, error: signErr } = await signupWithMeta(url, anonKey, email, password, {
      role: "personal_trainer",
      full_name: "A07 PT",
    });
    const uid = data?.user?.id;
    if (uid) createdUsers.push(uid);
    let profile = null;
    for (let i = 0; i < 10 && uid; i++) {
      const { data: p } = await admin.from("profiles").select("*").eq("user_id", uid).maybeSingle();
      if (p) {
        profile = p;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const pass =
      !!profile && profile.role === "personal_trainer" && profile.approved === false && !signErr;
    record({
      id: "A-07",
      operation: "signup personal_trainer",
      expected: "role=personal_trainer approved=false",
      httpOrSql: { error: summarizeError(signErr) },
      after: profile ? { role: profile.role, approved: profile.approved } : null,
      pass,
    });
    if (uid) await deleteUserHard(admin, uid);
  }

  // ─── A-08 OAuth/pendingSignup equivalente: client → nutri via RPC ──────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { data, error } = await client.rpc("request_own_role_transition", {
      target_role: "nutritionist",
      p_crn_number: "CRN-1 99999",
    });
    const after = await getProfile(admin, c1Id);
    const pass =
      !error && after.role === "nutritionist" && after.approved === false;
    record({
      id: "A-08",
      operation: "pendingSignup-equivalent RPC client→nutritionist",
      expected: "OK",
      httpOrSql: { error: summarizeError(error), dataRole: data?.role ?? null },
      after: { role: after.role, approved: after.approved },
      pass,
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-09 RPC client→nutritionist ──────────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error } = await client.rpc("request_own_role_transition", {
      target_role: "nutritionist",
      p_crn_number: "CRN-1 11111",
    });
    const after = await getProfile(admin, c1Id);
    const pass = !error && after.role === "nutritionist" && after.approved === false;
    record({
      id: "A-09",
      operation: "RPC client→nutritionist",
      expected: "role=nutritionist approved=false",
      httpOrSql: { error: summarizeError(error) },
      after: { role: after.role, approved: after.approved },
      pass,
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-10 RPC client→personal_trainer ──────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error } = await client.rpc("request_own_role_transition", {
      target_role: "personal_trainer",
    });
    const after = await getProfile(admin, c1Id);
    const pass = !error && after.role === "personal_trainer" && after.approved === false;
    record({
      id: "A-10",
      operation: "RPC client→personal_trainer",
      expected: "role=personal_trainer approved=false",
      httpOrSql: { error: summarizeError(error) },
      after: { role: after.role, approved: after.approved },
      pass,
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-11 nutritionist→client ──────────────────────────────────────────
  {
    await restoreProfessional(admin, n1Id, "nutritionist");
    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const { error } = await client.rpc("request_own_role_transition", {
      target_role: "client",
    });
    const after = await getProfile(admin, n1Id);
    const pass = !error && after.role === "client";
    record({
      id: "A-11",
      operation: "RPC nutritionist→client",
      expected: "OK",
      httpOrSql: { error: summarizeError(error) },
      after: { role: after.role },
      pass,
    });
    await restoreProfessional(admin, n1Id, "nutritionist");
  }

  // ─── A-12 non-admin admin_set_professional_approval ────────────────────
  {
    await restoreProfessional(admin, n1Id, "nutritionist");
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const before = await getProfile(admin, n1Id);
    const { error } = await client.rpc("admin_set_professional_approval", {
      target_user_id: n1Id,
      p_approved: true,
    });
    const after = await getProfile(admin, n1Id);
    const denied = !!error && after.approved === before.approved;
    record({
      id: "A-12",
      operation: "C1 chama admin_set_professional_approval",
      expected: "NEGADO",
      httpOrSql: { error: summarizeError(error) },
      after: { approved: after.approved },
      pass: denied,
    });
  }

  // ─── A-13 A1 aprova/suspende profissional ──────────────────────────────
  {
    await restoreProfessional(admin, n1Id, "nutritionist");
    const { client } = await login(url, anonKey, fx.users.A1.email, password);
    const { error: e1 } = await client.rpc("admin_set_professional_approval", {
      target_user_id: n1Id,
      p_approved: true,
    });
    const mid = await getProfile(admin, n1Id);
    const { error: e2 } = await client.rpc("admin_set_professional_approval", {
      target_user_id: n1Id,
      p_approved: false,
    });
    const after = await getProfile(admin, n1Id);
    const pass = !e1 && !e2 && mid.approved === true && after.approved === false;
    record({
      id: "A-13",
      operation: "A1 aprova e suspende profissional",
      expected: "OK",
      httpOrSql: { error: summarizeError(e1 || e2) },
      mid: { approved: mid.approved },
      after: { approved: after.approved },
      pass,
    });
    await restoreProfessional(admin, n1Id, "nutritionist");
  }

  // ─── A-14 UPDATE legítimo full_name ────────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error } = await client
      .from("profiles")
      .update({ full_name: "Fixture Client C1 Updated" })
      .eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const pass = !error && after.full_name === "Fixture Client C1 Updated";
    record({
      id: "A-14",
      operation: "UPDATE legítimo full_name",
      expected: "OK",
      httpOrSql: { error: summarizeError(error) },
      after: { full_name: after.full_name },
      pass,
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-15 UPDATE phone/client_data ─────────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const payload = { phone: "11999990000", client_data: { note: "a15" } };
    const { error } = await client.from("profiles").update(payload).eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const pass =
      !error && after.phone === "11999990000" && after.client_data?.note === "a15";
    record({
      id: "A-15",
      operation: "UPDATE legítimo phone/client_data",
      expected: "OK",
      httpOrSql: { error: summarizeError(error) },
      after: { phone: after.phone, client_data: after.client_data },
      pass,
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-16 soft_delete + recovery ───────────────────────────────────────
  {
    await restoreC1(admin, c1Id);
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error: delErr } = await client.rpc("soft_delete_own_profile");
    const mid = await getProfile(admin, c1Id);
    const { error: recErr } = await client
      .from("profiles")
      .update({ deleted_at: null })
      .eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const pass =
      !delErr && !!mid.deleted_at && !recErr && after.deleted_at === null;
    record({
      id: "A-16",
      operation: "soft_delete_own_profile + recovery",
      expected: "OK",
      httpOrSql: {
        deleteError: summarizeError(delErr),
        recoverError: summarizeError(recErr),
      },
      mid: { deleted_at: mid.deleted_at },
      after: { deleted_at: after.deleted_at },
      pass,
    });
    await restoreC1(admin, c1Id);
  }

  // ─── A-17 nenhum 42P17 ─────────────────────────────────────────────────
  {
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error: e1 } = await client
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", c1Id)
      .maybeSingle();
    const { client: a1 } = await login(url, anonKey, fx.users.A1.email, password);
    const { error: e2 } = await a1
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", n1Id)
      .maybeSingle();
    const clear = !has42P17(e1) && !has42P17(e2) && !recursionSeen;
    record({
      id: "A-17",
      operation: "nenhum 42P17 em SELECT autenticado",
      expected: "CLEAR",
      httpOrSql: {
        c1Error: summarizeError(e1),
        a1Error: summarizeError(e2),
        suiteRecursionSeen: recursionSeen,
      },
      pass: clear,
    });
  }

  // ─── Smoke: INSERT direto bloqueado ────────────────────────────────────
  {
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const hex = randomBytes(16).toString("hex");
    const fakeId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    const { error } = await client.from("profiles").insert({
      user_id: fakeId,
      full_name: "Should Fail",
      role: "admin",
    });
    const pass = !!error;
    record({
      id: "A-SMOKE-INSERT",
      operation: "authenticated INSERT profiles",
      expected: "NEGADO",
      httpOrSql: { error: summarizeError(error) },
      pass,
    });
  }

  // Restore fixtures
  await restoreC1(admin, c1Id);
  await restoreProfessional(admin, n1Id, "nutritionist");
  await restoreProfessional(admin, p1Id, "personal_trainer");
  await admin
    .from("profiles")
    .update({ role: "admin", approved: true, deleted_at: null })
    .eq("user_id", a1Id);

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const evidence = {
    createdAt: new Date().toISOString(),
    stage: "1E.1A",
    supabaseUrl: url,
    summary: { total: results.length, passed, failed, recursionSeen },
    adminBootstrapBoundary:
      "Admin creation/promotion is NOT available via authenticated RPC or signup metadata. Use service_role / operational SQL only.",
    results,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);
  console.log(`SUMMARY: ${passed}/${results.length} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("1E.1A_SUITE_FAILED:", err?.message || err);
  process.exit(1);
});
