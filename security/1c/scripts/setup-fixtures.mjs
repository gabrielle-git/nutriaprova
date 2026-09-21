#!/usr/bin/env node
/**
 * Security 1C — setup de fixtures sintéticos (auditoria).
 *
 * Usa service role LOCAL apenas para preparar usuários/dados.
 * Valida login normal (anon + senha) por usuário — sem operações ofensivas.
 *
 * Env obrigatórias:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Env opcionais:
 *   FIXTURE_PASSWORD       — senha sintética compartilhada; se ausente, gera
 *   FIXTURE_RUNTIME_OUT    — path do JSON runtime (default: fora do repo sugerido)
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

function assertLocalUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`SUPABASE_URL is not a valid URL: ${url}`);
  }
  const host = u.hostname;
  const local =
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local");
  if (!local) {
    throw new Error(
      `Refusing to run: SUPABASE_URL host "${host}" is not local. Fixtures are audit-only.`,
    );
  }
}

const ACTORS = [
  { key: "C1", email: "c1@local.test", role: "client", fullName: "Fixture Client C1" },
  { key: "C2", email: "c2@local.test", role: "client", fullName: "Fixture Client C2" },
  {
    key: "N1",
    email: "n1@local.test",
    role: "nutritionist",
    fullName: "Fixture Nutritionist N1",
    crn: "CRN-FIX-N1",
  },
  {
    key: "N2",
    email: "n2@local.test",
    role: "nutritionist",
    fullName: "Fixture Nutritionist N2",
    crn: "CRN-FIX-N2",
  },
  {
    key: "P1",
    email: "p1@local.test",
    role: "personal_trainer",
    fullName: "Fixture Personal Trainer P1",
  },
  { key: "A1", email: "a1@local.test", role: "admin", fullName: "Fixture Admin A1" },
];

const FAKE_CLIENT_DATA = {
  fullName: "Fixture Client C2",
  age: 30,
  goal: "audit-only-synthetic",
  notes: "SECURITY_1C_FIXTURE — not real patient data",
};

async function findUserIdByEmail(admin, email) {
  // Local audit: few users; paginate briefly.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data?.users ?? []).find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

async function upsertAuthUser(admin, actor, password) {
  const existingId = await findUserIdByEmail(admin, actor.email);
  const meta = {
    role: actor.role,
    full_name: actor.fullName,
    ...(actor.crn ? { crn_number: actor.crn } : {}),
  };

  if (existingId) {
    const { data, error } = await admin.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (error) throw error;
    return data.user.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: actor.email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw error;
  return data.user.id;
}

async function ensureProfile(admin, userId, actor) {
  const shouldApprove = actor.role !== "client";
  const patch = {
    full_name: actor.fullName,
    role: actor.role,
    approved: shouldApprove,
    ...(actor.crn ? { crn_number: actor.crn } : {}),
    deleted_at: null,
  };

  // Wait briefly for trigger handle_new_user on create.
  for (let i = 0; i < 10; i++) {
    const { data: existing, error: selErr } = await admin
      .from("profiles")
      .select("user_id, role, approved")
      .eq("user_id", userId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) {
      const { error: updErr } = await admin
        .from("profiles")
        .update(patch)
        .eq("user_id", userId);
      if (updErr) throw updErr;
      return;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Profile not created by trigger for ${actor.email}`);
}

async function upsertRequest(admin, { marker, clientId, status, nutritionistId, assignedId }) {
  // Idempotent via notes marker (notes is free text, nullable).
  const notes = `SECURITY_1C_FIXTURE:${marker}`;
  const { data: existing, error: findErr } = await admin
    .from("diet_requests")
    .select("id, client_id, status, nutritionist_id, assigned_nutritionist_id")
    .eq("notes", notes)
    .maybeSingle();
  if (findErr) throw findErr;

  const row = {
    client_id: clientId,
    status,
    nutritionist_id: nutritionistId,
    assigned_nutritionist_id: assignedId,
    client_data: FAKE_CLIENT_DATA,
    notes,
  };

  if (existing?.id) {
    const { data, error } = await admin
      .from("diet_requests")
      .update(row)
      .eq("id", existing.id)
      .select("id, client_id, status, nutritionist_id, assigned_nutritionist_id")
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from("diet_requests")
    .insert(row)
    .select("id, client_id, status, nutritionist_id, assigned_nutritionist_id")
    .single();
  if (error) throw error;
  return data;
}

async function loginAs(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: error.message };
  }
  const uid = data.user?.id ?? null;
  const hasJwt = Boolean(data.session?.access_token);
  await client.auth.signOut();
  return { ok: Boolean(uid && hasJwt), userId: uid };
}

function redactToken(token) {
  if (!token) return null;
  if (token.length <= 12) return "***";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  assertLocalUrl(url);
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const password =
    (process.env.FIXTURE_PASSWORD && String(process.env.FIXTURE_PASSWORD).trim()) ||
    `LocalAudit1c_${randomBytes(12).toString("base64url")}`;

  const runtimeOut =
    (process.env.FIXTURE_RUNTIME_OUT && String(process.env.FIXTURE_RUNTIME_OUT).trim()) ||
    resolve(homedir(), "nutriaprova-security-1c-local/runtime/fixtures.json");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const users = {};
  for (const actor of ACTORS) {
    const userId = await upsertAuthUser(admin, actor, password);
    await ensureProfile(admin, userId, actor);
    users[actor.key] = {
      key: actor.key,
      email: actor.email,
      role: actor.role,
      userId,
    };
    console.log(`USER ${actor.key}: ${userId}`);
  }

  const r1 = await upsertRequest(admin, {
    marker: "R1",
    clientId: users.C2.userId,
    status: "pending",
    nutritionistId: null,
    assignedId: null,
  });
  console.log(`FIXTURE R1: ${r1.id} status=${r1.status}`);

  const r2 = await upsertRequest(admin, {
    marker: "R2",
    clientId: users.C2.userId,
    status: "in_review",
    nutritionistId: users.N2.userId,
    assignedId: users.N2.userId,
  });
  console.log(`FIXTURE R2: ${r2.id} status=${r2.status}`);

  const logins = {};
  for (const actor of ACTORS) {
    const result = await loginAs(url, anonKey, actor.email, password);
    logins[actor.key] = result.ok ? "OK" : `ERRO:${result.error || "unknown"}`;
    console.log(`LOGIN ${actor.key}: ${logins[actor.key]}`);
  }

  const runtime = {
    createdAt: new Date().toISOString(),
    supabaseUrl: url,
    passwordHint: "stored only in this runtime file; not committed",
    password,
    users,
    requests: {
      R1: {
        id: r1.id,
        ownerKey: "C2",
        ownerUserId: r1.client_id,
        status: r1.status,
        nutritionist_id: r1.nutritionist_id,
        assigned_nutritionist_id: r1.assigned_nutritionist_id,
      },
      R2: {
        id: r2.id,
        ownerKey: "C2",
        ownerUserId: r2.client_id,
        status: r2.status,
        nutritionist_id: r2.nutritionist_id,
        assigned_nutritionist_id: r2.assigned_nutritionist_id,
        nutritionistKey: "N2",
      },
    },
    logins,
    notes: [
      "Service role used only for fixture setup.",
      "Subsequent SEC tests must authenticate as normal users.",
      "R1: public pool candidate (pending, unassigned).",
      "R2: owned by N2 (in_review + nutritionist_id/assigned = N2).",
    ],
  };

  await mkdir(dirname(runtimeOut), { recursive: true });
  await writeFile(runtimeOut, JSON.stringify(runtime, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(`RUNTIME_OUT: ${runtimeOut}`);
  console.log(`PASSWORD_REDACTED: ${redactToken(password)}`);
}

main().catch((err) => {
  console.error("FIXTURE_SETUP_FAILED:", err?.message || err);
  process.exit(1);
});
