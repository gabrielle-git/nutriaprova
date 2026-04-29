import { useEffect, useMemo, useState, useRef } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTimeGreeting } from "@/lib/timeGreeting";
import { toast } from "sonner";
import { adjustDietWithAI, type DietPlan, type ClientData } from "@/services/n8nService";
import { jobCoinCost, type PlanTier, canUseAI, getTierConfig } from "@/hooks/usePlanTier";
import type { Database, Json } from "@/integrations/supabase/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

import SignatureEditor from "./SignatureEditor";
import DietPlanCard from "./DietPlanCard";
import PremiumDietPlanView from "./PremiumDietPlanView";
import RetentionTab from "./RetentionTab";
import AffiliateTab from "./AffiliateTab";
import NutriRatingsCard from "./NutriRatingsCard";
import ClinicLogoUpload from "./ClinicLogoUpload";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

/** Transações com este `type` contam o uso diário de correções IA (Basic/Premium). */
const AI_CORRECTION_TX_TYPE = "ai_correction";

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
  pending: { label: "Pendente", color: "bg-status-pending", icon: Clock },
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
  onAccept: (r: DietRequest) => Promise<void>;
  onGoRetention: () => void;
  draft: DietPlan | null;
  clientData: StoredClientData | null;
  onBack?: () => void;
  epicRumbleControls?: AnimationControls;
  /** Quando coincide com `request.id`, aceite da solicitação em andamento (sem chamada n8n). */
  acceptingRequestId: string | null;
};

function PatientDetailPanel({
  request,
  userId,
  profile,
  onBack,
  onOpenReview,
  onOpenPdf,
  onAccept,
  onGoRetention,
  draft,
  clientData: cd,
  epicRumbleControls,
  acceptingRequestId,
}: RequestPanelCommon) {
  const st = STATUS_CONFIG[(request.status as keyof typeof STATUS_CONFIG) ?? "pending"] ?? STATUS_CONFIG.pending;
  const StatusIcon = st.icon;
  const adherence = adherenceFromStoredClient(cd);
  const meals = draft?.meals;
  const displayName = patientLabel(cd, request.id);
  const isAcceptingJob = acceptingRequestId === request.id;
  const hasAiDraft =
    !!draft &&
    typeof draft === "object" &&
    !Array.isArray(draft) &&
    "meals" in draft &&
    (draft as DietPlan).meals &&
    typeof (draft as DietPlan).meals === "object";
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
              return (
                <li key={row.k} className="relative pb-6 last:pb-0">
                  <span
                    className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[hsl(var(--surface-0))] shadow-sm"
                    style={{ background: color }}
                  />
                  <p className="text-xs font-medium text-[hsl(var(--ink-1))] font-display">{row.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[hsl(var(--ink-3))] font-sans">
                    {m?.name || "—"}
                    {m?.calories != null ? ` · ${m.calories} kcal` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
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
        {request.status === "in_review" && request.nutritionist_id === userId && (
          hasAiDraft ? (
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
                <Eye className="icon-glow h-4 w-4 shrink-0" />
              </motion.span>
              Visualizar Rascunho da IA
            </motion.button>
          ) : (
            <div className="flex h-11 items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 text-sm text-[hsl(var(--ink-2))]">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <span>Aguardando IA — o rascunho será preenchido pelo fluxo do cliente (n8n).</span>
            </div>
          )
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

export default function NutritionistDashboard() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const epicRumble = useAnimationControls();
  const [requests, setRequests] = useState<DietRequest[]>([]);
  const [completedRequests, setCompletedRequests] = useState<DietRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DietRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [expertComment, setExpertComment] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [aiCorrectionsToday, setAiCorrectionsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"feed" | "pdf">("feed");
  const [mainTab, setMainTab] = useState("jobs");
  const [clinicTab, setClinicTab] = useState<"list" | "detail">("list");
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(false);
  const [acceptingJobRequestId, setAcceptingJobRequestId] = useState<string | null>(null);
  const planTier = normalizePlanTier(profile?.plan_tier);
  const hasAffiliateAccess = planTier === "premium" || planTier === "clinic";
  const hasRetentionAccess = planTier === "premium" || planTier === "clinic";
  const hasExclusiveLeadsAccess = planTier === "premium" || planTier === "clinic";

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
        return fresh ? (fresh as DietRequest) : prev;
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

    // Freemium safety net: ensure new nutritionists start with at least 2 trial credits
    (async () => {
      if (profile && profile.role === "nutritionist" && profile.credits === 0) {
        // Only auto-grant if no transactions yet (truly new user)
        const { data: txs } = await supabase
          .from("transactions")
          .select("id")
          .eq("user_id", profile.user_id)
          .limit(1);
        if (!txs || txs.length === 0) {
          await supabase.from("profiles").update({ credits: 3 }).eq("id", profile.id);
          await supabase.from("transactions").insert({
            user_id: profile.user_id, amount: 3, type: "trial_grant",
            description: "Bônus de boas-vindas: 3 moedas gratuitas",
          });
          await refreshProfile();
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
    return () => { supabase.removeChannel(channel); };
    // Intencional: reage ao perfil carregado; fetchRequests/refreshProfile são estáveis o suficiente para o efeito desejado.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita re-subscribe em todo render
  }, [profile?.id, user?.id]);

  const hasValidDraft = (request: DietRequest | null | undefined) => {
    const maybeDraft = request?.ai_draft as unknown;
    return !!(
      maybeDraft &&
      typeof maybeDraft === "object" &&
      !Array.isArray(maybeDraft) &&
      "meals" in (maybeDraft as Record<string, unknown>)
    );
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

      const { data: updated, error } = await supabase
        .from("diet_requests")
        .update({ status: "in_review", nutritionist_id: user.id, client_data: brandedClientData })
        .eq("id", request.id)
        .eq("status", "pending")
        .select()
        .single();

      if (error || !updated) {
        toast.error("Este job já foi aceito por outro nutricionista.");
        void fetchRequests();
        return;
      }

      if (coinCost > 0) {
        await supabase
          .from("profiles")
          .update({ credits: profile.credits - coinCost })
          .eq("user_id", user.id);

        await supabase.from("transactions").insert({
          user_id: user.id, amount: -coinCost, type: "job_acceptance",
          description: `Aceitou job #${request.id.slice(0, 8)}`,
        });

        await refreshProfile();
        void epicRumble.start({
          x: [0, -3, 3, -2, 2, 0],
          transition: { duration: 0.4 },
        });
        toast.success("Job aceito! Boa validação.");
      } else {
        await supabase.from("transactions").insert({
          user_id: user.id, amount: 0, type: "job_acceptance",
          description: `Aceitou job #${request.id.slice(0, 8)} (Clínica — validação ilimitada)`,
        });
        void epicRumble.start({
          x: [0, -3, 3, -2, 2, 0],
          transition: { duration: 0.4 },
        });
        toast.success("Job aceito! Validação ilimitada do plano Clínica.");
      }

      let row: DietRequest = updated as DietRequest;
      await fetchRequests();

      const { data: refetched } = await supabase.from("diet_requests").select("*").eq("id", row.id).maybeSingle();
      if (refetched) row = refetched as DietRequest;

      setSelectedRequest(row);
      setViewMode("feed");

      if (hasValidDraft(row)) {
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

  const handleApprove = async () => {
    if (!selectedRequest) return;
    const brandedClientData = enrichClientDataWithBranding(selectedRequest.client_data, {
      clinicLogoUrl: profile?.clinic_logo_url ?? null,
      professionalTier: profile?.plan_tier ?? null,
    });
    await supabase.from("diet_requests").update({
      status: "completed",
      notes: expertComment || null,
      client_data: brandedClientData,
    }).eq("id", selectedRequest.id);
    void epicRumble.start({
      x: [0, -3, 3, -2, 2, 0],
      transition: { duration: 0.4 },
    });
    toast.success("Plano aprovado e enviado ao cliente!");
    setExpertComment("");
    setSheetOpen(false);
    fetchRequests();
  };

  const handleAIAdjust = async () => {
    if (!selectedRequest || !aiInstruction.trim() || !user) return;
    if (!hasValidDraft(selectedRequest)) {
      toast.error("Não há rascunho válido para ajustar.");
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

    setAdjusting(true);
    try {
      const currentDraft = selectedRequest.ai_draft as unknown as DietPlan;
      const newDraft = await adjustDietWithAI(currentDraft, aiInstruction.trim());
      const { error: upErr } = await supabase
        .from("diet_requests")
        .update({ ai_draft: newDraft as unknown as Json })
        .eq("id", selectedRequest.id);
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

      setSelectedRequest({ ...selectedRequest, ai_draft: newDraft as unknown as Json });
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

  const openReview = (request: DietRequest) => {
    if (!hasValidDraft(request)) {
      toast.error("Plano ainda indisponível. Aguarde a geração da IA.");
      return;
    }
    setSelectedRequest(request);
    setExpertComment("");
    setViewMode("feed");
    setSheetOpen(true);
  };

  const openPdfView = (request: DietRequest) => {
    if (!hasValidDraft(request)) {
      toast.error("Sem plano disponível para visualização em PDF.");
      return;
    }
    setSelectedRequest(request);
    setViewMode("pdf");
    setSheetOpen(true);
  };

  const draft = selectedRequest?.ai_draft as unknown as DietPlan | null;
  const clientData = asStoredClientData(selectedRequest?.client_data);
  const completedCount = completedRequests.length;
  const withdrawalBalance = completedCount * 15;
  const isSelectedCompleted = selectedRequest?.status === "completed";
  const activePatientsCount = requests.filter(
    (r) => r.nutritionist_id === user?.id && (r.status === "in_review" || r.status === "completed"),
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
          ) : requests.length === 0 ? (
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
                    {requests.map((req, index) => {
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
                            "w-full rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-3 text-left transition-colors",
                            isSel && "border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--primary))]/4",
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
                            onAccept={handleAcceptJob}
                            onGoRetention={() => {
                              setMainTab("retention");
                              setClinicTab("list");
                            }}
                            draft={selectedRequest.ai_draft as unknown as DietPlan | null}
                            clientData={asStoredClientData(selectedRequest.client_data)}
                            epicRumbleControls={epicRumble}
                            acceptingRequestId={acceptingJobRequestId}
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
                    {requests.map((req, index) => {
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
                            "w-full rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-2.5 text-left transition-colors",
                            isSel && "border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--primary))]/4 shadow-none",
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
                          onAccept={handleAcceptJob}
                          onGoRetention={() => setMainTab("retention")}
                          draft={selectedRequest.ai_draft as unknown as DietPlan | null}
                          clientData={asStoredClientData(selectedRequest.client_data)}
                          epicRumbleControls={epicRumble}
                          acceptingRequestId={acceptingJobRequestId}
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
                { label: "Pendentes", value: requests.filter((r) => r.status === "pending").length, em: "text-[hsl(var(--ink-1))]", money: false },
                { label: "Em revisão", value: requests.filter((r) => r.status === "in_review" && r.nutritionist_id === user?.id).length, em: "text-[hsl(var(--ink-1))]", money: false },
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
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">
              {viewMode === "pdf" ? "Visualização do Plano Final" : "Revisão do Plano Alimentar"}
            </SheetTitle>
          </SheetHeader>

          {viewMode === "pdf" && draft ? (
            <div className="mt-6 space-y-6">
              <PremiumDietPlanView
                plan={draft}
                nutritionistName={profile?.full_name}
                crnNumber={profile?.crn_number || undefined}
                isCompleted={isSelectedCompleted}
                clinicLogoUrl={clientData?.clinic_logo_url ?? clientData?.logo_url ?? (profile as { clinic_logo_url?: string | null })?.clinic_logo_url ?? null}
                professionalTier={clientData?.nutritionist_plan_tier ?? profile?.plan_tier ?? null}
              />
            </div>
          ) : draft ? (
            <div className="mt-6 space-y-6">
              {clientData && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Dados do Cliente (anonimizados)</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <p>{clientData.birthDate ? `Nasc: ${new Date(clientData.birthDate).toLocaleDateString("pt-BR")} (${clientData.age} anos)` : `Idade: ${clientData.age} anos`} • Peso: {clientData.weight}kg • Altura: {clientData.height}cm</p>
                    <p>Objetivo: {clientData.goal} • Atividade: {clientData.activityLevel}</p>
                    {clientData.allergies?.length > 0 && <p>Alergias: {clientData.allergies.join(", ")}</p>}
                    {clientData.additionalNotes && (
                      <p className="mt-2 p-2 bg-accent/50 rounded text-xs italic">📝 {clientData.additionalNotes}</p>
                    )}
                  </CardContent>
                </Card>
              )}


              <DietPlanCard plan={draft} showNotes={false} />

              {/* Read-only notice for completed */}
              {isSelectedCompleted ? (
                <div className="rounded-lg border-2 border-primary/30 bg-accent/20 p-4 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-display font-semibold text-sm">Plano Validado — Somente Leitura</p>
                    <p className="text-xs text-muted-foreground">Este plano já foi validado e enviado ao cliente. Alterações não são permitidas por segurança jurídica.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Expert Comment */}
                  <div>
                    <Label htmlFor="expertComment" className="font-display text-sm font-semibold">Comentário do Especialista</Label>
                    <Textarea
                      id="expertComment"
                      placeholder="Adicione suas observações profissionais sobre este plano..."
                      value={expertComment}
                      onChange={(e) => setExpertComment(e.target.value)}
                      className="mt-1"
                    />
                  </div>

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
                        placeholder="Ex: Trocar o salmão por tilápia, reduzir carboidratos no jantar..."
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

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setViewMode("pdf")}>
                      <FileText className="h-4 w-4 mr-2" /> Visualizar PDF
                    </Button>
                    <Button className="flex-1 emerald-gradient text-primary-foreground" onClick={handleApprove}>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Validar e Assinar
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}