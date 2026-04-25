import { supabase } from "@/integrations/supabase/client";

// Tabela criada na migration 20260423120000_invite_analytics_and_birth_date.
// A CLI de tipos do Supabase ainda não foi regenerada, então usamos `as any`
// no client para que o TypeScript não bloqueie enquanto o schema novo não é
// puxado localmente. Nenhum dado sensível trafega aqui — apenas contagem de
// cliques / cópias / vendas para o painel admin.

type InviteEvent = "click" | "copy" | "sale";

export interface InviteAnalyticsInput {
  code: string;
  ownerId?: string | null;
  eventType: InviteEvent;
  sessionKey?: string | null;
  clientId?: string | null;
  amount?: number | null;
  metadata?: Record<string, unknown> | null;
}

// Chave de sessão por navegador — usada para deduplicar cliques no índice
// único (code, session_key). Persistimos em localStorage para que cada
// dispositivo seja contado uma única vez por link, e não a cada refresh.
const SESSION_STORAGE_KEY = "nutriaprova:inviteSession";

function getOrCreateSessionKey(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let key = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!key) {
      key = `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      window.localStorage.setItem(SESSION_STORAGE_KEY, key);
    }
    return key;
  } catch {
    return `sess_${Date.now()}`;
  }
}

async function resolveOwnerId(code: string): Promise<string | null> {
  if (!code) return null;
  try {
    const { data } = await (supabase as any)
      .from("profiles")
      .select("user_id")
      .eq("affiliate_code", code)
      .maybeSingle();
    return (data?.user_id as string) ?? null;
  } catch {
    return null;
  }
}

export async function trackInviteEvent(input: InviteAnalyticsInput): Promise<void> {
  if (!input.code) return;

  const sessionKey =
    input.sessionKey ?? (input.eventType === "click" ? getOrCreateSessionKey() : null);

  const ownerId = input.ownerId ?? (await resolveOwnerId(input.code));

  const payload = {
    code: input.code,
    owner_id: ownerId,
    event_type: input.eventType,
    session_key: sessionKey,
    client_id: input.clientId ?? null,
    amount: input.amount ?? 0,
    metadata: input.metadata ?? null,
  };

  try {
    // `ignoreDuplicates` casa com o índice único em (code, session_key) p/ cliques.
    const { error } = await (supabase as any)
      .from("invite_analytics")
      .insert(payload);
    if (error && !/duplicate key|23505/i.test(error.message ?? "")) {
      console.warn("[inviteAnalytics] insert error:", error.message);
    }
  } catch (err) {
    console.warn("[inviteAnalytics] unexpected error:", err);
  }
}

export interface InviteAnalyticsRow {
  code: string;
  event_type: InviteEvent;
  owner_id: string | null;
  amount: number | null;
}

export interface ProfessionalPerformance {
  userId: string;
  name: string;
  role: "nutritionist" | "personal_trainer" | string;
  code: string;
  clicks: number;
  copies: number;
  sales: number;
  revenue: number;
}

export async function fetchInvitePerformance(): Promise<ProfessionalPerformance[]> {
  const [eventsRes, profilesRes] = await Promise.all([
    (supabase as any)
      .from("invite_analytics")
      .select("code, event_type, owner_id, amount"),
    (supabase as any)
      .from("profiles")
      .select("user_id, full_name, role, affiliate_code")
      .in("role", ["nutritionist", "personal_trainer"]),
  ]);

  const events = (eventsRes.data as InviteAnalyticsRow[] | null) ?? [];

  const profiles =
    (profilesRes.data as
      | {
          user_id: string;
          full_name: string | null;
          role: string;
          affiliate_code: string | null;
        }[]
      | null) ?? [];

  const byCode = new Map<string, ProfessionalPerformance>();

  for (const p of profiles) {
    const code = p.affiliate_code ?? "";
    if (!code) continue;
    byCode.set(code, {
      userId: p.user_id,
      name: p.full_name || "—",
      role: p.role as ProfessionalPerformance["role"],
      code,
      clicks: 0,
      copies: 0,
      sales: 0,
      revenue: 0,
    });
  }

  for (const ev of events) {
    if (!ev.code) continue;
    let bucket = byCode.get(ev.code);
    if (!bucket) {
      // Eventos órfãos (código sem dono carregado) entram mesmo assim,
      // assim o admin percebe inconsistências no cadastro.
      bucket = {
        userId: ev.owner_id ?? "",
        name: "Código sem dono",
        role: "",
        code: ev.code,
        clicks: 0,
        copies: 0,
        sales: 0,
        revenue: 0,
      };
      byCode.set(ev.code, bucket);
    }
    if (ev.event_type === "click") bucket.clicks += 1;
    else if (ev.event_type === "copy") bucket.copies += 1;
    else if (ev.event_type === "sale") {
      bucket.sales += 1;
      bucket.revenue += Number(ev.amount ?? 0);
    }
  }

  return Array.from(byCode.values()).sort(
    (a, b) => b.sales - a.sales || b.clicks - a.clicks,
  );
}
