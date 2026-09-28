// TODO(equipe-clinica): adicionar aba "Equipe" gated por planTier === "clinic"
// que liste membros, mostre slots disponíveis (groupSize do TIER_CONFIG = 4),
// e permita convite por e-mail. Aguarda decisão sobre schema (tabela clinics +
// clinic_members) e modelo de cobrança/permissão. Ver Bug 4 do prompt original.
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Link, useNavigate } from "react-router-dom";
import type { AnimationControls } from "framer-motion";
import { AnimatePresence, motion, useAnimationControls, useInView, useSpring, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Coins,
  Clock,
  CheckCircle2,
  Eye,
  Sparkles,
  AlertCircle,
  TrendingUp,
  FileText,
  PieChart,
  Wallet,
  Users,
  Lock,
  Gift,
  CreditCard,
  PartyPopper,
  MessageSquare,
  ChevronLeft,
  X,
  Loader2,
  ClipboardCheck,
  Plus,
  Save,
  Download,
  User2,
  Scale,
  Target,
  Ruler,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { activityLabel, allergyLabel, preferenceLabel } from "@/lib/labels";
import { getTimeGreeting } from "@/lib/timeGreeting";
import { toast } from "sonner";
import { adjustDietWithAI, adjustMarkdownWithAI, type DietPlan, type ClientData, type Meal } from "@/services/n8nService";
import { jobCoinCost, type PlanTier, type TierConfig, canUseAI, getTierConfig } from "@/hooks/usePlanTier";
import type { Database, Json } from "@/integrations/supabase/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

import SignatureEditor from "./SignatureEditor";
import DietPlanCard from "./DietPlanCard";
import AiDraftMarkdown, {
  coerceAiDraftPlanToDietPlan,
  hasStructuredMeals,
  isLikelyAiMarkdownNotes,
  markdownTextFromAiDraft,
  normalizeRawAiDraft,
} from "./AiDraftMarkdown";
import PremiumDietPlanView from "./PremiumDietPlanView";
import RetentionTab from "./RetentionTab";
import AffiliateTab from "./AffiliateTab";
import NutriRatingsCard from "./NutriRatingsCard";
import ClinicLogoUpload from "./ClinicLogoUpload";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

/** Transações com este `type` contam o uso diário de correções IA (Basic/Premium). */
const AI_CORRECTION_TX_TYPE = "ai_correction";

type ClaimOutcome = "ok" | "taken" | "not_approved" | "insufficient_credits" | "error";

const NOT_APPROVED_MESSAGE = "Seu cadastro profissional ainda não foi aprovado para assumir solicitações.";

function startOfLocalDayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function fetchAiCorrectionsTodayCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", AI_CORRECTION_TX_TYPE)
    .gte("created_at", startOfLocalDayIso());
  if (error) {
    console.warn("[NutritionistDashboard] ai corrections count:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** `client_data` JSON no banco — pode incluir campos além do contrato n8n. */
type StoredClientData = Partial<ClientData> & {
  adherence?: number;
  name?: string;
  full_name?: string;
  goal?: string;
  clinic_logo_url?: string;
  logo_url?: string;
  nutritionist_plan_tier?: string;
};

type DietRequest = Database["public"]["Tables"]["diet_requests"]["Row"];

/** Conteúdo de `ai_draft`: JSON estruturado (legado / n8n) ou texto/markdown. */
type ParsedAiDraft =
  | { kind: "structured"; plan: DietPlan }
  | { kind: "markdown"; text: string }
  | { kind: "empty" };

function parseAiDraft(raw: unknown): ParsedAiDraft {
  const normalized = normalizeRawAiDraft(raw);
  if (normalized == null) return { kind: "empty" };

  if (typeof normalized === "string") {
    const t = normalized.trim();
    if (!t) return { kind: "empty" };
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const o = JSON.parse(t) as unknown;
        if (o && typeof o === "object" && !Array.isArray(o) && hasStructuredMeals(o as Record<string, unknown>)) {
          return { kind: "structured", plan: o as DietPlan };
        }
      } catch {
        /* strings que parecem JSON mas falham no parse viram Markdown na linha abaixo */
      }
    }
    return { kind: "markdown", text: normalized };
  }

  if (typeof normalized === "object" && !Array.isArray(normalized) && normalized !== null) {
    if (hasStructuredMeals(normalized as Record<string, unknown>)) {
      return { kind: "structured", plan: normalized as DietPlan };
    }
  }

  const asMd = markdownTextFromAiDraft(normalized);
  if (asMd != null && asMd.trim()) {
    return { kind: "markdown", text: asMd };
  }

  if (typeof normalized === "object" && normalized !== null) {
    try {
      return { kind: "markdown", text: JSON.stringify(normalized, null, 2) };
    } catch {
      /* ignore */
    }
  }

  return { kind: "empty" };
}

/** Rascunho exibível: primeiro `ai_draft`; se vazio, Markdown em `notes` (persistência async do n8n). */
function parseRequestDraft(request: DietRequest | null | undefined): ParsedAiDraft {
  if (!request) return { kind: "empty" };
  const fromAi = parseAiDraft(request.ai_draft);
  if (fromAi.kind !== "empty") return fromAi;
  const n = request.notes;
  if (typeof n === "string" && isLikelyAiMarkdownNotes(n)) return { kind: "markdown", text: n.trim() };
  return { kind: "empty" };
}

/** Uso exclusivo na folha lateral de revisão: plano com slots de refeição seguros ou fallback texto. */
type SheetReviewDraft =
  | { kind: "structured"; plan: DietPlan }
  | { kind: "markdown"; text: string }
  | { kind: "fallback-pre"; rawText: string }
  | { kind: "empty" };

function formatAiDraftFallbackRawNutri(raw: unknown): string {
  try {
    if (raw == null || raw === "") return "(sem dados de rascunho)";
    if (typeof raw === "string") return raw.length > 80000 ? `${raw.slice(0, 80000)}\n…` : raw;
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

function buildSheetReviewDraft(parsed: ParsedAiDraft, rawAiDraft: unknown): SheetReviewDraft {
  if (parsed.kind === "empty") return { kind: "empty" };
  if (parsed.kind === "markdown") {
    const t = (parsed.text ?? "").trim();
    if (!t.length) return { kind: "fallback-pre", rawText: formatAiDraftFallbackRawNutri(rawAiDraft) };
    return { kind: "markdown", text: parsed.text ?? "" };
  }
  try {
    return { kind: "structured", plan: coerceAiDraftPlanToDietPlan(parsed.plan) };
  } catch {
    return { kind: "fallback-pre", rawText: formatAiDraftFallbackRawNutri(rawAiDraft) };
  }
}

function hasDraftContent(request: DietRequest | null | undefined): boolean {
  return parseRequestDraft(request).kind !== "empty";
}

function asStoredClientData(raw: Json | null | undefined): StoredClientData | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as StoredClientData;
}

function ageFromBirthDateIso(birthDate: string): number {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return NaN;
  const years = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(1, Math.floor(years));
}

/** Monta o payload do webhook n8n a partir do JSON salvo em `diet_requests.client_data`. */
function storedClientDataToClientData(cd: StoredClientData | null): ClientData | null {
  if (!cd) return null;
  if (cd.gender !== "masculino" && cd.gender !== "feminino") return null;
  const w = Number(cd.weight);
  const h = Number(cd.height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;

  let age = typeof cd.age === "number" && Number.isFinite(cd.age) && cd.age > 0 ? Math.floor(cd.age) : NaN;
  if (!Number.isFinite(age) && typeof cd.birthDate === "string" && cd.birthDate.trim()) {
    age = ageFromBirthDateIso(cd.birthDate);
  }
  if (!Number.isFinite(age) || age <= 0) return null;

  const goal = typeof cd.goal === "string" ? cd.goal.trim() : "";
  if (!goal) return null;

  const allergies = Array.isArray(cd.allergies) ? cd.allergies.filter((a): a is string => typeof a === "string") : [];
  const activityLevel =
    typeof cd.activityLevel === "string" && cd.activityLevel.trim() ? cd.activityLevel : "moderado";

  const payload: ClientData = {
    age,
    gender: cd.gender,
    weight: w,
    height: h,
    goal,
    allergies,
    activityLevel,
  };
  if (typeof cd.birthDate === "string" && cd.birthDate.trim()) payload.birthDate = cd.birthDate;
  if (typeof cd.bodyFat === "number" && cd.bodyFat > 0 && cd.bodyFat <= 100) payload.bodyFat = cd.bodyFat;
  if (typeof cd.additionalNotes === "string" && cd.additionalNotes.trim()) {
    payload.additionalNotes = cd.additionalNotes.trim();
  }
  if (typeof cd.targetWeight === "number" && cd.targetWeight > 0) payload.targetWeight = cd.targetWeight;
  if (typeof cd.targetTimelineMonths === "number" && cd.targetTimelineMonths > 0) {
    payload.targetTimelineMonths = cd.targetTimelineMonths;
  }
  const foodPreferences = Array.isArray(cd.foodPreferences)
    ? cd.foodPreferences.filter((a): a is string => typeof a === "string")
    : [];
  if (foodPreferences.length > 0) payload.foodPreferences = foodPreferences;
  return payload;
}

function enrichClientDataWithBranding(
  raw: Json | null | undefined,
  branding: { clinicLogoUrl: string | null; professionalTier: string | null },
): Json {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    ...base,
    clinic_logo_url: branding.clinicLogoUrl,
    logo_url: branding.clinicLogoUrl,
    nutritionist_plan_tier: branding.professionalTier,
  } as Json;
}

function adherenceFromStoredClient(cd: StoredClientData | null | undefined): number {
  const a = cd?.adherence;
  if (typeof a === "number" && !Number.isNaN(a)) return Math.min(100, Math.max(0, a));
  return 0;
}

const STATUS_CONFIG = {
  awaiting_payment: { label: "Pagamento pendente", color: "bg-amber-500/15", icon: AlertCircle },
  processing: { label: "Processando IA", color: "bg-sky-500/15", icon: Clock },
  pending: { label: "Pendente", color: "bg-status-pending", icon: Clock },
  awaiting_validation: { label: "Aguardando validação", color: "bg-status-review", icon: ClipboardCheck },
  in_review: { label: "Em Revisão", color: "bg-status-review", icon: Eye },
  completed: { label: "Concluído", color: "bg-status-completed", icon: CheckCircle2 },
};

const MEAL_TIMELINE = [
  { k: "cafeDaManha", label: "Café da manhã" },
  { k: "lancheDaManha", label: "Lanche" },
  { k: "almoco", label: "Almoço" },
  { k: "lancheDaTarde", label: "Lanche da tarde" },
  { k: "jantar", label: "Jantar" },
] as const;

const TIMELINE_DOT = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--primary-glow))", "hsl(var(--warn))", "hsl(var(--primary-light))"] as const;

function avatarGradientHsl(name: string): { from: string; to: string } {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 13) % 360;
  const h2 = (h + 40) % 360;
  return { from: `hsl(${h} 45% 42%)`, to: `hsl(${h2} 50% 32%)` };
}

function requestInitials(data: { goal?: string; name?: string; full_name?: string } | null | undefined, id: string) {
  const n = (data?.full_name || data?.name || data?.goal || id).toString();
  const parts = n.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase().slice(0, 2);
  return n.slice(0, 2).toUpperCase();
}

/** Exibição — não altera dados; só rótulo para UI. */
function patientLabel(d: { goal?: string; name?: string; full_name?: string } | null | undefined, reqId: string) {
  const n = d?.full_name || d?.name;
  if (n && String(n).trim()) return String(n).trim();
  return `Paciente #${reqId.slice(0, 8)}`;
}

function goalLine(goal?: string) {
  if (goal === "perder_peso") return "Emagrecimento";
  if (goal === "ganhar_massa") return "Ganho de massa";
  if (goal === "manutencao" || goal === "manutenção") return "Manutenção";
  return goal && String(goal).length > 0 ? String(goal) : "—";
}

/** Cores de status na lista: verde=ativo, amarelo=pendente, cinza=encerrado */
function listStatusVisual(status: string) {
  if (status === "pending")
    return { dot: "bg-amber-400", label: "Pendente" };
  if (status === "awaiting_validation")
    return { dot: "bg-[hsl(152,60%,40%)]", label: "Aguardando validação" };
  if (status === "processing")
    return { dot: "bg-sky-400", label: "Processando" };
  if (status === "in_review")
    return { dot: "bg-[hsl(152,60%,40%)]", label: "Ativo" };
  if (status === "completed")
    return { dot: "bg-[hsl(var(--ink-3))]/70", label: "Concluído" };
  return { dot: "bg-[hsl(var(--ink-3))]/50", label: "—" };
}

function normalizePlanTier(tier: string | null | undefined): PlanTier {
  if (tier === "basic" || tier === "premium" || tier === "clinic" || tier === "freemium") {
    return tier;
  }
  return "freemium";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ease: [0.16, 1, 0.3, 1] as const, duration: 0.55 },
  },
};

interface AiUsageStatusBarProps {
  tier: PlanTier;
  usedToday: number;
  tierConfig: TierConfig;
  unlimitedOverride?: boolean;
}

function AiUsageStatusBar({ tier, usedToday, tierConfig, unlimitedOverride = false }: AiUsageStatusBarProps) {
  const navigate = useNavigate();
  const isUnlimited = unlimitedOverride || tierConfig.aiCorrectionsPerDay === "unlimited";
  const limit = tierConfig.aiCorrectionsPerDay;
  const atLimit =
    !isUnlimited &&
    (limit === 0 || (typeof limit === "number" && !canUseAI(tier, usedToday)));

  if (isUnlimited) {
    return (
      <motion.div
        variants={itemVariants}
        className="mb-6 flex flex-wrap items-center gap-2.5 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-3 py-2 shadow-sm"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-medium text-[hsl(var(--ink-1))]">
          {tierConfig.aiCorrectionsPerDay === "unlimited"
            ? "Ajustes IA: ilimitados (Clínica)"
            : "Ajustes IA: ilimitados."}
        </span>
        <Badge variant="outline" className="border-[hsl(var(--surface-3))] text-[10px] text-[hsl(var(--ink-2))]">
          IA
        </Badge>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants} className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-3 py-2 shadow-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-medium text-[hsl(var(--ink-1))]">
          Ajustes IA hoje: {usedToday} / {limit}
        </span>
        <Badge variant="outline" className="border-[hsl(var(--surface-3))] text-[10px] text-[hsl(var(--ink-2))]">
          {tierConfig.label}
        </Badge>
      </div>
      {atLimit ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <p className="min-w-0 flex-1 text-xs text-[hsl(var(--ink-2))]">
            Limite diário de ajustes com IA atingido ou indisponível no seu plano. Faça upgrade para continuar.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-600/40 text-amber-900 hover:bg-amber-500/15 dark:text-amber-100"
            onClick={() => navigate("/planos")}
          >
            Ver planos
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => {
    const f =
      decimals <= 0
        ? Math.round(v)
        : Math.round(v * 10 ** decimals) / 10 ** decimals;
    return f.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals > 0 ? decimals : 0,
      maximumFractionDigits: decimals,
    });
  });

  useEffect(() => {
    if (isInView) spring.set(value);
  }, [isInView, value, spring]);

  return (
    <motion.span ref={ref} className="tabular-nums">
      {display}
    </motion.span>
  );
}

const rechartsTooltipStyle = {
  background: "hsl(var(--surface-0))",
  border: "1px solid hsl(var(--surface-3))",
  borderRadius: "var(--radius-sm)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 8px 32px hsl(var(--ink-1) / 0.12)",
} as const;

function AdherenceRing({ value, size = 96 }: { value: number; size?: number }) {
  const p = Math.min(100, Math.max(0, value));
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  const dim = 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} className="shrink-0" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--surface-3))" strokeWidth="6" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

type RequestPanelCommon = {
  request: DietRequest;
  userId: string | undefined;
  profile: { credits?: number; full_name?: string } | null;
  onOpenReview: (r: DietRequest) => void;
  onOpenPdf: (r: DietRequest) => void;
  onClaimAndReview: (r: DietRequest) => Promise<void>;
  onAccept: (r: DietRequest) => Promise<void>;
  onGoRetention: () => void;
  clientData: StoredClientData | null;
  onBack?: () => void;
  epicRumbleControls?: AnimationControls;
  /** Quando coincide com `request.id`, aceite da solicitação em andamento (sem chamada n8n). */
  acceptingRequestId: string | null;
  claimingRequestId: string | null;
};

function PatientDetailPanel({
  request,
  userId,
  profile,
  onBack,
  onOpenReview,
  onOpenPdf,
  onClaimAndReview: _onClaimAndReview,
  onAccept,
  onGoRetention,
  clientData: cd,
  epicRumbleControls,
  acceptingRequestId,
  claimingRequestId: _claimingRequestId,
}: RequestPanelCommon) {
  const st = STATUS_CONFIG[(request.status as keyof typeof STATUS_CONFIG) ?? "pending"] ?? STATUS_CONFIG.pending;
  const StatusIcon = st.icon;
  const adherence = adherenceFromStoredClient(cd);
  const parsed = parseRequestDraft(request);
  const coercedPlan = parsed.kind === "structured" ? coerceAiDraftPlanToDietPlan(parsed.plan as unknown) : null;
  const meals = coercedPlan?.meals;
  const displayName = patientLabel(cd, request.id);
  const isAcceptingJob = acceptingRequestId === request.id;
  const hasAiDraft = parsed.kind !== "empty";
  /** Rascunho da IA disponível + status onde o nutri pode revisar antes da validação final. */
  const nutriDraftCtasEligible =
    (request.nutritionist_id == null || request.nutritionist_id === userId) &&
    (request.status === "in_review" ||
      request.status === "awaiting_validation" ||
      /* IA pode gravar Markdown e marcar completed antes da validação — ainda pool sem nutritionist_id */
      (request.status === "completed" && request.nutritionist_id == null));
  return (
    <div className="space-y-8">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))] font-sans"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar à lista
        </button>
      )}
      <div className="flex flex-col gap-3 border-b border-[1px] border-[hsl(var(--surface-3))] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="font-display text-[1.5rem] font-bold leading-tight tracking-tight text-[hsl(var(--ink-1))]">
            {displayName}
          </h2>
          <p className="text-[11px] font-sans text-[hsl(var(--ink-3))]">ID {request.id.slice(0, 8)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-[hsl(var(--surface-3))] font-sans text-xs font-medium">
              <StatusIcon className="h-3 w-3" />
              {st.label}
            </Badge>
            {request.assigned_nutritionist_id === userId && request.status === "pending" && (
              <span className="rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/6 px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--primary))]">
                Lead exclusivo
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-clinical p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">Peso</p>
          <p className="mt-1.5 font-display text-lg font-bold text-[hsl(var(--ink-1))]">
            {cd?.weight != null ? (
              <>
                <AnimatedNumber value={Number(cd.weight)} decimals={1} /> kg
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className="card-clinical p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">Altura</p>
          <p className="mt-1.5 font-display text-lg font-bold text-[hsl(var(--ink-1))]">
            {cd?.height != null ? (
              <>
                <AnimatedNumber value={Number(cd.height)} decimals={0} /> cm
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className="card-clinical p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">Objetivo</p>
          <p className="mt-1.5 font-display text-base font-bold leading-tight text-[hsl(var(--ink-1))]">{goalLine(cd?.goal)}</p>
        </div>
        <div className="card-clinical flex flex-col items-center justify-center p-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">Adesão</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <AdherenceRing value={adherence} size={88} />
            <span className="font-display text-4xl font-bold tabular-nums text-brand leading-none">
              <AnimatedNumber value={adherence} decimals={0} />%
            </span>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Timeline de refeições</p>
        {meals ? (
          <ul className="relative ms-1 space-y-0 border-l border-[hsl(var(--surface-3))] pl-6">
            {MEAL_TIMELINE.map((row, i) => {
              const m = meals?.[row.k];
              const color = TIMELINE_DOT[i % TIMELINE_DOT.length];
              const ingPreview = (m?.ingredients ?? [])
                .filter((x) => typeof x === "string" && x.trim())
                .slice(0, 2)
                .join(" · ");
              const dishName = m?.name && m.name !== "—" ? m.name : "";
              return (
                <li key={row.k} className="relative pb-6 last:pb-0">
                  <span
                    className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--surface-0))] shadow-sm"
                    style={{ background: color }}
                  />
                  <p className="text-xs font-medium text-[hsl(var(--ink-1))] font-display">{row.label}</p>
                  {(ingPreview || dishName) ? (
                    <p className="mt-0.5 text-[11px] leading-snug text-[hsl(var(--ink-2))] font-sans line-clamp-2">
                      {ingPreview || dishName}
                    </p>
                  ) : null}
                  {(typeof m?.calories === "number" && m.calories > 0) ? (
                    <p className="mt-0.5 text-[11px] text-[hsl(var(--ink-3))] font-sans tabular-nums">{m.calories} kcal</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : parsed.kind === "markdown" ? (
          <p className="text-sm text-[hsl(var(--ink-3))] font-sans">
            Rascunho em texto (Markdown). Use <strong className="text-[hsl(var(--ink-2))]">Visualizar</strong> para ler o plano completo.
          </p>
        ) : (
          <p className="text-sm text-[hsl(var(--ink-3))] font-sans">Plano ainda não disponível para esta solicitação.</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {request.status === "pending" && (
          profile && profile.credits > 0 ? (
            <motion.button
              type="button"
              animate={epicRumbleControls}
              whileHover={isAcceptingJob ? undefined : { scale: 1.04, y: -3 }}
              whileTap={isAcceptingJob ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 350 }}
              disabled={isAcceptingJob}
              className={cn(
                "btn-primary btn-breathe border-beam relative flex h-11 items-center justify-center gap-2 overflow-hidden px-4 text-sm font-semibold text-primary-foreground",
                isAcceptingJob && "cursor-wait opacity-95",
              )}
              onClick={() => {
                void onAccept(request);
              }}
            >
              {isAcceptingJob ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={2} />
              ) : (
                <motion.span
                  className="inline-flex"
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="icon-glow h-4 w-4 shrink-0" />
                </motion.span>
              )}
              {isAcceptingJob ? "Aceitando..." : "Aceitar solicitação"}
            </motion.button>
          ) : (
            <Button type="button" className="btn-primary opacity-50" disabled>
              <Sparkles className="h-4 w-4" /> Sem moedas
            </Button>
          )
        )}
        {nutriDraftCtasEligible && hasAiDraft && (
          <motion.button
            type="button"
            animate={epicRumbleControls}
            whileHover={{ scale: 1.04, y: -3 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 350 }}
            className={cn(
              "btn-primary btn-breathe border-beam relative flex h-11 items-center justify-center gap-2 overflow-hidden px-4 text-sm font-semibold text-primary-foreground",
            )}
            onClick={() => onOpenReview(request)}
          >
            <motion.span
              className="inline-flex"
              animate={{ x: [0, 3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ClipboardCheck className="icon-glow h-4 w-4 shrink-0" />
            </motion.span>
            Editar e Validar
          </motion.button>
        )}
        {nutriDraftCtasEligible && !hasAiDraft && (
          <div className="flex h-11 items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 text-sm text-[hsl(var(--ink-2))]">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span>Aguardando IA — o rascunho será preenchido pelo fluxo do cliente (n8n).</span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          className="border border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/8 font-sans"
          onClick={onGoRetention}
        >
          <MessageSquare className="mr-1.5 h-4 w-4" />
          Enviar Mensagem
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="bg-[hsl(var(--surface-2))] text-[hsl(var(--ink-1))] hover:bg-[hsl(var(--surface-3))]/80 font-sans"
          onClick={() => onOpenPdf(request)}
        >
          <FileText className="mr-1.5 h-4 w-4" />
          Ver Histórico
        </Button>
      </div>
    </div>
  );
}

interface InlineEditableMealProps {
  mealKey: string;
  meal: Meal;
  onChange: (mealKey: string, updated: Partial<Meal>) => void;
}

const MEAL_LABELS_INLINE: Record<string, { label: string; emoji: string }> = {
  cafeDaManha: { label: "Café da Manhã", emoji: "☀️" },
  lancheDaManha: { label: "Lanche da Manhã", emoji: "🍎" },
  almoco: { label: "Almoço", emoji: "🍛" },
  lancheDaTarde: { label: "Lanche da Tarde", emoji: "🥤" },
  jantar: { label: "Jantar", emoji: "🌙" },
};

function InlineEditableMeal({ mealKey, meal, onChange }: InlineEditableMealProps) {
  const meta = MEAL_LABELS_INLINE[mealKey] ?? { label: mealKey, emoji: "🍽️" };
  return (
    <div className="rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--surface-1))] border-b border-[hsl(var(--surface-3))]">
        <span className="text-xl">{meta.emoji}</span>
        <input
          className="flex-1 font-display font-bold text-sm bg-transparent border-0 border-b border-dashed border-[hsl(var(--surface-3))] focus:outline-none focus:border-[hsl(var(--primary))] text-[hsl(var(--ink-1))] pb-0.5"
          value={meal.name}
          onChange={(e) => onChange(mealKey, { name: e.target.value })}
          placeholder="Nome da refeição"
        />
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              { key: "calories", label: "Kcal", color: "text-destructive" },
              { key: "protein", label: "Prot (g)", color: "text-blue-600 dark:text-blue-400" },
              { key: "carbs", label: "Carbs (g)", color: "text-amber-600 dark:text-amber-400" },
              { key: "fat", label: "Gord (g)", color: "text-rose-600 dark:text-rose-400" },
            ] as const
          ).map(({ key, label, color }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>{label}</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-2 py-1.5 text-sm font-display font-bold text-[hsl(var(--ink-1))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30 focus:border-[hsl(var(--primary))] tabular-nums"
                value={meal[key]}
                onChange={(e) => onChange(mealKey, { [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))] mb-1.5">Ingredientes</p>
          <div className="space-y-1.5">
            {meal.ingredients.map((ing, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] shrink-0" />
                <input
                  className="flex-1 text-sm text-[hsl(var(--ink-1))] bg-transparent border-0 border-b border-dashed border-[hsl(var(--surface-3))] focus:outline-none focus:border-[hsl(var(--primary))] pb-0.5"
                  value={ing}
                  onChange={(e) => {
                    const newIngredients = [...meal.ingredients];
                    newIngredients[i] = e.target.value;
                    onChange(mealKey, { ingredients: newIngredients });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const newIngredients = meal.ingredients.filter((_, idx) => idx !== i);
                    onChange(mealKey, { ingredients: newIngredients });
                  }}
                  className="text-[hsl(var(--ink-3))] hover:text-destructive transition-colors p-1"
                  aria-label="Remover ingrediente"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange(mealKey, { ingredients: [...meal.ingredients, ""] })}
              className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1 mt-1"
            >
              <Plus className="h-3 w-3" /> Adicionar ingrediente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NutritionistDashboard() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const epicRumble = useAnimationControls();
  const [requests, setRequests] = useState<DietRequest[]>([]);
  const [completedRequests, setCompletedRequests] = useState<DietRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DietRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [expertCommentCommitted, setExpertCommentCommitted] = useState("");
  const [expertCommentDraft, setExpertCommentDraft] = useState("");
  const [expertCommentSavedView, setExpertCommentSavedView] = useState(false);
  const resetExpertCommentFields = useCallback(() => {
    setExpertCommentCommitted("");
    setExpertCommentDraft("");
    setExpertCommentSavedView(false);
  }, []);
  const [adjusting, setAdjusting] = useState(false);
  const [aiCorrectionsToday, setAiCorrectionsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"feed" | "pdf">("feed");
  const printPlanRef = useRef<HTMLDivElement>(null);
  const [printPlanAfterPdfOpen, setPrintPlanAfterPdfOpen] = useState(false);
  const [mainTab, setMainTab] = useState("jobs");
  const [clinicTab, setClinicTab] = useState<"list" | "detail">("list");
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(false);
  const [acceptingJobRequestId, setAcceptingJobRequestId] = useState<string | null>(null);
  const handlePrintPlan = useReactToPrint({
    contentRef: printPlanRef,
    documentTitle: () =>
      selectedRequest
        ? `Plano-alimentar-nutrIAprova-${selectedRequest.id.slice(0, 8)}`
        : "Plano-alimentar-nutrIAprova",
    pageStyle: "@page { size: auto; margin: 12mm; }",
  });
  const planTier = normalizePlanTier(profile?.plan_tier);
  const hasAffiliateAccess = planTier === "premium" || planTier === "clinic";
  const hasRetentionAccess = planTier === "premium" || planTier === "clinic";
  const hasExclusiveLeadsAccess = planTier === "premium" || planTier === "clinic";

  useEffect(() => {
    if (!printPlanAfterPdfOpen || viewMode !== "pdf" || !sheetOpen) return undefined;
    const t = window.setTimeout(() => {
      handlePrintPlan();
      setPrintPlanAfterPdfOpen(false);
    }, 400);
    return () => window.clearTimeout(t);
  }, [printPlanAfterPdfOpen, viewMode, sheetOpen, handlePrintPlan]);

  useEffect(() => {
    if (!user?.id) {
      setWelcomeBannerDismissed(false);
      return;
    }
    try {
      setWelcomeBannerDismissed(localStorage.getItem(`hideWelcomeBanner_${user.id}`) === "1");
    } catch {
      setWelcomeBannerDismissed(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setAiCorrectionsToday(0);
      return;
    }
    void fetchAiCorrectionsTodayCount(user.id).then(setAiCorrectionsToday);
  }, [user?.id]);

  const fetchRequests = async () => {
    // RLS already filters: pending (unassigned to others) OR own jobs.
    // Pre-assigned (assigned_nutritionist_id = me) are prioritized in the UI.
    const { data } = await supabase
      .from("diet_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      // Prioritize: my exclusive leads first, then public pending, then in_review/completed
      const sorted = [...data].sort((a, b) => {
        const aMine = a.assigned_nutritionist_id === user?.id ? 0 : 1;
        const bMine = b.assigned_nutritionist_id === user?.id ? 0 : 1;
        return aMine - bMine;
      });
      setRequests(sorted);
      setSelectedRequest((prev) => {
        if (!prev) return prev;
        const fresh = sorted.find((r) => r.id === prev.id);
        return (fresh ?? null) as DietRequest | null;
      });
    }
    setLoading(false);
  };

  const fetchCompletedRequests = async () => {
    if (!user?.id) {
      setCompletedRequests([]);
      return;
    }
    const { data, error } = await supabase
      .from("diet_requests")
      .select("*")
      .eq("nutritionist_id", user.id)
      .eq("status", "completed")
      .order("updated_at", { ascending: true });
    if (error) {
      console.warn("[NutritionistDashboard] completed requests:", error.message);
      return;
    }
    setCompletedRequests(data ?? []);
  };

  useEffect(() => {
    void fetchRequests();
    void fetchCompletedRequests();

    // Freemium safety net: ensure new nutritionists start with trial credits (server-side)
    (async () => {
      if (profile && profile.role === "nutritionist" && profile.credits === 0) {
        try {
          const { ensureTrialCredits } = await import("@/services/profileEconomicService");
          await ensureTrialCredits();
          await refreshProfile();
        } catch (err) {
          console.warn("[NutritionistDashboard] ensure_trial_credits:", err);
        }
      }
    })();

    const channel = supabase
      .channel("diet-requests-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "diet_requests" }, () => {
        void fetchRequests();
        void fetchCompletedRequests();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // Intencional: reage ao perfil carregado; fetchRequests/refreshProfile são estáveis o suficiente para o efeito desejado.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita re-subscribe em todo render
  }, [profile?.id, user?.id]);

  const [reviewSheetMode, setReviewSheetMode] = useState<"preview" | "edit">("preview");
  const [inlineEditMode, setInlineEditMode] = useState(false);
  const [editableDraft, setEditableDraft] = useState<DietPlan | null>(null);
  // Estados para edição manual de Markdown
  const [markdownEditMode, setMarkdownEditMode] = useState(false);
  const [editableMarkdown, setEditableMarkdown] = useState("");
  const [claimingRequestId, setClaimingRequestId] = useState<string | null>(null);

  const removeRequestFromUi = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setSelectedRequest((prev) => (prev?.id === id ? null : prev));
    setSheetOpen(false);
  }, []);

  const visibleRequests = useMemo(() => {
    if (!user?.id) return requests;
    return requests.filter(
      (r) =>
        !(r.status === "in_review" && r.nutritionist_id != null && r.nutritionist_id !== user.id),
    );
  }, [requests, user?.id]);

  const tryClaimPoolRequest = useCallback(
    async (requestId: string): Promise<ClaimOutcome> => {
      if (!user?.id) return "error";
      try {
        const { claimDietRequest } = await import("@/services/dietRequestSecurityService");
        const res = await claimDietRequest(requestId);
        switch (res?.status) {
          case "claimed":
          case "already_owned":
            return "ok";
          case "already_claimed":
          case "not_found":
            return "taken";
          case "not_eligible":
            return res.reason === "assigned_to_other" ? "taken" : "error";
          case "not_approved":
            return "not_approved";
          case "insufficient_credits":
            return "insufficient_credits";
          default:
            return "error";
        }
      } catch (e) {
        console.error("[NutritionistDashboard] claim_diet_request:", e);
        return "error";
      }
    },
    [user?.id],
  );

  /**
   * Garante posse da request antes de gravar (RLS de UPDATE é own-only desde a 1E.2B).
   * Pending não é assumido aqui: aceite cobrado ocorre só via handleAcceptJob.
   */
  const ensureOwnedForWrite = async (row: DietRequest): Promise<DietRequest | null> => {
    if (!user?.id) return null;
    if (row.nutritionist_id === user.id) return row;
    if (row.nutritionist_id != null) {
      toast.error("Este cardápio já foi assumido por outro nutricionista.");
      removeRequestFromUi(row.id);
      await fetchRequests();
      return null;
    }
    if (row.status === "pending") {
      toast.error("Aceite a solicitação antes de editar ou validar.");
      return null;
    }
    const claim = await tryClaimPoolRequest(row.id);
    if (claim === "taken") {
      toast.error("Este cardápio já foi assumido por outro nutricionista.");
      removeRequestFromUi(row.id);
      await fetchRequests();
      return null;
    }
    if (claim === "not_approved") {
      toast.error(NOT_APPROVED_MESSAGE);
      return null;
    }
    if (claim !== "ok") {
      toast.error("Não foi possível assumir o cardápio. Tente novamente.");
      return null;
    }
    const { data: fresh } = await supabase.from("diet_requests").select("*").eq("id", row.id).maybeSingle();
    const owned = (fresh ?? { ...row, nutritionist_id: user.id }) as DietRequest;
    setSelectedRequest(owned);
    return owned;
  };

  const handleClaimAndOpen = async (request: DietRequest) => {
    if (!user?.id) {
      toast.error("Sessão inválida. Recarregue a página.");
      return;
    }
    setClaimingRequestId(request.id);
    try {
      const result = await tryClaimPoolRequest(request.id);
      if (result === "taken") {
        toast.error("Este cardápio já foi assumido por outro nutricionista.");
        removeRequestFromUi(request.id);
        await fetchRequests();
        return;
      }
      if (result === "not_approved") {
        toast.error(NOT_APPROVED_MESSAGE);
        return;
      }
      if (result === "insufficient_credits") {
        toast.error("Créditos insuficientes! Você precisa de pelo menos 1 moeda.");
        return;
      }
      if (result === "error") {
        toast.error("Não foi possível assumir o cardápio.");
        return;
      }
      await fetchRequests();
      const { data: fresh } = await supabase.from("diet_requests").select("*").eq("id", request.id).maybeSingle();
      if (fresh) {
        const row = fresh as DietRequest;
        setSelectedRequest(row);
        resetExpertCommentFields();
        setViewMode("feed");
        setReviewSheetMode("edit");
        setSheetOpen(true);
        toast.success("Cardápio atribuído a você. Revise e valide quando estiver pronto.");
      }
    } finally {
      setClaimingRequestId(null);
    }
  };

  const handleAcceptJob = async (request: DietRequest) => {
    if (!user || !profile) {
      toast.error("Sessão inválida. Recarregue a página.");
      return;
    }

    const tier = planTier;
    const isSupreme = user.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
    const coinCost = isSupreme ? 0 : jobCoinCost(tier);

    if (coinCost > 0 && profile.credits < coinCost) {
      toast.error("Créditos insuficientes! Você precisa de pelo menos 1 moeda.");
      return;
    }

    setAcceptingJobRequestId(request.id);

    try {
      const brandedClientData = enrichClientDataWithBranding(request.client_data, {
        clinicLogoUrl: (profile as { clinic_logo_url?: string | null }).clinic_logo_url ?? null,
        professionalTier: profile.plan_tier ?? null,
      });

      // Claim + débito atômicos no servidor (1E.2B): pending → in_review via consume_job_credit.
      const { claimDietRequest } = await import("@/services/dietRequestSecurityService");
      const claim = await claimDietRequest(request.id);

      if (claim?.status !== "claimed" && claim?.status !== "already_owned") {
        if (claim?.status === "insufficient_credits") {
          toast.error("Créditos insuficientes! Você precisa de pelo menos 1 moeda.");
        } else if (claim?.status === "not_approved") {
          toast.error(NOT_APPROVED_MESSAGE);
        } else if (claim?.status === "not_eligible" && claim.reason === "role") {
          toast.error("Apenas nutricionistas podem aceitar solicitações.");
        } else {
          toast.error("Este job já foi aceito por outro nutricionista.");
        }
        void fetchRequests();
        return;
      }

      const { error: brandErr } = await supabase
        .from("diet_requests")
        .update({ client_data: brandedClientData })
        .eq("id", request.id)
        .eq("nutritionist_id", user.id);
      if (brandErr) console.warn("[NutritionistDashboard] accept branding:", brandErr.message);

      await refreshProfile();
      void epicRumble.start({
        x: [0, -3, 3, -2, 2, 0],
        transition: { duration: 0.4 },
      });
      if ((claim.cost ?? coinCost) === 0) {
        toast.success("Job aceito! Validação ilimitada do plano Clínica.");
      } else {
        toast.success("Job aceito! Boa validação.");
      }

      let row: DietRequest = { ...request, nutritionist_id: user.id, status: "in_review" };
      await fetchRequests();

      const { data: refetched } = await supabase.from("diet_requests").select("*").eq("id", row.id).maybeSingle();
      if (refetched) row = refetched as DietRequest;

      setSelectedRequest(row);
      setViewMode("feed");

      if (hasDraftContent(row)) {
        setReviewSheetMode("edit");
        setSheetOpen(true);
      } else {
        setSheetOpen(false);
        toast.info("Aguarde o rascunho da IA. Ele é gerado no fluxo do cliente (n8n) e aparece aqui quando estiver salvo.");
      }
    } catch {
      toast.error("Não foi possível aceitar a solicitação.");
    } finally {
      setAcceptingJobRequestId(null);
    }
  };

  const handleInlineChange = useCallback((mealKey: string, updated: Partial<Meal>) => {
    setEditableDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        meals: {
          ...prev.meals,
          [mealKey]: { ...prev.meals[mealKey as keyof typeof prev.meals], ...updated },
        },
      };
    });
  }, []);

  const handleSaveInlineEdit = async () => {
    if (!selectedRequest || !editableDraft) return;

    const newTotalCalories = Object.values(editableDraft.meals).reduce((sum, m) => sum + (m?.calories ?? 0), 0);
    const updatedDraft: DietPlan = { ...editableDraft, totalCalories: newTotalCalories };

    try {
      const owned = await ensureOwnedForWrite(selectedRequest);
      if (!owned) return;

      const { error } = await supabase
        .from("diet_requests")
        .update({ ai_draft: updatedDraft as unknown as Json })
        .eq("id", owned.id)
        .eq("nutritionist_id", owned.nutritionist_id!);

      if (error) throw error;

      setSelectedRequest({ ...owned, ai_draft: updatedDraft as unknown as Json });
      setInlineEditMode(false);
      toast.success("Rascunho atualizado com sucesso.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    }
  };

  const handleSaveMarkdownEdit = async () => {
    if (!selectedRequest || !editableMarkdown.trim()) return;
    try {
      const owned = await ensureOwnedForWrite(selectedRequest);
      if (!owned) return;
      const { error } = await supabase
        .from("diet_requests")
        .update({ ai_draft: editableMarkdown } as any)
        .eq("id", owned.id)
        .eq("nutritionist_id", owned.nutritionist_id!);
      if (error) throw error;
      setSelectedRequest({ ...owned, ai_draft: editableMarkdown as any });
      setMarkdownEditMode(false);
      toast.success("Rascunho em texto salvo com sucesso.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest || !user?.id) return;
    const row = await ensureOwnedForWrite(selectedRequest);
    if (!row) return;

    const brandedClientData = enrichClientDataWithBranding(row.client_data, {
      clinicLogoUrl: profile?.clinic_logo_url ?? null,
      professionalTier: profile?.plan_tier ?? null,
    });
    const trimmedExpert = expertCommentCommitted.trim();
    const payload: Record<string, unknown> = {
      status: "completed",
      client_data: brandedClientData as unknown,
    };
    if (trimmedExpert) payload.notes = trimmedExpert;

    const { data: approvedRows, error: upErr } = await supabase
      .from("diet_requests")
      .update(payload)
      .eq("id", row.id)
      .eq("nutritionist_id", user.id)
      .select("id");
    if (upErr || !approvedRows?.length) {
      console.warn("[NutritionistDashboard] approve:", upErr.message);
      toast.error("Não foi possível concluir a validação.");
      return;
    }
    void epicRumble.start({
      x: [0, -3, 3, -2, 2, 0],
      transition: { duration: 0.4 },
    });
    toast.success("Plano aprovado e enviado ao cliente!");
    resetExpertCommentFields();
    setSheetOpen(false);
    await fetchRequests();
  };

  const handleAIAdjust = async () => {
    if (!selectedRequest || !aiInstruction.trim() || !user) return;
    const parsedSel = parseRequestDraft(selectedRequest);
    const safeForAi = buildSheetReviewDraft(parsedSel, selectedRequest.ai_draft);
    if (safeForAi.kind !== "structured") {
      toast.error("Ajuste por IA só está disponível para rascunhos no formato estruturado (JSON).");
      return;
    }

    const isSupreme = user.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
    const tier = normalizePlanTier(profile?.plan_tier);
    const cfg = getTierConfig(tier);

    if (!isSupreme) {
      if (cfg.aiCorrectionsPerDay === 0) {
        toast.error("Correções de IA não estão incluídas no seu plano. Faça upgrade para Basic ou superior.");
        return;
      }
      const used = await fetchAiCorrectionsTodayCount(user.id);
      if (!canUseAI(tier, used)) {
        toast.error(
          `Limite diário de correções IA atingido (${String(cfg.aiCorrectionsPerDay)}/dia). Volte amanhã ou faça upgrade.`,
        );
        return;
      }
    }

    const owned = await ensureOwnedForWrite(selectedRequest);
    if (!owned) return;

    setAdjusting(true);
    try {
      const raw = await adjustDietWithAI(safeForAi.plan, aiInstruction.trim());
      let newDraft = coerceAiDraftPlanToDietPlan(raw as unknown);
      if (
        (!newDraft.shoppingList || newDraft.shoppingList.length === 0) &&
        safeForAi.plan.shoppingList &&
        safeForAi.plan.shoppingList.length > 0
      ) {
        newDraft = { ...newDraft, shoppingList: safeForAi.plan.shoppingList };
      }
      const { error: upErr } = await supabase
        .from("diet_requests")
        .update({ ai_draft: newDraft as unknown as Json })
        .eq("id", owned.id)
        .eq("nutritionist_id", user.id);
      if (upErr) throw upErr;

      if (!isSupreme && cfg.aiCorrectionsPerDay !== "unlimited") {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: user.id,
          amount: 0,
          type: AI_CORRECTION_TX_TYPE,
          description: `Correção IA (rascunho) — pedido ${selectedRequest.id.slice(0, 8)}`,
        });
        if (txErr) console.warn("[NutritionistDashboard] ai_correction tx:", txErr.message);
      }

      setSelectedRequest({ ...owned, ai_draft: newDraft as unknown as Json });
      setAiInstruction("");
      if (!isSupreme && cfg.aiCorrectionsPerDay !== "unlimited") {
        setAiCorrectionsToday((n) => n + 1);
      }
      void epicRumble.start({
        x: [0, -3, 3, -2, 2, 0],
        transition: { duration: 0.4 },
      });
      toast.success("Rascunho atualizado com o ajuste da IA.");
    } catch (e) {
      console.error("[NutritionistDashboard] adjustDietWithAI:", e);
      toast.error("Erro ao solicitar ajuste à IA. Tente novamente.");
    } finally {
      setAdjusting(false);
    }
  };

  const handleAIAdjustMarkdown = async () => {
    if (!selectedRequest || !aiInstruction.trim() || !user) return;

    const isSupreme = user.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
    const tier = normalizePlanTier(profile?.plan_tier);
    const cfg = getTierConfig(tier);

    if (!isSupreme) {
      if (cfg.aiCorrectionsPerDay === 0) {
        toast.error("Correções de IA não estão incluídas no seu plano. Faça upgrade para Basic ou superior.");
        return;
      }
      const used = await fetchAiCorrectionsTodayCount(user.id);
      if (!canUseAI(tier, used)) {
        toast.error(
          `Limite diário de correções IA atingido (${String(cfg.aiCorrectionsPerDay)}/dia). Volte amanhã ou faça upgrade.`,
        );
        return;
      }
    }

    // Pega o texto atual: usa o textarea se estiver em modo de edição, caso contrário usa o draft salvo.
    const parsedSel = parseRequestDraft(selectedRequest);
    const currentText =
      markdownEditMode && editableMarkdown.trim()
        ? editableMarkdown
        : parsedSel.kind === "markdown"
          ? parsedSel.text
          : null;

    if (!currentText) {
      toast.error("Nenhum texto de plano disponível para ajuste.");
      return;
    }

    const owned = await ensureOwnedForWrite(selectedRequest);
    if (!owned) return;

    setAdjusting(true);
    try {
      const newMarkdown = await adjustMarkdownWithAI(currentText, aiInstruction.trim());

      const { error: upErr } = await supabase
        .from("diet_requests")
        .update({ ai_draft: newMarkdown } as any)
        .eq("id", owned.id)
        .eq("nutritionist_id", user.id);
      if (upErr) throw upErr;

      // Registra uso no histórico de transações (respeita limite do tier)
      if (!isSupreme && cfg.aiCorrectionsPerDay !== "unlimited") {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: user.id,
          amount: 0,
          type: AI_CORRECTION_TX_TYPE,
          description: `Correção IA (markdown) — pedido ${selectedRequest.id.slice(0, 8)}`,
        });
        if (txErr) console.warn("[handleAIAdjustMarkdown] tx:", txErr.message);
        setAiCorrectionsToday((n) => n + 1);
      }

      setSelectedRequest({ ...owned, ai_draft: newMarkdown as any });
      // Se estava editando no textarea, atualiza o textarea também
      if (markdownEditMode) setEditableMarkdown(newMarkdown);
      setAiInstruction("");
      toast.success("Plano atualizado com o ajuste da IA.");
    } catch (e) {
      toast.error("Erro ao solicitar ajuste à IA. Tente novamente.");
      console.error("[handleAIAdjustMarkdown]", e);
    } finally {
      setAdjusting(false);
    }
  };

  const openReview = (request: DietRequest) => {
    void (async () => {
      const { data: row } = await supabase.from("diet_requests").select("*").eq("id", request.id).maybeSingle();
      const toUse = (row ?? request) as DietRequest;
      if (!hasDraftContent(toUse)) {
        toast.error("Plano ainda indisponível. Aguarde a geração da IA.");
        return;
      }
      setSelectedRequest(toUse);
      resetExpertCommentFields();
      setViewMode("feed");
      setReviewSheetMode("edit");
      setSheetOpen(true);
    })();
  };

  const openPdfView = (request: DietRequest) => {
    void (async () => {
      const { data: row } = await supabase.from("diet_requests").select("*").eq("id", request.id).maybeSingle();
      const toUse = (row ?? request) as DietRequest;
      if (!hasDraftContent(toUse)) {
        toast.error("Sem plano disponível para visualização em PDF.");
        return;
      }
      setSelectedRequest(toUse);
      setReviewSheetMode(toUse.nutritionist_id === user?.id ? "edit" : "preview");
      setViewMode("pdf");
      setSheetOpen(true);
    })();
  };

  const sheetReviewDraft = useMemo(
    () => buildSheetReviewDraft(parseRequestDraft(selectedRequest), selectedRequest?.ai_draft),
    [selectedRequest],
  );
  const clientData = asStoredClientData(selectedRequest?.client_data);
  const completedCount = completedRequests.length;
  const withdrawalBalance = completedCount * 15;
  /** Somente bloqueio pós-validação quando o pedido já tem nutricionista vinculado (evita tratar `completed` da IA como final). */
  const isNutriValidatedReadOnly =
    selectedRequest?.status === "completed" && selectedRequest?.nutritionist_id != null;

  useEffect(() => {
    setInlineEditMode(false);
    setEditableDraft(null);
    setMarkdownEditMode(false);
    setEditableMarkdown("");
    resetExpertCommentFields();
  }, [selectedRequest?.id, resetExpertCommentFields]);

  const activePatientsCount = requests.filter(
    (r) =>
      r.nutritionist_id === user?.id &&
      (r.status === "in_review" ||
        r.status === "completed" ||
        r.status === "awaiting_validation"),
  ).length;
  const exclusiveLeads = hasExclusiveLeadsAccess
    ? requests.filter((r) => r.status === "pending" && r.assigned_nutritionist_id === user?.id)
    : [];
  const monthlyPerformance = useMemo(() => {
    const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });
    const byMonth = completedRequests.reduce<Record<string, { month: string; ganho: number; validacoes: number; sortKey: number }>>((acc, req) => {
      const sourceDate = (req.updated_at || req.created_at) as string;
      const date = new Date(sourceDate);
      if (Number.isNaN(date.getTime())) return acc;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!acc[key]) {
        const month = monthFmt
          .format(date)
          .replace(".", "")
          .replace(/^\w/, (m) => m.toUpperCase());
        acc[key] = { month, ganho: 0, validacoes: 0, sortKey: date.getFullYear() * 100 + (date.getMonth() + 1) };
      }
      acc[key].validacoes += 1;
      acc[key].ganho += 15;
      return acc;
    }, {});

    const rows = Object.values(byMonth)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey: _sortKey, ...row }) => row);
    if (rows.length > 0) return rows;

    const now = new Date();
    return [{
      month: monthFmt.format(now).replace(".", "").replace(/^\w/, (m) => m.toUpperCase()),
      ganho: 0,
      validacoes: 0,
    }];
  }, [completedRequests]);

  const tierCfgForAi = useMemo(() => getTierConfig(planTier), [planTier]);
  const isSupremeUser = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const aiCorrectionHint =
    isSupremeUser || tierCfgForAi.aiCorrectionsPerDay === "unlimited"
      ? "Correções de IA no rascunho: ilimitadas no seu plano."
      : tierCfgForAi.aiCorrectionsPerDay === 0
        ? "Correções de IA não disponíveis no Freemium — faça upgrade."
        : `Correções IA hoje: ${aiCorrectionsToday} / ${tierCfgForAi.aiCorrectionsPerDay}.`;
  const aiAdjustDisabledByPlan =
    !isSupremeUser &&
    (tierCfgForAi.aiCorrectionsPerDay === 0 ||
      (tierCfgForAi.aiCorrectionsPerDay !== "unlimited" && !canUseAI(planTier, aiCorrectionsToday)));

  return (
    <motion.div
      className="bg-aurora-soft mx-auto min-h-0 max-w-[1600px] bg-[hsl(var(--surface-0))] p-4 md:px-6 md:py-5"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Boas-vindas: somente Freemium; dismiss persistente via localStorage */}
      {profile &&
        planTier === "freemium" &&
        profile.credits > 0 &&
        completedCount === 0 &&
        !welcomeBannerDismissed && (
        <motion.div variants={itemVariants} className="relative mb-6 flex items-start gap-3 rounded-xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-accent/20 to-primary/10 p-4 pr-12">
          <button
            type="button"
            aria-label="Fechar aviso de boas-vindas"
            className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            onClick={() => {
              if (user?.id) {
                try {
                  localStorage.setItem(`hideWelcomeBanner_${user.id}`, "1");
                } catch {
                  /* storage indisponível */
                }
              }
              setWelcomeBannerDismissed(true);
            }}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
            <PartyPopper className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-foreground">
              Bem-vindo! Você começou com {profile.credits} moedas iniciais.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Com suas {profile.credits} moedas iniciais, você pode lucrar de{" "}
              <strong className="text-primary">R$ {(profile.credits * 15).toFixed(2)}</strong> a{" "}
              <strong className="text-primary">R$ {(profile.credits * 25).toFixed(2)}</strong>{" "}
              (incluindo recompensas por indicação de novos clientes).
            </p>
          </div>
        </motion.div>
      )}

      {profile && profile.credits === 0 && (
        <motion.div variants={itemVariants} className="mb-6 flex items-center gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="font-display font-bold text-sm text-foreground">Suas moedas acabaram!</p>
            <p className="text-xs text-muted-foreground">Assine o Plano Premium para continuar validando dietas.</p>
          </div>
          <Button size="sm" onClick={() => navigate("/planos")} className="emerald-gradient text-primary-foreground whitespace-nowrap">
            <CreditCard className="h-4 w-4 mr-1" /> Ver Planos
          </Button>
        </motion.div>
      )}

      {/* Cabeçalho clínico + toolbar */}
      <motion.div variants={itemVariants} className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-[hsl(var(--ink-2))]">
              {getTimeGreeting()}
              {profile?.full_name?.trim()
                ? `, ${profile.full_name.split(/\s+/)[0]}`
                : ""}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-[hsl(var(--ink-1))] md:text-[1.75rem]">
              Painel Clínico
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {planTier === "premium" || planTier === "clinic" ? (
              <span className="badge-gold w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">Pro</span>
            ) : planTier === "freemium" ? (
              <span className="w-fit rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ink-2))]">
                Free
              </span>
            ) : (
              <span className="w-fit rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ink-2))]">
                Basic
              </span>
            )}
            <div
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-2.5 text-xs font-bold text-white tabular-nums shadow-sm"
              title="Pacientes ativos (revisão + concluídos com você)"
            >
              <AnimatedNumber value={activePatientsCount} decimals={0} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-coin-gold/30 bg-coin-gold/10 px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-coin-gold" />
            <span className="font-display text-sm font-bold text-coin-gold-foreground">
              <AnimatedNumber value={profile?.credits ?? 0} decimals={0} />
            </span>
            <span className="text-[10px] text-[hsl(var(--ink-3))]">moedas</span>
          </div>
          <Button asChild size="sm" className="emerald-gradient gap-1 text-primary-foreground">
            <Link to="/planos">
              <CreditCard className="h-4 w-4" /> Gerenciar planos e assinaturas
            </Link>
          </Button>
        </div>
      </motion.div>

      {planTier !== "clinic" && (
        <AiUsageStatusBar
          tier={planTier}
          usedToday={aiCorrectionsToday}
          tierConfig={tierCfgForAi}
          unlimitedOverride={isSupremeUser}
        />
      )}

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <motion.div variants={itemVariants} className="w-full">
          <div
            role="tablist"
            aria-label="Seções do painel clínico"
            className="flex h-auto w-full justify-start gap-0.5 overflow-x-auto whitespace-nowrap rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-1.5 scrollbar-hide"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "jobs"}
              onClick={() => setMainTab("jobs")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium",
                mainTab === "jobs" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
              )}
            >
              {mainTab === "jobs" && (
                <motion.div
                  layoutId="nutri-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-lg bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <FileText className="h-4 w-4 shrink-0" /> Solicitações
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "financeiro"}
              onClick={() => setMainTab("financeiro")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium",
                mainTab === "financeiro" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
              )}
            >
              {mainTab === "financeiro" && (
                <motion.div
                  layoutId="nutri-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-lg bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Wallet className="h-4 w-4 shrink-0" /> Financeiro
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "ratings"}
              onClick={() => setMainTab("ratings")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium",
                mainTab === "ratings" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
              )}
            >
              {mainTab === "ratings" && (
                <motion.div
                  layoutId="nutri-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-lg bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 shrink-0" /> Avaliações
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "retention"}
              onClick={() => setMainTab("retention")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium",
                mainTab === "retention" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
              )}
            >
              {mainTab === "retention" && (
                <motion.div
                  layoutId="nutri-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-lg bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Users className="h-4 w-4 shrink-0" />
                Retenção & Acompanhamento
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Premium
                </span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mainTab === "affiliate"}
              onClick={() => setMainTab("affiliate")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] shrink-0 items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium",
                mainTab === "affiliate" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
              )}
            >
              {mainTab === "affiliate" && (
                <motion.div
                  layoutId="nutri-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-lg bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Gift className="h-4 w-4 shrink-0" />
                Indique e Ganhe
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Premium
                </span>
              </span>
            </button>
          </div>
        </motion.div>

        <TabsContent value="jobs" className="space-y-6 focus-visible:outline-none">
          {exclusiveLeads.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))]">
              <div className="flex items-center justify-between border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-4 py-3">
                <h2 className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Novos Leads</h2>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-2 text-xs font-bold text-white">
                  <AnimatedNumber value={exclusiveLeads.length} decimals={0} />
                </span>
              </div>
              <ul className="divide-y divide-[hsl(var(--surface-3))]">
                {exclusiveLeads.map((req, index) => {
                  const d = asStoredClientData(req.client_data);
                  const g = avatarGradientHsl((d?.goal || req.id) as string);
                  const nameLine = patientLabel(d, req.id);
                  return (
                    <motion.li
                      key={req.id}
                      initial={{ opacity: 0, x: -16, scale: 0.97 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{
                        x: 8,
                        backgroundColor: "hsl(var(--surface-1))",
                        transition: { duration: 0.15 },
                      }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                        >
                          {requestInitials(d, req.id)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-display text-sm font-semibold text-[hsl(var(--ink-1))]">{nameLine}</p>
                          <span className="mt-0.5 inline-block rounded-md border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            Indicação
                          </span>
                        </div>
                      </div>
                      {profile && profile.credits > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0 rounded-full border border-[hsl(var(--primary))]/35 bg-transparent px-3.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
                          disabled={acceptingJobRequestId === req.id}
                          onClick={() => void handleAcceptJob(req)}
                        >
                          {acceptingJobRequestId === req.id ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Aceitando…
                            </span>
                          ) : (
                            "Ativar"
                          )}
                        </Button>
                      ) : (
                        <Button type="button" size="sm" className="h-8 shrink-0 rounded-full opacity-50" disabled>
                          Ativar
                        </Button>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-[hsl(var(--ink-3))]">Carregando...</div>
          ) : visibleRequests.length === 0 ? (
            <div className="rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] py-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--ink-3))]" />
              <p className="font-display font-medium text-[hsl(var(--ink-1))]">Nenhuma solicitação no momento</p>
              <p className="text-sm text-[hsl(var(--ink-3))]">Novos pedidos aparecerão aqui em tempo real</p>
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <Tabs value={clinicTab} onValueChange={(v) => setClinicTab(v as "list" | "detail")}>
                  <div
                    role="tablist"
                    className="mb-4 grid w-full grid-cols-2 gap-0.5 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={clinicTab === "list"}
                      onClick={() => setClinicTab("list")}
                      className={cn(
                        "relative z-0 rounded-lg py-2.5 text-sm font-medium",
                        clinicTab === "list" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))]",
                      )}
                    >
                      {clinicTab === "list" && (
                        <motion.div
                          layoutId="nutri-clinic-tab-bg"
                          className="absolute inset-0 z-0 rounded-lg bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10">Lista</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={clinicTab === "detail"}
                      disabled={!selectedRequest}
                      onClick={() => selectedRequest && setClinicTab("detail")}
                      className={cn(
                        "relative z-0 rounded-lg py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
                        clinicTab === "detail" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))]",
                      )}
                    >
                      {clinicTab === "detail" && (
                        <motion.div
                          layoutId="nutri-clinic-tab-bg"
                          className="absolute inset-0 z-0 rounded-lg bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                          transition={{ type: "spring", stiffness: 400, damping: 35 }}
                        />
                      )}
                      <span className="relative z-10">Detalhe</span>
                    </button>
                  </div>
                  <TabsContent value="list" className="mt-0 max-h-[min(70vh,520px)] space-y-2.5 overflow-y-auto pr-0.5">
                    {visibleRequests.map((req, index) => {
                      const d = asStoredClientData(req.client_data);
                      const g = avatarGradientHsl((d?.goal || req.id) as string);
                      const vis = listStatusVisual(String(req.status));
                      const isSel = selectedRequest?.id === req.id;
                      const act = (req as { updated_at?: string }).updated_at || req.created_at;
                      return (
                        <motion.button
                          key={req.id}
                          type="button"
                          initial={{ opacity: 0, x: -16, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          whileHover={{
                            x: 8,
                            backgroundColor: "hsl(var(--surface-1))",
                            transition: { duration: 0.15 },
                          }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedRequest(req);
                            setClinicTab("detail");
                          }}
                          className={cn(
                            "w-full rounded-xl border bg-[hsl(var(--surface-0))] p-3 text-left transition-colors",
                            "focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            isSel
                              ? "border-transparent bg-[hsl(var(--primary))]/8"
                              : "border-[hsl(var(--surface-3))]",
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                              style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                            >
                              {requestInitials(d, req.id)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 font-display text-sm font-semibold text-[hsl(var(--ink-1))]">
                                {patientLabel(d, req.id)}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", vis.dot)} />
                                <span className="text-[12px] font-sans text-[hsl(var(--ink-2))]">{vis.label}</span>
                              </div>
                              <p className="mt-1 text-[11px] font-sans text-[hsl(var(--ink-3))]">
                                Última atividade {new Date(act).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </TabsContent>
                  <TabsContent value="detail" className="mt-0 min-h-[320px]">
                    <AnimatePresence mode="wait">
                      {selectedRequest ? (
                        <motion.div
                          key={selectedRequest.id}
                          initial={{ opacity: 0, x: 30, filter: "blur(6px)" }}
                          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <PatientDetailPanel
                            request={selectedRequest}
                            userId={user?.id}
                            profile={profile}
                            onBack={() => setClinicTab("list")}
                            onOpenReview={openReview}
                            onOpenPdf={openPdfView}
                            onClaimAndReview={handleClaimAndOpen}
                            onAccept={handleAcceptJob}
                            onGoRetention={() => {
                              setMainTab("retention");
                              setClinicTab("list");
                            }}
                            clientData={asStoredClientData(selectedRequest.client_data)}
                            epicRumbleControls={epicRumble}
                            acceptingRequestId={acceptingJobRequestId}
                            claimingRequestId={claimingRequestId}
                          />
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="hidden min-h-[min(80vh,560px)] md:flex md:gap-4 md:overflow-hidden">
                <aside className="flex w-[250px] shrink-0 flex-col">
                  <div className="px-2 py-2">
                    <p className="font-display text-xs font-semibold tracking-wide text-[hsl(var(--ink-2))]">Pacientes</p>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto px-1.5 py-1">
                    {visibleRequests.map((req, index) => {
                      const d = asStoredClientData(req.client_data);
                      const g = avatarGradientHsl((d?.goal || req.id) as string);
                      const vis = listStatusVisual(String(req.status));
                      const isSel = selectedRequest?.id === req.id;
                      const act = (req as { updated_at?: string }).updated_at || req.created_at;
                      return (
                        <motion.button
                          key={req.id}
                          type="button"
                          initial={{ opacity: 0, x: -16, scale: 0.97 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          whileHover={{
                            x: 8,
                            backgroundColor: "hsl(var(--surface-1))",
                            transition: { duration: 0.15 },
                          }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedRequest(req)}
                          className={cn(
                            "w-full rounded-xl border bg-[hsl(var(--surface-0))] p-2.5 text-left transition-colors",
                            "focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            isSel
                              ? "border-transparent bg-[hsl(var(--primary))]/8"
                              : "border-[hsl(var(--surface-3))]",
                          )}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                              style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                            >
                              {requestInitials(d, req.id)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-1 font-display text-sm font-semibold text-[hsl(var(--ink-1))]">
                                {patientLabel(d, req.id)}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", vis.dot)} />
                                <span className="text-[12px] font-sans text-[hsl(var(--ink-2))]">{vis.label}</span>
                              </div>
                              <p className="mt-1 text-[11px] font-sans text-[hsl(var(--ink-3))]">
                                Última atividade {new Date(act).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </aside>
                <main className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-4 lg:p-6">
                  <AnimatePresence mode="wait">
                    {selectedRequest ? (
                      <motion.div
                        key={selectedRequest.id}
                        initial={{ opacity: 0, x: 30, filter: "blur(6px)" }}
                        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <PatientDetailPanel
                          request={selectedRequest}
                          userId={user?.id}
                          profile={profile}
                          onOpenReview={openReview}
                          onOpenPdf={openPdfView}
                          onClaimAndReview={handleClaimAndOpen}
                          onAccept={handleAcceptJob}
                          onGoRetention={() => setMainTab("retention")}
                          clientData={asStoredClientData(selectedRequest.client_data)}
                          epicRumbleControls={epicRumble}
                          acceptingRequestId={acceptingJobRequestId}
                          claimingRequestId={claimingRequestId}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty-detail"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-sm font-sans text-[hsl(var(--ink-3))]"
                      >
                        Selecione um paciente na lista para ver detalhes clínicos.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </main>
              </div>
            </>
          )}

          <div className="border-t border-[hsl(var(--surface-3))] pt-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display text-base">Identidade Visual da Clínica</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <SignatureEditor />
                  <ClinicLogoUpload />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financeiro" className="space-y-6">
          <motion.section
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
            aria-label="Métricas do negócio"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] p-0 shadow-sm">
                <div className="border-b border-[1px] border-[hsl(var(--surface-3))] px-4 py-3">
                  <h3 className="font-display flex items-center gap-2 text-sm font-semibold text-[hsl(var(--ink-1))]">
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
                    Ganho Mensal (R$)
                  </h3>
                </div>
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={monthlyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-3))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <Tooltip contentStyle={{ ...rechartsTooltipStyle }} />
                      <Bar
                        dataKey="ganho"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive
                        animationDuration={800}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] p-0 shadow-sm">
                <div className="border-b border-[1px] border-[hsl(var(--surface-3))] px-4 py-3">
                  <h3 className="font-display flex items-center gap-2 text-sm font-semibold text-[hsl(var(--ink-1))]">
                    <PieChart className="h-4 w-4 text-[hsl(var(--primary))]" />
                    Dietas validadas
                  </h3>
                </div>
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={monthlyPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-3))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <Tooltip contentStyle={{ ...rechartsTooltipStyle }} />
                      <Line
                        type="monotone"
                        dataKey="validacoes"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                        isAnimationActive
                        animationDuration={1200}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {[
                { label: "Validadas", value: completedCount, em: "text-primary", money: false },
                { label: "Pendentes", value: visibleRequests.filter((r) => r.status === "pending").length, em: "text-[hsl(var(--ink-1))]", money: false },
                { label: "Em revisão", value: requests.filter((r) => (r.status === "in_review" || r.status === "awaiting_validation") && r.nutritionist_id === user?.id).length, em: "text-[hsl(var(--ink-1))]", money: false },
                { label: "Saldo", value: withdrawalBalance, em: "text-primary", money: true },
              ].map((s) => (
                <div key={s.label} className="card-clinical p-4 text-center shadow-sm">
                  <p className={cn("text-2xl font-display font-bold", s.em)}>
                    {s.money ? (
                      <>
                        R$ <AnimatedNumber value={s.value} decimals={2} />
                      </>
                    ) : (
                      <AnimatedNumber value={s.value} decimals={0} />
                    )}
                  </p>
                  <p className="text-[10px] font-medium text-[hsl(var(--ink-3))]">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.section>
        </TabsContent>

        {/* Ratings Tab */}
        <TabsContent value="ratings" className="space-y-6">
          <NutriRatingsCard />
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention">
          {hasRetentionAccess ? (
            <RetentionTab
              nutritionistName={profile?.full_name || "Nutricionista"}
              nutritionistUserId={user?.id}
            />
          ) : (
            <Card className="glass-card border-dashed border-muted-foreground/25">
              <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--surface-2))]">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-bold text-[hsl(var(--ink-1))]">Retenção e acompanhamento bloqueados</h3>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  O acompanhamento próximo gera mais resultados e fideliza seus clientes. Faça upgrade para o plano Premium ou Clínica para ter acesso aos dados de contato (WhatsApp/E-mail) dos pacientes e iniciar o acompanhamento direto pela plataforma.
                </p>
                <Button size="sm" onClick={() => navigate("/planos")} className="emerald-gradient text-primary-foreground">
                  <CreditCard className="mr-1.5 h-4 w-4" />
                  Ver planos para upgrade
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Affiliate Tab */}
        <TabsContent value="affiliate">
          {hasAffiliateAccess ? (
            <AffiliateTab />
          ) : (
            <Card className="glass-card border-dashed border-muted-foreground/25">
              <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--surface-2))]">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-bold text-[hsl(var(--ink-1))]">Programa de afiliados bloqueado</h3>
                <p className="max-w-xl text-sm text-muted-foreground">
                  Para desbloquear o programa de afiliados e ganhar comissões, faça upgrade para o plano Premium ou Clínica.
                </p>
                <Button size="sm" onClick={() => navigate("/planos")} className="emerald-gradient text-primary-foreground">
                  <CreditCard className="mr-1.5 h-4 w-4" />
                  Ver planos para upgrade
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Review / PDF Side Panel */}
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) {
            setReviewSheetMode("preview");
            setPrintPlanAfterPdfOpen(false);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="print:hidden">
            <SheetTitle className="font-display">
              {viewMode === "pdf" ? "Visualização do Plano Final" : "Revisão do Plano Alimentar"}
            </SheetTitle>
          </SheetHeader>

          {viewMode === "pdf" && sheetReviewDraft.kind !== "empty" ? (
            <>
              <div className="print:hidden mt-6 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setViewMode("feed");
                    setPrintPlanAfterPdfOpen(false);
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Voltar à revisão
                </Button>
                <Button
                  type="button"
                  className="emerald-gradient text-primary-foreground"
                  onClick={() => void handlePrintPlan()}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Imprimir ou salvar como PDF
                </Button>
              </div>
              <div ref={printPlanRef} className="mt-6 space-y-6 print:mt-0 text-foreground">
                {sheetReviewDraft.kind === "structured" ? (
                  <PremiumDietPlanView
                    plan={sheetReviewDraft.plan}
                    nutritionistName={profile?.full_name}
                    crnNumber={profile?.crn_number || undefined}
                    isCompleted={isNutriValidatedReadOnly}
                    clinicLogoUrl={clientData?.clinic_logo_url ?? clientData?.logo_url ?? (profile as { clinic_logo_url?: string | null })?.clinic_logo_url ?? null}
                    professionalTier={clientData?.nutritionist_plan_tier ?? profile?.plan_tier ?? null}
                  />
                ) : sheetReviewDraft.kind === "markdown" ? (
                  <AiDraftMarkdown text={sheetReviewDraft.text} />
                ) : (
                  <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 space-y-3">
                    <p className="text-sm font-medium text-[hsl(var(--ink-1))]">Formato de plano incompatível com o visualizador estruturado.</p>
                    <p className="text-xs text-[hsl(var(--ink-2))]">Conteúdo bruto gravado em ai_draft:</p>
                    <pre className="max-h-[min(520px,55vh)] overflow-auto rounded-md border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-3 text-[11px] leading-relaxed text-[hsl(var(--ink-1))] whitespace-pre-wrap break-words font-mono">
                      {sheetReviewDraft.rawText}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : sheetReviewDraft.kind !== "empty" ? (
            <div className="mt-6 space-y-6">
              {clientData && (
                <Card className="card-clinical border-[hsl(var(--surface-3))] shadow-sm">
                  <CardHeader className="border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] pb-3">
                    <CardTitle className="flex items-center gap-2 font-display text-sm font-semibold text-[hsl(var(--ink-1))]">
                      <User2 className="h-4 w-4 text-primary shrink-0" />
                      Dados do Cliente (anonimizados)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4 text-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex gap-3 rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]">
                          <Scale className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--ink-3))]">
                            Idade / Peso
                          </p>
                          <p className="font-medium text-[hsl(var(--ink-1))]">
                            {clientData.birthDate
                              ? `${new Date(clientData.birthDate).toLocaleDateString("pt-BR")} (${clientData.age} anos)`
                              : `${clientData.age} anos`}
                          </p>
                          <p className="mt-0.5 text-sm text-[hsl(var(--ink-2))]">{clientData.weight} kg</p>
                        </div>
                      </div>
                      <div className="flex gap-3 rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <div className="flex items-start gap-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]">
                              <Ruler className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--ink-3))]">Altura</p>
                              <p className="font-medium text-[hsl(var(--ink-1))]">{clientData.height} cm</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 border-t border-[hsl(var(--surface-3))] pt-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]">
                              <Activity className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--ink-3))]">
                                Atividade
                              </p>
                              <p className="font-medium text-[hsl(var(--ink-1))]">
                                {activityLabel(clientData.activityLevel)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-3">
                      <div className="flex flex-wrap items-start gap-2 sm:items-center">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.12)]">
                          <Target className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--ink-3))]">Objetivo</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge
                              className={cn(
                                "border-primary/35 bg-primary/12 font-sans text-xs font-medium text-[hsl(var(--ink-1))]",
                              )}
                            >
                              {clientData.goal}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {(clientData.allergies?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-orange-500/30 bg-orange-500/[0.07] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-900 dark:text-orange-100">
                          Restrições e alergias
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {clientData.allergies!.map((raw, idx) => (
                            <Badge
                              key={`restriction-${raw}-${idx}`}
                              variant="outline"
                              className="font-sans text-xs font-normal border-orange-500/40 bg-orange-500/10 text-orange-950 dark:text-orange-100"
                            >
                              {allergyLabel(raw)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(clientData.foodPreferences?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                          Preferências alimentares
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {clientData.foodPreferences!.map((raw, idx) => (
                            <Badge
                              key={`pref-${raw}-${idx}`}
                              variant="outline"
                              className="font-sans text-xs font-normal border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100"
                            >
                              {preferenceLabel(raw)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {clientData.additionalNotes && (
                      <p className="rounded-lg border border-primary/20 bg-accent/40 p-3 text-xs italic text-[hsl(var(--ink-2))]">
                        📝 {clientData.additionalNotes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {sheetReviewDraft.kind === "structured" ? (
                <>
                  {!isNutriValidatedReadOnly && reviewSheetMode === "edit" && (
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Rascunho da IA</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!inlineEditMode) {
                            setEditableDraft(
                              sheetReviewDraft.kind === "structured" ? structuredClone(sheetReviewDraft.plan) : null,
                            );
                          }
                          setInlineEditMode((v) => !v);
                        }}
                        className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                          inlineEditMode
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                            : "border-[hsl(var(--surface-3))] text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
                        )}
                      >
                        {inlineEditMode ? "✕ Cancelar edição" : "✏️ Editar manualmente"}
                      </button>
                    </div>
                  )}

                  {!isNutriValidatedReadOnly && inlineEditMode && editableDraft ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-primary/20 bg-accent/30 p-3">
                        <p className="text-xs text-[hsl(var(--ink-2))]">
                          Edite os campos diretamente. Clique em <strong>Salvar edição</strong> quando terminar — o rascunho será
                          atualizado para você e para o sistema.
                        </p>
                      </div>
                      {(["cafeDaManha", "lancheDaManha", "almoco", "lancheDaTarde", "jantar"] as const).map((key) => {
                        const meal = editableDraft.meals[key];
                        if (!meal) return null;
                        return (
                          <InlineEditableMeal key={key} mealKey={key} meal={meal} onChange={handleInlineChange} />
                        );
                      })}
                      <div className="rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] overflow-hidden">
                        <div className="border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-4 py-3">
                          <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Lista de compras</p>
                          <p className="mt-1 text-[11px] text-[hsl(var(--ink-3))]">
                            Um item por linha. Você pode pedir ajustes à IA na seção abaixo (mesmo limite diário do plano).
                          </p>
                        </div>
                        <div className="p-4">
                          <Textarea
                            value={(editableDraft.shoppingList ?? []).join("\n")}
                            onChange={(e) => {
                              const lines = e.target.value
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean);
                              setEditableDraft({
                                ...editableDraft,
                                shoppingList: lines.length ? lines : undefined,
                              });
                            }}
                            className="min-h-[120px] resize-y font-sans text-sm"
                            placeholder={"Ex.: aveia em flocos\nleite desnatado\nfrango grelhado"}
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setInlineEditMode(false)}>
                          Cancelar
                        </Button>
                        <Button className="flex-1 emerald-gradient text-primary-foreground" onClick={handleSaveInlineEdit}>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar edição
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <DietPlanCard plan={sheetReviewDraft.plan} showNotes={false} />
                  )}
                </>
              ) : sheetReviewDraft.kind === "markdown" ? (
                <>
                  {/* Markdown: botão toggle editar / visualizar */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Rascunho do plano</p>
                    {!isNutriValidatedReadOnly && reviewSheetMode === "edit" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!markdownEditMode) {
                            setEditableMarkdown(sheetReviewDraft.text);
                          }
                          setMarkdownEditMode((v) => !v);
                        }}
                        className={cn(
                          "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                          markdownEditMode
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                            : "border-[hsl(var(--surface-3))] text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
                        )}
                      >
                        {markdownEditMode ? "✕ Cancelar" : "✏️ Editar texto"}
                      </button>
                    )}
                  </div>

                  {markdownEditMode ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editableMarkdown}
                        onChange={(e) => setEditableMarkdown(e.target.value)}
                        className="font-mono text-xs leading-relaxed min-h-[400px] resize-y"
                        placeholder="Edite o plano em Markdown..."
                      />
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setMarkdownEditMode(false)}>
                          Cancelar
                        </Button>
                        <Button
                          className="flex-1 emerald-gradient text-primary-foreground"
                          onClick={handleSaveMarkdownEdit}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          Salvar texto
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <AiDraftMarkdown text={sheetReviewDraft.text} />
                  )}
                </>
              ) : (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 space-y-3">
                  <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Formato de plano incompatível</p>
                  <p className="text-xs text-[hsl(var(--ink-2))]">
                    Não foi possível ler este rascunho como cardápio estruturado. Abaixo está o registro bruto — revise antes de validar.
                  </p>
                  <pre className="max-h-[min(520px,55vh)] overflow-auto rounded-md border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-3 text-[11px] leading-relaxed text-[hsl(var(--ink-1))] whitespace-pre-wrap break-words font-mono">
                    {sheetReviewDraft.rawText}
                  </pre>
                </div>
              )}

              {/* Read-only notice for completed */}
              {isNutriValidatedReadOnly ? (
                <div className="rounded-lg border-2 border-primary/30 bg-accent/20 p-4 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-display font-semibold text-sm">Plano Validado — Somente Leitura</p>
                    <p className="text-xs text-muted-foreground">Este plano já foi validado e enviado ao cliente. Alterações não são permitidas por segurança jurídica.</p>
                  </div>
                </div>
              ) : (
                <>
                  {reviewSheetMode === "preview" && (
                    <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-[hsl(var(--ink-2))]">
                      Pré-visualização. Para comentar, usar ajuste por IA ou <strong className="text-[hsl(var(--ink-1))]">validar e assinar</strong>, clique em{" "}
                      <strong className="text-[hsl(var(--ink-1))]">Validar</strong> no painel ao lado e assuma este cardápio.
                    </div>
                  )}
                  {reviewSheetMode === "edit" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="expertComment" className="font-display text-sm font-semibold">
                          Comentário do Especialista
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Salve quando terminar. O texto só é enviado ao cliente quando você validar o plano.
                        </p>
                        {expertCommentSavedView && expertCommentCommitted.trim() ? (
                          <div className="mt-1 flex gap-2 rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-3 items-start justify-between">
                            <p className="text-sm text-[hsl(var(--ink-1))] whitespace-pre-wrap flex-1 min-w-0 pr-2">
                              {expertCommentCommitted}
                            </p>
                            <div className="flex shrink-0 gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-[hsl(var(--ink-1))]"
                                aria-label="Editar comentário"
                                onClick={() => {
                                  setExpertCommentDraft(expertCommentCommitted);
                                  setExpertCommentSavedView(false);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                aria-label="Excluir comentário"
                                onClick={() => {
                                  setExpertCommentCommitted("");
                                  setExpertCommentDraft("");
                                  setExpertCommentSavedView(false);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Textarea
                              id="expertComment"
                              placeholder="Adicione suas observações profissionais sobre este plano..."
                              value={expertCommentDraft}
                              onChange={(e) => setExpertCommentDraft(e.target.value)}
                              className="mt-1 min-h-[100px]"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-[hsl(var(--surface-3))]"
                              disabled={!expertCommentDraft.trim()}
                              onClick={() => {
                                const next = expertCommentDraft.trim();
                                if (!next) {
                                  toast.error("Digite um comentário antes de salvar.");
                                  return;
                                }
                                setExpertCommentCommitted(next);
                                setExpertCommentSavedView(true);
                                toast.success("Comentário salvo. Ele será enviado ao validar o plano.");
                              }}
                            >
                              Salvar Comentário
                            </Button>
                          </div>
                        )}
                      </div>

                      {sheetReviewDraft.kind === "structured" ? (
                        <Card className="border-primary/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-display flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              Ajuste do rascunho com IA
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <p className="text-xs text-muted-foreground">{aiCorrectionHint}</p>
                            <Textarea
                              placeholder="Ex.: Trocar o salmão por tilápia; reduzir carboidratos no jantar; incluir iogurte grego na lista de compras..."
                              value={aiInstruction}
                              onChange={(e) => setAiInstruction(e.target.value)}
                              disabled={aiAdjustDisabledByPlan}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleAIAdjust}
                              disabled={adjusting || !aiInstruction.trim() || aiAdjustDisabledByPlan}
                            >
                              {adjusting ? "Enviando..." : "Solicitar ajuste"}
                            </Button>
                          </CardContent>
                        </Card>
                      ) : sheetReviewDraft.kind === "markdown" ? (
                        <>
                          {/* IA para Markdown — mesmo fluxo de limite de tier que o formato estruturado */}
                          <Card className="border-primary/30">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-display flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                Ajuste do plano com IA
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <p className="text-xs text-muted-foreground">{aiCorrectionHint}</p>
                              <Textarea
                                placeholder="Ex: Tire o leite, adicione mais proteína no jantar, reduza carboidratos..."
                                value={aiInstruction}
                                onChange={(e) => setAiInstruction(e.target.value)}
                                disabled={aiAdjustDisabledByPlan}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleAIAdjustMarkdown}
                                disabled={adjusting || !aiInstruction.trim() || aiAdjustDisabledByPlan}
                              >
                                {adjusting ? "Enviando..." : "Solicitar ajuste"}
                              </Button>
                            </CardContent>
                          </Card>
                        </>
                      ) : null}

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setViewMode("pdf");
                            setPrintPlanAfterPdfOpen(true);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" /> Visualizar PDF
                        </Button>
                        <Button className="flex-1 emerald-gradient text-primary-foreground" onClick={handleApprove}>
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Validar e Assinar
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}