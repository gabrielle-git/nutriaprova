#!/usr/bin/env node
/**
 * Security 1E.1B — Hardening de estado econômico (credits / plan_tier).
 * NÃO altera results-1c1.json nem results-1e1a.json.
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
    resolve("security/1e/evidence/results-1e1b.json");

  const fx = JSON.parse(await readFile(fixturesPath, "utf8"));
  const password = fx.password;
  const admin = adminClient(url, serviceKey);
  const c1Id = fx.users.C1.userId;
  const n1Id = fx.users.N1.userId;
  const a1Id = fx.users.A1.userId;
  const r1Id = fx.requests.R1.id;
  const c2Id = fx.users.C2.userId;

  const results = [];
  const findings = [
    {
      id: "CLINIC_GRANT_DIVERGENCE",
      note:
        "PlanCheckoutModal/RPC grant clinic=9999; TIER_CONFIG initialCoins=0 + unlimitedValidations. Preserved checkout grant; job cost clinic=0.",
    },
    {
      id: "SEC-008_PENDING",
      note: "Arbitrary INSERT on transactions by authenticated may still succeed. Not closed in 1E.1B.",
    },
  ];

  function record(entry) {
    results.push(entry);
    console.log(`${entry.pass ? "PASS" : "FAIL"} ${entry.id}: ${entry.operation}`);
  }

  async function resetN1(overrides = {}) {
    const { error } = await admin
      .from("profiles")
      .update({
        role: "nutritionist",
        credits: 5,
        plan_tier: "basic",
        approved: false,
        deleted_at: null,
        crn_number: "CRN-1 12345",
        ...overrides,
      })
      .eq("user_id", n1Id);
    if (error) throw new Error(`resetN1: ${error.message}`);
  }

  async function resetC1() {
    await admin
      .from("profiles")
      .update({
        role: "client",
        credits: 0,
        plan_tier: "basic",
        approved: false,
        deleted_at: null,
      })
      .eq("user_id", c1Id);
  }

  async function resetR1() {
    await admin
      .from("diet_requests")
      .update({
        client_id: c2Id,
        status: "pending",
        nutritionist_id: null,
        assigned_nutritionist_id: null,
        notes: "SECURITY_1C_FIXTURE:R1",
      })
      .eq("id", r1Id);
  }

  // ─── B-01 C1 UPDATE credits ────────────────────────────────────────────
  {
    await resetC1();
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const before = await getProfile(admin, c1Id);
    const { error } = await client.from("profiles").update({ credits: 999 }).eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const pass = after.credits === before.credits;
    record({
      id: "B-01",
      operation: "C1 direct UPDATE credits",
      expected: "BLOQUEADO",
      httpOrSql: { error: summarizeError(error) },
      before: { credits: before.credits },
      after: { credits: after.credits },
      pass,
    });
  }

  // ─── B-02 C1 UPDATE plan_tier ──────────────────────────────────────────
  {
    await resetC1();
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const before = await getProfile(admin, c1Id);
    const { error } = await client
      .from("profiles")
      .update({ plan_tier: "clinic" })
      .eq("user_id", c1Id);
    const after = await getProfile(admin, c1Id);
    const pass = after.plan_tier === before.plan_tier;
    record({
      id: "B-02",
      operation: "C1 direct UPDATE plan_tier",
      expected: "BLOQUEADO",
      httpOrSql: { error: summarizeError(error) },
      after: { plan_tier: after.plan_tier },
      pass,
    });
  }

  // ─── B-03 ensure_trial_credits ─────────────────────────────────────────
  {
    // Clear N1 txs that would block trial — use dedicated temp nutri via service signup
    const email = `b03-trial-${randomBytes(3).toString("hex")}@local.test`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "nutritionist", full_name: "B03 Trial", crn_number: "CRN-1 55555" },
    });
    if (createErr) throw createErr;
    const uid = created.user.id;
    // Wait for trigger
    for (let i = 0; i < 15; i++) {
      const { data: p } = await admin.from("profiles").select("*").eq("user_id", uid).maybeSingle();
      if (p) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    // Force eligible state: nutritionist, credits 0, no txs (delete any)
    await admin.from("transactions").delete().eq("user_id", uid);
    await admin
      .from("profiles")
      .update({ role: "nutritionist", credits: 0, plan_tier: "basic" })
      .eq("user_id", uid);

    const { client } = await login(url, anonKey, email, password);
    const { data, error } = await client.rpc("ensure_trial_credits");
    const after = await getProfile(admin, uid);
    const pass = !error && after.credits === 3;
    record({
      id: "B-03",
      operation: "nutritionist elegível ensure_trial_credits",
      expected: "créditos=3",
      httpOrSql: { error: summarizeError(error), dataCredits: data?.credits ?? null },
      after: { credits: after.credits },
      pass,
    });

    // ─── B-04 segunda chamada ────────────────────────────────────────────
    const before2 = after.credits;
    const { error: e2 } = await client.rpc("ensure_trial_credits");
    const after2 = await getProfile(admin, uid);
    const pass2 = !e2 && after2.credits === before2;
    record({
      id: "B-04",
      operation: "segunda chamada ensure_trial_credits",
      expected: "não duplicar",
      httpOrSql: { error: summarizeError(e2) },
      after: { credits: after2.credits },
      pass: pass2,
    });

    await admin.from("profiles").delete().eq("user_id", uid);
    await admin.auth.admin.deleteUser(uid);
  }

  // ─── B-05 consume_job_credit saldo suficiente ──────────────────────────
  {
    await resetN1({ credits: 5, plan_tier: "basic" });
    await resetR1();
    // Claim as service then debit as N1 (simula job já assumido)
    await admin
      .from("diet_requests")
      .update({ status: "in_review", nutritionist_id: n1Id, assigned_nutritionist_id: n1Id })
      .eq("id", r1Id);

    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const before = await getProfile(admin, n1Id);
    const { data, error } = await client.rpc("consume_job_credit", { request_id: r1Id });
    const after = await getProfile(admin, n1Id);
    const { data: txs } = await admin
      .from("transactions")
      .select("amount, type")
      .eq("user_id", n1Id)
      .eq("type", "job_acceptance")
      .order("created_at", { ascending: false })
      .limit(1);
    const pass =
      !error && after.credits === before.credits - 1 && data?.cost === 1 && txs?.[0]?.amount === -1;
    record({
      id: "B-05",
      operation: "consume_job_credit saldo suficiente",
      expected: "saldo -1 + transaction",
      httpOrSql: { error: summarizeError(error), data },
      before: { credits: before.credits },
      after: { credits: after.credits },
      pass,
    });
    await resetR1();
  }

  // ─── B-06 saldo insuficiente ───────────────────────────────────────────
  {
    await resetN1({ credits: 0, plan_tier: "basic" });
    await resetR1();
    await admin
      .from("diet_requests")
      .update({ status: "in_review", nutritionist_id: n1Id })
      .eq("id", r1Id);
    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const before = await getProfile(admin, n1Id);
    const { error } = await client.rpc("consume_job_credit", { request_id: r1Id });
    const after = await getProfile(admin, n1Id);
    const pass = !!error && after.credits === 0 && after.credits === before.credits;
    record({
      id: "B-06",
      operation: "consume_job_credit saldo insuficiente",
      expected: "negado, credits>=0",
      httpOrSql: { error: summarizeError(error) },
      after: { credits: after.credits },
      pass,
    });
    await resetR1();
  }

  // ─── B-07 clinic custo 0 ───────────────────────────────────────────────
  {
    await resetN1({ credits: 10, plan_tier: "clinic" });
    await resetR1();
    await admin
      .from("diet_requests")
      .update({ status: "in_review", nutritionist_id: n1Id })
      .eq("id", r1Id);
    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const before = await getProfile(admin, n1Id);
    const { data, error } = await client.rpc("consume_job_credit", { request_id: r1Id });
    const after = await getProfile(admin, n1Id);
    const pass = !error && data?.cost === 0 && after.credits === before.credits;
    record({
      id: "B-07",
      operation: "clinic consume_job_credit custo 0",
      expected: "cost=0 credits intactos",
      httpOrSql: { error: summarizeError(error), data },
      pass,
    });
    await resetR1();
    await resetN1({ credits: 5, plan_tier: "basic" });
  }

  // ─── B-08 A1 admin_adjust_credits ──────────────────────────────────────
  {
    await resetN1({ credits: 5 });
    const { client } = await login(url, anonKey, fx.users.A1.email, password);
    const { error } = await client.rpc("admin_adjust_credits", {
      target_user_id: n1Id,
      delta: 7,
      reason: "B-08 audit adjust",
    });
    const after = await getProfile(admin, n1Id);
    const pass = !error && after.credits === 12;
    record({
      id: "B-08",
      operation: "A1 admin_adjust_credits",
      expected: "OK",
      httpOrSql: { error: summarizeError(error) },
      after: { credits: after.credits },
      pass,
    });
    await resetN1({ credits: 5 });
  }

  // ─── B-09 C1 admin_adjust_credits negado ───────────────────────────────
  {
    await resetN1({ credits: 5 });
    const { client } = await login(url, anonKey, fx.users.C1.email, password);
    const { error } = await client.rpc("admin_adjust_credits", {
      target_user_id: n1Id,
      delta: 100,
      reason: "should fail",
    });
    const after = await getProfile(admin, n1Id);
    const pass = !!error && after.credits === 5;
    record({
      id: "B-09",
      operation: "C1 chama admin_adjust_credits",
      expected: "NEGADO",
      httpOrSql: { error: summarizeError(error) },
      after: { credits: after.credits },
      pass,
    });
  }

  // ─── B-10 downgrade freemium ───────────────────────────────────────────
  {
    await resetN1({ plan_tier: "premium", credits: 20 });
    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const { error } = await client.rpc("downgrade_own_plan_to_freemium");
    const after = await getProfile(admin, n1Id);
    const pass = !error && after.plan_tier === "freemium";
    record({
      id: "B-10",
      operation: "downgrade_own_plan_to_freemium",
      expected: "OK",
      httpOrSql: { error: summarizeError(error) },
      after: { plan_tier: after.plan_tier },
      pass,
    });
    await resetN1({ plan_tier: "basic", credits: 5 });
  }

  // ─── B-11 upgrade saldo interno suficiente ─────────────────────────────
  {
    await resetN1({ plan_tier: "freemium", credits: 3 });
    // Fabricate completed jobs for internal balance (>= 40 for basic)
    // Use service to insert completed diet_requests owned by N1
    const fabricated = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await admin
        .from("diet_requests")
        .insert({
          client_id: c2Id,
          nutritionist_id: n1Id,
          status: "completed",
          client_data: { fullName: `B11-${i}`, notes: "SECURITY_1E1B" },
          notes: "SECURITY_1E1B:B11",
        })
        .select("id")
        .single();
      if (error) throw new Error(`fabricate completed: ${error.message}`);
      fabricated.push(data.id);
    }
    // Clear prior upgrade debits for N1
    await admin.from("transactions").delete().eq("user_id", n1Id).eq("type", "plan_upgrade_balance_debit");

    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const before = await getProfile(admin, n1Id);
    const { data, error } = await client.rpc("activate_plan_with_internal_balance", {
      target_tier: "basic",
      billing_period: "monthly",
    });
    const after = await getProfile(admin, n1Id);
    const pass =
      !error &&
      data?.status === "activated" &&
      after.plan_tier === "basic" &&
      after.credits >= 20 &&
      after.credits >= before.credits;
    record({
      id: "B-11",
      operation: "upgrade com saldo interno suficiente",
      expected: "tier muda + grant server-side",
      httpOrSql: { error: summarizeError(error), data },
      before: { plan_tier: before.plan_tier, credits: before.credits },
      after: { plan_tier: after.plan_tier, credits: after.credits },
      pass,
    });
    for (const id of fabricated) {
      await admin.from("diet_requests").delete().eq("id", id);
    }
    await admin.from("transactions").delete().eq("user_id", n1Id).in("type", [
      "plan_upgrade_balance_debit",
      "plan_coin_grant",
    ]);
    await resetN1({ plan_tier: "basic", credits: 5 });
  }

  // ─── B-12 upgrade saldo insuficiente ───────────────────────────────────
  {
    await resetN1({ plan_tier: "freemium", credits: 3 });
    await admin.from("transactions").delete().eq("user_id", n1Id).eq("type", "plan_upgrade_balance_debit");
    // Ensure few completed (balance low) — delete fabricated notes if any remain
    const before = await getProfile(admin, n1Id);
    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const { data, error } = await client.rpc("activate_plan_with_internal_balance", {
      target_tier: "clinic",
      billing_period: "monthly",
    });
    const after = await getProfile(admin, n1Id);
    const pass =
      !error &&
      data?.status === "payment_required" &&
      after.plan_tier === before.plan_tier &&
      after.credits === before.credits;
    record({
      id: "B-12",
      operation: "upgrade saldo interno insuficiente",
      expected: "payment_required, sem mudança",
      httpOrSql: { error: summarizeError(error), data },
      after: { plan_tier: after.plan_tier, credits: after.credits },
      pass,
    });
    await resetN1({ plan_tier: "basic", credits: 5 });
  }

  // ─── B-13 tier inválido ────────────────────────────────────────────────
  {
    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const { error } = await client.rpc("activate_plan_with_internal_balance", {
      target_tier: "admin",
      billing_period: "monthly",
    });
    const pass = !!error;
    record({
      id: "B-13",
      operation: "tier inválido",
      expected: "NEGADO",
      httpOrSql: { error: summarizeError(error) },
      pass,
    });
  }

  // ─── B-14 injeção credits/amount via cliente ───────────────────────────
  {
    // RPC signature has no amount/credits params — attempting arbitrary update blocked
    const { client } = await login(url, anonKey, fx.users.N1.email, password);
    const before = await getProfile(admin, n1Id);
    const { error: upErr } = await client
      .from("profiles")
      .update({ credits: 9999, plan_tier: "clinic" })
      .eq("user_id", n1Id);
    const after = await getProfile(admin, n1Id);
    const pass =
      after.credits === before.credits &&
      after.plan_tier === before.plan_tier &&
      !!upErr;
    record({
      id: "B-14",
      operation: "tentativa injetar credits/plan_tier via cliente",
      expected: "bloqueado / sem parâmetro confiável",
      httpOrSql: { error: summarizeError(upErr) },
      after: { credits: after.credits, plan_tier: after.plan_tier },
      pass,
      note: "activate_plan_with_internal_balance não aceita amount/credits do browser",
    });
  }

  // ─── B-15 community milestone trigger ──────────────────────────────────
  {
    await resetN1({ credits: 5 });
    // Need a community post by N1 + 10 likes — check if tables exist
    const { data: post, error: postErr } = await admin
      .from("community_posts")
      .insert({
        author_id: n1Id,
        author_role: "nutritionist",
        author_name: "Fixture Nutri N1",
        author_initials: "N1",
        text: "SECURITY_1E1B community milestone",
      })
      .select("id")
      .single();

    if (postErr) {
      record({
        id: "B-15",
        operation: "community milestone",
        expected: "trigger continua",
        httpOrSql: { error: summarizeError(postErr) },
        pass: false,
        note: "community_posts insert failed — schema may differ",
      });
    } else {
      const before = await getProfile(admin, n1Id);
      // Insert 10 likes from distinct users — use service with synthetic user_ids if FK allows
      // Prefer real fixture users + create temps
      const likers = [c1Id, c2Id, fx.users.P1.userId, a1Id];
      const tempLikers = [];
      while (likers.length + tempLikers.length < 10) {
        const email = `b15-like-${randomBytes(2).toString("hex")}@local.test`;
        const { data: u } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: "client", full_name: "B15 Liker" },
        });
        if (u?.user?.id) {
          tempLikers.push(u.user.id);
          // wait profile
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      const allLikers = [...likers, ...tempLikers].slice(0, 10);
      let likeErr = null;
      for (const uid of allLikers) {
        const { error } = await admin.from("post_likes").insert({
          post_id: post.id,
          user_id: uid,
        });
        if (error) likeErr = error;
      }
      const after = await getProfile(admin, n1Id);
      const { data: txs } = await admin
        .from("transactions")
        .select("type, amount")
        .eq("user_id", n1Id)
        .eq("type", "community_likes_milestone")
        .order("created_at", { ascending: false })
        .limit(1);
      const pass =
        !likeErr && after.credits === before.credits + 1 && txs?.[0]?.amount === 1;
      record({
        id: "B-15",
        operation: "community milestone trigger",
        expected: "credits+1 + transaction",
        httpOrSql: { error: summarizeError(likeErr) },
        before: { credits: before.credits },
        after: { credits: after.credits },
        pass,
      });
      await admin.from("post_likes").delete().eq("post_id", post.id);
      await admin.from("community_posts").delete().eq("id", post.id);
      for (const uid of tempLikers) {
        await admin.from("profiles").delete().eq("user_id", uid);
        await admin.auth.admin.deleteUser(uid);
      }
    }
    await resetN1({ credits: 5, plan_tier: "basic" });
  }

  // Restore fixtures
  await resetC1();
  await resetN1({ credits: 5, plan_tier: "basic" });
  await resetR1();
  await admin
    .from("profiles")
    .update({ role: "admin", approved: true })
    .eq("user_id", a1Id);

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const evidence = {
    createdAt: new Date().toISOString(),
    stage: "1E.1B",
    supabaseUrl: url,
    summary: { total: results.length, passed, failed },
    findings,
    results,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);
  console.log(`SUMMARY: ${passed}/${results.length} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("1E.1B_SUITE_FAILED:", err?.message || err);
  process.exit(1);
});
