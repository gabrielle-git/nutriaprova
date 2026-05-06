import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useInView,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  FileText,
  History,
  Settings2,
  Sparkles,
  Apple,
  CreditCard,
  Lock,
  CheckCircle2,
  Eye,
  Save,
  User2,
  Scale,
  Ruler,
  Flame,
  Target,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getTimeGreeting } from "@/lib/timeGreeting";
import type { DietPlan } from "@/services/n8nService";
import PremiumDietPlanView from "./PremiumDietPlanView";
import DietProgressTracker from "./DietProgressTracker";
import AppHeader from "./AppHeader";
import CheckoutModal from "./CheckoutModal";
import PlansModal from "./PlansModal";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

const NUTRI_TIER_LABELS: Record<string, string> = {
  freemium: "Freemium",
  basic: "Basic",
  premium: "Premium",
  clinic: "Clínica",
};

type HistoryEntry = {
  id: string;
  generatedAt: string;
  goal: string;
  calories: number;
  status:
    | "awaiting_payment"
    | "processing"
    | "pending"
    | "awaiting_validation"
    | "in_review"
    | "completed"
    | string;
  plan: DietPlan | null;
};

const GOAL_OPTIONS = [
  { value: "perder_peso", label: "Perda de Peso", emoji: "🏃" },
  { value: "ganhar_massa", label: "Ganho de Massa Muscular", emoji: "💪" },
  { value: "reeducacao", label: "Reeducação Alimentar", emoji: "🥗" },
  { value: "diabetes", label: "Controle de Diabetes", emoji: "🩺" },
  { value: "performance", label: "Performance Esportiva", emoji: "⚡" },
  { value: "longevidade", label: "Longevidade", emoji: "🧬" },
];

// Alinhado com o onboarding (ClientOnboarding.tsx) — mantemos as mesmas
// labels para que o payload enviado ao n8n continue consistente.
const ALLERGY_OPTIONS = [
  { value: "gluten", label: "Sem Glúten", emoji: "🌾" },
  { value: "lactose", label: "Zero Lactose", emoji: "🥛" },
  { value: "amendoim", label: "Amendoim", emoji: "🥜" },
  { value: "frutos_do_mar", label: "Frutos do Mar", emoji: "🦐" },
  { value: "ovo", label: "Ovo", emoji: "🥚" },
  { value: "soja", label: "Soja", emoji: "🫘" },
  { value: "vegano", label: "Vegano", emoji: "🌱" },
  { value: "vegetariano", label: "Vegetariano", emoji: "🥬" },
];

type CurrentPlanState =
  | { status: "loading" }
  | { status: "empty" }
  | {
      status: "ready";
      plan: DietPlan | null;
      requestStatus:
        | "awaiting_payment"
        | "processing"
        | "pending"
        | "awaiting_validation"
        | "in_review"
        | "completed";
      isCompleted: boolean;
    };

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function normalizeGoalValue(goal: unknown): string {
  const firstGoal = Array.isArray(goal) ? goal[0] : String(goal || "").split(",")[0];
  const normalized = String(firstGoal || "").trim();
  if (!normalized) return "";

  const byValue = GOAL_OPTIONS.find((option) => option.value === normalized);
  if (byValue) return byValue.value;

  const byLabel = GOAL_OPTIONS.find(
    (option) => option.label.toLowerCase() === normalized.toLowerCase(),
  );
  return byLabel?.value ?? normalized;
}

function formatGoalLabel(goal: unknown): string {
  const values = String(Array.isArray(goal) ? goal.join(", ") : goal || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) return "Plano alimentar";

  return values
    .map((value) => GOAL_OPTIONS.find((option) => option.value === value)?.label ?? value)
    .join(", ");
}

function formatRequestStatus(status: string) {
  if (status === "completed") return "Concluído";
  if (status === "awaiting_payment") return "Pagamento pendente";
  if (status === "processing") return "Processando IA";
  if (status === "awaiting_validation") return "Aguardando validação";
  if (status === "in_review") return "Em análise";
  if (status === "pending") return "Pendente";
  return status;
}

/** Exibição — percentual alinhado ao status do `diet_request` (jornada de liberação). */
function planJourneyProgressFromState(state: CurrentPlanState): number {
  if (state.status === "loading" || state.status === "empty") return 0;
  if (state.status === "ready") {
    if (state.requestStatus === "awaiting_payment") return 12;
    if (state.requestStatus === "processing") return 40;
    if (
      state.requestStatus === "pending" ||
      state.requestStatus === "awaiting_validation" ||
      state.requestStatus === "in_review"
    ) {
      return 72;
    }
    if (state.isCompleted) return 100;
  }
  return 0;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ease: [0.16, 1, 0.3, 1] as const, duration: 0.6 },
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

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    const y = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    setTilt({ x, y });
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: "spring", stiffness: 250, damping: 25 }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AnimatedProgressBar({
  percentage,
  className,
  role = "progressbar",
  "aria-valuenow": ariaValueNow,
  "aria-valuemin": ariaValueMin,
  "aria-valuemax": ariaValueMax,
}: {
  percentage: number;
  className?: string;
  role?: string;
  "aria-valuenow"?: number;
  "aria-valuemin"?: number;
  "aria-valuemax"?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  useEffect(() => {
    if (!ref.current || !isInView) return;
    ref.current.style.setProperty("--progress", `${percentage}%`);
  }, [isInView, percentage]);

  return (
    <div
      ref={ref}
      role={role}
      aria-valuenow={ariaValueNow}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      className={cn("progress-animated", className)}
      style={
        {
          "--progress": isInView ? `${percentage}%` : "0%",
        } as CSSProperties
      }
    />
  );
}

export default function ClientDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"plan" | "history" | "settings">("plan");
  const [current, setCurrent] = useState<CurrentPlanState>({ status: "loading" });
  const [hasCompletedPlans, setHasCompletedPlans] = useState(false);
  /** Pontos exibidos no badge: 32 base + 48 por plano com status `completed` (dados reais do Supabase). */
  const [engagementPoints, setEngagementPoints] = useState<number | null>(null);
  const [currentClientData, setCurrentClientData] = useState<Record<string, any>>({});

  // ── Perfil editável — hidratado diretamente do Supabase.
  // `profiles.client_data` é a fonte principal; o último diet_request serve como
  // fallback para usuários que geraram plano antes dessa coluna existir.
  const [profileForm, setProfileForm] = useState({
    gender: "",
    weight: "",
    height: "",
    goal: "",
    bodyFat: "",
    allergies: [] as string[],
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const hydrateProfileForm = async () => {
      const [profileRes, latestRequestRes] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("client_data, allergies, goals")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("diet_requests")
          .select("client_data")
          .eq("client_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      if (profileRes.error) {
        console.warn("[ClientDashboard] profiles hydration:", profileRes.error.message);
      }
      if (latestRequestRes.error) {
        console.warn("[ClientDashboard] diet_requests hydration:", latestRequestRes.error.message);
      }

      const profileRow = profileRes.data as any | null;
      const profileClientData = (profileRow?.client_data ?? {}) as Record<string, any>;
      const latestClientData = ((latestRequestRes.data as any)?.client_data ?? {}) as Record<string, any>;
      const read = (key: string) => {
        const profileValue = profileClientData[key];
        if (
          profileValue !== null &&
          profileValue !== undefined &&
          profileValue !== "" &&
          !(Array.isArray(profileValue) && profileValue.length === 0)
        ) {
          return profileValue;
        }
        return latestClientData[key];
      };
      const allergies = Array.isArray(read("allergies"))
        ? read("allergies")
        : typeof profileRow?.allergies === "string"
        ? profileRow.allergies.split(",").map((item: string) => item.trim()).filter(Boolean)
        : [];
      const goal = read("goal") || profileRow?.goals || "";

      setCurrentClientData({ ...latestClientData, ...profileClientData });
      setProfileForm({
        gender:
          read("gender") === "masculino" || read("gender") === "feminino"
            ? String(read("gender"))
            : "",
        weight: read("weight") ? String(read("weight")) : "",
        height: read("height") ? String(read("height")) : "",
        goal: normalizeGoalValue(goal),
        bodyFat: read("bodyFat") ? String(read("bodyFat")) : "",
        allergies,
      });
    };

    void hydrateProfileForm();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const firstName = useMemo(() => {
    const full = profile?.full_name?.trim() || user?.email?.split("@")[0] || "";
    return full.split(" ")[0] || "Paciente";
  }, [profile, user]);

  const dashboardDateLine = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [],
  );

  const journeyProgress = useMemo(() => planJourneyProgressFromState(current), [current]);

  const kpiBmi = useMemo(() => {
    const w = parseFloat(String(profileForm.weight).replace(",", "."));
    const hCm = parseFloat(String(profileForm.height).replace(",", "."));
    if (!Number.isFinite(w) || !Number.isFinite(hCm) || hCm <= 0) return null;
    return Math.round((w / (hCm / 100) ** 2) * 10) / 10;
  }, [profileForm.weight, profileForm.height]);

  const targetCalories =
    current.status === "ready" && current.plan && typeof current.plan.totalCalories === "number"
      ? current.plan.totalCalories
      : null;

  const refreshCurrentPlan = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("diet_requests")
      .select("id, status, ai_draft, created_at")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[ClientDashboard] diet_requests fetch error:", error.message);
      setCurrent({ status: "empty" });
      return;
    }

    const row = data as unknown as
      | {
          status:
            | "awaiting_payment"
            | "processing"
            | "pending"
            | "awaiting_validation"
            | "in_review"
            | "completed";
          ai_draft: DietPlan | null;
        }
      | null;

    if (!row) {
      setCurrent({ status: "empty" });
      if (profile?.role === "client") {
        navigate("/questionnaire", { replace: true });
      }
      return;
    }

    setCurrent({
      status: "ready",
      plan: row.ai_draft ?? null,
      requestStatus: row.status,
      isCompleted: row.status === "completed",
    });
  }, [user, navigate, profile?.role]);

  // ── Fetch do plano atual (apenas LEITURA — não toca no fluxo de IA) ───────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const refreshEngagement = async () => {
      const { count, error } = await supabase
        .from("diet_requests")
        .select("id", { count: "exact", head: true })
        .eq("client_id", user.id)
        .eq("status", "completed");

      if (cancelled) return;

      if (error) {
        console.warn("[ClientDashboard] completed count:", error.message);
        setHasCompletedPlans(false);
        setEngagementPoints(32);
        return;
      }

      const n = count ?? 0;
      setHasCompletedPlans(n > 0);
      setEngagementPoints(32 + n * 48);
    };

    const load = async () => {
      await refreshCurrentPlan();
      if (!cancelled) await refreshEngagement();
    };

    void load();

    const channel = supabase
      .channel(`client-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "diet_requests",
          filter: `client_id=eq.${user.id}`,
        },
        () => {
          void refreshCurrentPlan();
          void refreshEngagement();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, refreshCurrentPlan]);

  /** Reforço: polling 5s — Realtime nem sempre entrega (n8n via servidor, dev, etc.). */
  useEffect(() => {
    if (!user) return;
    const tick = window.setInterval(() => {
      void refreshCurrentPlan();
    }, 5000);
    return () => clearInterval(tick);
  }, [user, refreshCurrentPlan]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setSavingProfile(true);

    // Persistimos como JSONB na coluna profiles.client_data — a mesma fonte
    // lida pelo useEffect acima, então o form continua consistente após F5.
    const payload = {
      ...currentClientData,
      gender: profileForm.gender,
      weight: profileForm.weight,
      height: profileForm.height,
      goal: profileForm.goal,
      bodyFat: profileForm.bodyFat,
      allergies: profileForm.allergies,
    };

    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ client_data: payload })
        .eq("user_id", user.id);

      if (error) {
        console.error("[ClientDashboard] update client_data falhou:", error);
        toast.error("Não foi possível salvar suas informações. Tente novamente.");
        return;
      }

      // Atualiza o contexto global de auth para que outros componentes
      // (ex: Configurações, Onboarding) vejam os dados mais recentes.
      setCurrentClientData(payload);
      await refreshProfile();
      toast.success("Dados atualizados com sucesso!");
    } catch (err) {
      console.error("[ClientDashboard] erro inesperado ao salvar perfil:", err);
      toast.error("Não foi possível salvar suas informações. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  };

  const isSupremeUser = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const isNutri = profile?.role === "nutritionist" || isSupremeUser;

  const weightNum = (() => {
    const w = parseFloat(String(profileForm.weight).replace(",", "."));
    return Number.isFinite(w) ? w : null;
  })();
  const heightNum = (() => {
    const h = parseFloat(String(profileForm.height).replace(",", "."));
    return Number.isFinite(h) ? h : null;
  })();

  /** Meta calórica só para objetivos de composição (emagrecimento / hipertrofia). */
  const showCalorieGoalKpi = useMemo(() => {
    const g = normalizeGoalValue(profileForm.goal);
    return g === "perder_peso" || g === "ganhar_massa";
  }, [profileForm.goal]);

  const kpiRows = useMemo(() => {
    const rows = [
      {
        key: "w",
        Icon: Scale,
        label: "Peso",
        delta: profileForm.weight ? "Atual" : "—",
        up: true,
        valueNode:
          weightNum != null ? (
            <>
              <AnimatedNumber value={weightNum} decimals={1} /> kg
            </>
          ) : (
            "—"
          ),
      },
      {
        key: "h",
        Icon: Ruler,
        label: "Altura",
        delta: profileForm.height ? "Atual" : "—",
        up: true,
        valueNode:
          heightNum != null ? (
            <>
              <AnimatedNumber value={Math.round(heightNum)} /> cm
            </>
          ) : (
            "—"
          ),
      },
      {
        key: "bmi",
        Icon: Target,
        label: "IMC",
        delta:
          kpiBmi != null
            ? kpiBmi >= 18.5 && kpiBmi < 25
              ? "Faixa saudável"
              : "Acompanhe"
            : "—",
        up: kpiBmi != null && kpiBmi >= 18.5 && kpiBmi < 25,
        valueNode:
          kpiBmi != null ? <AnimatedNumber value={kpiBmi} decimals={1} /> : "—",
      },
    ];
    if (showCalorieGoalKpi) {
      rows.push({
        key: "kcal",
        Icon: Flame,
        label: "Meta calórica",
        delta: targetCalories != null ? "Plano ativo" : "Aguardando",
        up: targetCalories != null,
        valueNode:
          targetCalories != null ? (
            <>
              <AnimatedNumber value={targetCalories} /> kcal
            </>
          ) : (
            "—"
          ),
      });
    }
    return rows;
  }, [
    profileForm.weight,
    profileForm.height,
    weightNum,
    heightNum,
    kpiBmi,
    showCalorieGoalKpi,
    targetCalories,
  ]);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <AppHeader />

      <div className="bg-aurora-soft bg-[hsl(var(--surface-1))]">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="stagger mx-auto max-w-5xl px-4 pt-8 pb-28 sm:px-6 sm:pb-32"
      >
        <motion.header
          variants={itemVariants}
          className="mb-6 flex flex-col justify-between gap-4 border-b border-[hsl(var(--surface-3))] pb-6 md:flex-row md:items-end"
        >
          <div className="min-w-0">
            <p className="mb-1.5 text-[0.6875rem] font-medium uppercase leading-none tracking-widest text-[hsl(var(--ink-3))]">
              {isNutri ? "Área do nutricionista" : "Painel do paciente"}
            </p>
            <h1
              className="font-display font-bold leading-tight text-[hsl(var(--ink-1))] tracking-[-0.02em] text-[1.75rem] sm:text-[1.9rem]"
            >
              {getTimeGreeting()}, {firstName} 👋
            </h1>
            <p
              className="mt-1.5 text-[0.875rem] font-normal capitalize text-[hsl(var(--ink-3))] sm:max-w-none"
              style={{ lineHeight: 1.45 }}
            >
              {dashboardDateLine}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[hsl(var(--ink-2))] sm:text-base">
              {hasCompletedPlans
                ? "Suas metas não param. Vamos ajustar sua rota para o próximo nível?"
                : "Responda ao questionário e acompanhe cada etapa até o desbloqueio do seu plano personalizado."}
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center justify-between gap-2 sm:justify-end">
            {engagementPoints === null ? (
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-light))] px-3 py-1.5 text-sm font-semibold text-[hsl(42,80%,28%)]"
                title="32 pts base + 48 pts por plano concluído (contagem em diet_requests, status completo). Atualiza ao concluir um plano."
              >
                <Flame className="h-4 w-4 text-[hsl(var(--gold))]" aria-hidden />
                <span className="min-w-[2ch] tabular-nums" aria-live="polite">
                  —
                </span>
                <span className="text-xs font-medium opacity-90">pts</span>
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.5 }}
                className="badge-gold magnetic-float-slow inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-[hsl(42,80%,28%)]"
                title="32 pts base + 48 pts por plano concluído (contagem em diet_requests, status completo). Atualiza ao concluir um plano."
              >
                <Flame className="h-4 w-4 text-[hsl(var(--gold))]" aria-hidden />
                <span className="min-w-[2ch] tabular-nums" aria-live="polite">
                  <AnimatedNumber value={engagementPoints} />
                </span>
                <span className="text-xs font-medium opacity-90">pts</span>
              </motion.div>
            )}
          </div>
        </motion.header>

        <motion.div
          variants={itemVariants}
          className={cn(
            "mb-6 grid grid-cols-2 gap-3",
            showCalorieGoalKpi ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          {kpiRows.map((row) => {
            const Icon = row.Icon;
            return (
              <TiltCard key={row.key} className="card-clinical hover-lift p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)] text-primary">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <p className="text-xs font-medium uppercase leading-none tracking-widest text-[hsl(var(--ink-3))]">
                  {row.label}
                </p>
                <p className="mt-2 break-words font-display text-[1.75rem] font-bold leading-none tracking-[-0.03em] text-[hsl(var(--ink-1))]">
                  {row.valueNode}
                </p>
                <p
                  className={`mt-1.5 text-xs ${
                    !row.delta || row.delta === "—"
                      ? "text-[hsl(var(--ink-3))]"
                      : row.up
                        ? "text-[hsl(142,60%,32%)] dark:text-[hsl(150,50%,50%)]"
                        : "text-destructive"
                  }`}
                >
                  {row.delta}
                </p>
              </TiltCard>
            );
          })}
        </motion.div>

        {current.status !== "loading" && current.status !== "empty" && (
          <motion.div variants={itemVariants} className="mb-6 card-clinical p-4 sm:p-5">
            <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-[hsl(var(--ink-3))]">
              Progresso do plano
            </p>
            <div className="mt-2 flex items-center gap-3 sm:gap-4">
              <AnimatedProgressBar
                percentage={journeyProgress}
                className="h-1.5 min-w-0 flex-1 sm:h-[6px]"
                aria-valuenow={journeyProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
              <span className="font-display text-sm font-semibold text-primary tabular-nums sm:text-base">
                <AnimatedNumber value={journeyProgress} />%
              </span>
            </div>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="mb-8">
          <DietProgressTracker />
        </motion.div>

        <motion.div variants={itemVariants} className="w-full pb-6 sm:pb-10">
          <div
            role="tablist"
            aria-label="Seções do painel"
            className="grid h-auto w-full max-w-2xl grid-cols-3 gap-0.5 rounded-full bg-[hsl(var(--surface-2))] p-1 sm:inline-flex"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "plan"}
              onClick={() => setTab("plan")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium sm:w-auto sm:px-4",
                tab === "plan" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))]",
              )}
            >
              {tab === "plan" && (
                <motion.div
                  layoutId="client-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-full bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                {isNutri ? <Crown className="h-4 w-4 shrink-0" /> : <Apple className="h-4 w-4 shrink-0" />}
                <span className="hidden sm:inline">
                  {isNutri ? "Gerenciar assinatura" : "Meu Plano Atual"}
                </span>
                <span className="sm:hidden">{isNutri ? "Assin." : "Plano"}</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "history"}
              onClick={() => setTab("history")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium sm:w-auto sm:px-4",
                tab === "history" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))]",
              )}
            >
              {tab === "history" && (
                <motion.div
                  layoutId="client-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-full bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                <History className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Histórico</span>
                <span className="sm:hidden">Histórico</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "settings"}
              onClick={() => setTab("settings")}
              className={cn(
                "relative z-0 inline-flex min-h-[2.75rem] w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium sm:w-auto sm:px-4",
                tab === "settings" ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-2))]",
              )}
            >
              {tab === "settings" && (
                <motion.div
                  layoutId="client-dash-tab-bg"
                  className="absolute inset-0 z-0 rounded-full bg-[hsl(var(--surface-0))] shadow-sm dark:bg-[hsl(var(--surface-1))]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                <Settings2 className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Meu Perfil</span>
                <span className="sm:hidden">Perfil</span>
              </span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              role="tabpanel"
              initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -20, filter: "blur(4px)" }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 focus-visible:ring-0"
            >
              {tab === "plan" &&
                (isNutri ? (
                  <NutriSubscriptionTab />
                ) : (
                  <CurrentPlanTab
                    state={current}
                    hasCompletedPlans={hasCompletedPlans}
                    onRefreshPlan={refreshCurrentPlan}
                  />
                ))}
              {tab === "history" && <HistoryTab />}
              {tab === "settings" && (
                <SettingsTab
                  form={profileForm}
                  onChange={setProfileForm}
                  onSubmit={handleSaveProfile}
                  saving={savingProfile}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA — ASSINATURA (NUTRICIONISTA em /dashboard)
// ═════════════════════════════════════════════════════════════════════════════
function NutriSubscriptionTab() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [plansOpen, setPlansOpen] = useState(false);
  const tier = String((profile as { plan_tier?: string } | null)?.plan_tier ?? "basic").toLowerCase();
  const label = NUTRI_TIER_LABELS[tier] ?? tier;
  const credits = typeof profile?.credits === "number" ? profile.credits : 0;

  return (
    <>
      <div className="card-clinical overflow-hidden">
        <div className="border-b border-[hsl(var(--surface-3))] p-4 sm:p-5">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-[hsl(var(--ink-3))]">
            Sua assinatura
          </p>
          <h3 className="mt-1 flex items-center gap-2 font-display text-base font-semibold text-[hsl(var(--ink-1))] sm:text-lg">
            <Crown className="h-5 w-5 text-primary" />
            Gerenciar assinatura
          </h3>
          <p className="mt-1 text-sm text-[hsl(var(--ink-2))]">
            Confira o plano ativo, suas moedas e faça upgrade para liberar mais recursos.
          </p>
        </div>
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-4 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <p className="text-xs text-[hsl(var(--ink-3))]">Plano atual</p>
              <p className="font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))]">
                {label}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-[hsl(var(--ink-3))]">Moedas</p>
              <p className="font-display text-xl font-semibold tabular-nums text-primary">
                <AnimatedNumber value={credits} />
              </p>
            </div>
            <Badge
              variant="secondary"
              className="h-fit w-fit border border-primary/20 bg-primary/5 text-primary"
            >
              Ativo
            </Badge>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="btn-primary h-11 gap-2"
              onClick={() => setPlansOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              Ver planos e fazer upgrade
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 border-[hsl(var(--surface-3))]"
              onClick={() => {
                void navigate("/configuracoes?tab=plano");
              }}
            >
              <CreditCard className="h-4 w-4" />
              Cobrança e planos (configurações)
            </Button>
          </div>
          <p className="text-[11px] text-[hsl(var(--ink-3))]">
            O upgrade abre a mesma vitrine de planos do painel (Basic, Premium e Clínica). Pagamento via Pix ou cartão.
          </p>
        </div>
      </div>
      <PlansModal open={plansOpen} onOpenChange={setPlansOpen} currentTier={tier} />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA — MEU PLANO ATUAL
// ═════════════════════════════════════════════════════════════════════════════
function CurrentPlanTab({
  state,
  hasCompletedPlans,
  onRefreshPlan,
}: {
  state: CurrentPlanState;
  hasCompletedPlans: boolean;
  /** Re-lê `diet_requests` após pagamento (Realtime nem sempre dispara em dev). */
  onRefreshPlan: () => Promise<void>;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (state.status === "loading") {
    return (
      <div className="card-clinical p-0">
        <div className="py-20 flex flex-col items-center justify-center gap-3 sm:py-24">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-[hsl(var(--ink-2))]">Carregando seu plano...</p>
        </div>
      </div>
    );
  }

  if (state.status === "empty") {
    return <EmptyPlanState hasCompletedPlans={hasCompletedPlans} />;
  }

  // state.status === "ready"
  const { plan, requestStatus, isCompleted } = state;
  const shouldShowPaywall =
    requestStatus === "awaiting_payment" || requestStatus === "processing";

  return (
    <div className="space-y-4">
      {!isCompleted && !shouldShowPaywall && (
        <div className="card-clinical border-primary/20 bg-[hsl(var(--surface-0))] p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-[hsl(var(--ink-3))]">
              Status
            </p>
            <p className="font-display font-semibold text-sm text-[hsl(var(--ink-1))]">
              {plan
                ? "Rascunho da IA pronto — falta a validação do nutricionista."
                : requestStatus === "processing"
                  ? "Estamos gerando seu plano com IA. Esta tela atualiza sozinha quando o rascunho estiver pronto."
                  : requestStatus === "in_review" || requestStatus === "awaiting_validation"
                    ? "Seu plano está em análise pelo nutricionista."
                    : "Seu pagamento foi aprovado e estamos preparando seu plano com IA."}
            </p>
            <p className="text-xs text-[hsl(var(--ink-2))] mt-0.5">
              {plan
                ? "O que você vê abaixo é uma prévia gerada pela IA. O nutricionista pode ajustar antes de liberar a versão final."
                : "Assim que o rascunho estiver salvo, a tela atualiza automaticamente."}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 border-[hsl(var(--surface-3))] uppercase text-[10px] tracking-wider">
            {plan ? "Rascunho" : requestStatus === "in_review" || requestStatus === "awaiting_validation" ? "Em análise" : "Processando"}
          </Badge>
        </div>
      )}

      {shouldShowPaywall ? (
        <>
          <div className="relative min-h-0 rounded-2xl border border-[hsl(var(--surface-3))]/50">
            <div className="pointer-events-none max-h-[min(70vh,640px)] select-none overflow-hidden rounded-2xl opacity-80 blur-sm">
              <PremiumDietPlanView plan={plan} isCompleted={false} />
            </div>

            <div className="absolute inset-0 z-10 flex min-h-0 items-start justify-center overflow-visible bg-[hsl(var(--surface-0)/0.55)] px-4 py-10 pb-16 backdrop-blur-[2px] sm:items-center sm:py-16">
              <div className="card-clinical my-4 h-auto min-h-fit w-full max-w-md shrink-0 overflow-visible border-primary/30 pb-12 shadow-2xl">
                <div className="h-auto min-h-fit overflow-visible p-6 pb-12 text-center md:p-8 md:pb-12">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full emerald-gradient text-primary-foreground shadow-lg">
                    <Lock className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Plano validado
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl">
                    Seu plano de alta performance está pronto e guardado.
                  </h2>
                  <p className="mt-3 text-sm text-[hsl(var(--ink-2))]">
                    Desbloqueie agora para começar sua transformação.
                  </p>
                  {requestStatus === "processing" && (
                    <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-left text-xs leading-relaxed text-[hsl(var(--ink-1))]">
                      O nutricionista só passa a ver seu pedido no painel depois que você conclui o
                      pagamento. Se você acabou de enviar o questionário, finalize o desbloqueio aqui —
                      sem isso, a equipe não recebe o pedido na fila de validação.
                    </p>
                  )}
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setPaymentOpen(true)}
                    className="btn-primary mt-6 h-12 w-full text-base font-bold shadow-lg hover:scale-[1.01] transition-transform"
                  >
                    <Lock className="mr-2 h-5 w-5" />
                    Desbloquear Meu Cardápio
                  </Button>
                  <p className="mt-3 text-[11px] text-[hsl(var(--ink-3))]">
                    Acesso imediato após confirmação do pagamento.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CheckoutModal
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            amount={39.9}
            onApproved={async () => {
              await onRefreshPlan();
            }}
          />
        </>
      ) : (
        <PremiumDietPlanView plan={plan} isCompleted={isCompleted} />
      )}
    </div>
  );
}

function EmptyPlanState({ hasCompletedPlans }: { hasCompletedPlans: boolean }) {
  const navigate = useNavigate();

  return (
    <div className="card-clinical border-2 border-dashed border-primary/25">
      <div className="flex flex-col items-center px-4 py-14 text-center md:px-6 md:py-20">
        <div className="relative mb-6 magnetic-float" aria-hidden>
          <div className="absolute inset-0 rounded-full bg-[hsl(var(--primary)/0.2)] opacity-30 blur-2xl" />
          <motion.svg
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative mx-auto h-32 w-40 text-primary"
            viewBox="0 0 200 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 100c30-20 50-5 80-15s50-30 100-5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="opacity-40"
            />
            <rect x="60" y="32" width="80" height="56" rx="10" className="fill-[hsl(var(--surface-0))] stroke-primary/30" />
            <path
              d="M78 50h32M78 64h20M78 78h40"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="opacity-70"
            />
            <circle cx="100" cy="20" r="8" className="fill-[hsl(var(--primary-glow))]" fillOpacity="0.9" />
          </motion.svg>
        </div>

        <h2 className="mb-2 max-w-lg font-display text-xl font-semibold text-[hsl(var(--ink-1))] md:text-2xl">
          {hasCompletedPlans
            ? "Suas metas não param. Vamos ajustar sua rota para o próximo nível?"
            : "Vamos iniciar seu questionário personalizado?"}
        </h2>
        <p className="mb-6 max-w-md text-sm font-normal text-[hsl(var(--ink-2))] md:text-base">
          {hasCompletedPlans
            ? "Responda novamente com seus objetivos atuais para receber uma nova estratégia alimentar com validação profissional."
            : "Você vai preencher seus dados corporais e objetivos para que nossa IA monte um plano 100% personalizado."}
        </p>

        <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { icon: User2, label: "Dados básicos", hint: "~ 1 min" },
            { icon: Sparkles, label: "Objetivos", hint: "Escolha múltipla" },
            { icon: CheckCircle2, label: "Validação CRN", hint: "Em até 24h" },
          ].map(({ icon: Icon, label, hint }, index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ x: 6, backgroundColor: "hsl(var(--surface-1))" }}
              className="card-clinical flex items-center gap-3 px-3 py-3 text-left"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)]">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium leading-tight text-[hsl(var(--ink-1))]">{label}</p>
                <p className="text-xs text-[hsl(var(--ink-3))]">{hint}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <Button
          onClick={() => navigate("/questionnaire")}
          className="btn-primary h-11 gap-2 px-6 text-sm font-semibold"
        >
          <Sparkles className="h-4 w-4" />
          {hasCompletedPlans ? "Atualizar metas e gerar novo plano" : "Preencher questionário"}
        </Button>
        <p className="mt-4 text-[11px] text-[hsl(var(--ink-3))]">
          Você não paga nada para gerar. O investimento é só quando o plano for validado.
        </p>
      </div>
    </div>
  );
}

function HistoryTab() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetchHistory = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("diet_requests")
        .select("id, status, client_data, ai_draft, created_at")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.warn("[ClientDashboard] history fetch:", error.message);
        setHistory([]);
        setLoading(false);
        return;
      }

      const entries = ((data ?? []) as any[])
        .map((row) => {
          const plan = (row.ai_draft as DietPlan | null) ?? null;
          return {
            id: String(row.id),
            generatedAt: String(row.created_at),
            goal: formatGoalLabel(row.client_data?.goal),
            calories: Number(plan?.totalCalories || 0),
            status: String(row.status || "pending"),
            plan,
          };
        });

      setHistory(entries);
      setLoading(false);
    };

    void fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
    <div className="card-clinical p-0">
      <div className="border-b border-[hsl(var(--surface-3))] p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-[hsl(var(--ink-3))]">
              Histórico
            </p>
            <h3 className="mt-0.5 flex items-center gap-2 font-display text-base font-semibold text-[hsl(var(--ink-1))] sm:text-lg">
              <History className="h-5 w-5 text-primary" />
              Planos anteriores
            </h3>
            <p className="mt-1 text-sm text-[hsl(var(--ink-2))]">
              Revise suas dietas passadas e a evolução dos seus objetivos ao longo do tempo.
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-[hsl(var(--surface-3))] text-[hsl(var(--ink-2))] sm:inline-flex"
          >
            {history.length} registros
          </Badge>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-[hsl(var(--ink-2))]">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm">Carregando histórico...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-sm text-[hsl(var(--ink-3))]">
            Seu histórico aparecerá aqui assim que você concluir um plano.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 6, backgroundColor: "hsl(var(--surface-1))" }}
                className="group card-clinical flex flex-col gap-4 p-4 transition-shadow hover:shadow-md md:flex-row md:items-center"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-[hsl(var(--primary)/0.08)]">
                  <FileText className="h-5 w-5 text-primary" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-semibold leading-tight text-[hsl(var(--ink-1))]">
                      {entry.goal}
                    </p>
                    <Badge
                      variant={entry.status === "completed" ? "default" : "secondary"}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {formatRequestStatus(entry.status)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[hsl(var(--ink-3))]">
                    Gerado em {formatHistoryDate(entry.generatedAt)}
                  </p>
                  {entry.status === "awaiting_payment" && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Quase lá! Finalize seu acesso para liberar sua dieta.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-[hsl(var(--ink-3))]">Calorias/dia</p>
                    <p className="font-display text-lg font-bold leading-tight text-[hsl(var(--ink-1))]">
                      {entry.calories > 0 ? <AnimatedNumber value={entry.calories} /> : "--"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-[hsl(var(--surface-3))] opacity-80 hover:border-primary/40 hover:opacity-100"
                    disabled={!entry.plan}
                    onClick={() => setSelected(entry)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {entry.plan ? "Visualizar" : "Aguardando IA"}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Slide-over com os detalhes do plano selecionado */}
    <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {selected?.goal ?? "Detalhes do Plano"}
          </SheetTitle>
          <SheetDescription>
            {selected && `Gerado em ${formatHistoryDate(selected.generatedAt)}`}
          </SheetDescription>
        </SheetHeader>

        {selected && (
          <div className="mt-6 space-y-5">
            <PremiumDietPlanView plan={selected.plan} isCompleted={selected.status === "completed"} />
            <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-3">
              Visualização somente leitura. Para gerar um novo plano, volte à aba
              <strong> Meu Plano Atual</strong>.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA — CONFIGURAÇÕES & PERFIL
// ═════════════════════════════════════════════════════════════════════════════
type ProfileForm = {
  gender: string;
  weight: string;
  height: string;
  goal: string;
  bodyFat: string;
  allergies: string[];
};

function SettingsTab({
  form,
  onChange,
  onSubmit,
  saving,
}: {
  form: ProfileForm;
  onChange: (next: ProfileForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
}) {
  const update = (patch: Partial<ProfileForm>) => onChange({ ...form, ...patch });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="card-clinical lg:col-span-3">
        <div className="border-b border-[hsl(var(--surface-3))] p-4 sm:p-5">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-[hsl(var(--ink-3))]">
            Perfil
          </p>
          <h3 className="mt-1 flex items-center gap-2 font-display text-base font-semibold text-[hsl(var(--ink-1))] sm:text-lg">
            <User2 className="h-5 w-5 text-primary" />
            Dados do perfil
          </h3>
          <p className="mt-1 text-sm text-[hsl(var(--ink-2))]">
            Mantenha seus dados atualizados para que a IA gere planos sempre precisos.
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label>Gênero</Label>
                <Select value={form.gender} onValueChange={(v) => update({ gender: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu gênero" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dash-weight">Peso atual (kg)</Label>
                <Input
                  id="dash-weight"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 72,5"
                  value={form.weight}
                  onChange={(e) => update({ weight: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="dash-height">Altura (cm)</Label>
                <Input
                  id="dash-height"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 170"
                  value={form.height}
                  onChange={(e) => update({ height: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Objetivo atual</Label>
                <Select value={form.goal} onValueChange={(v) => update({ goal: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu objetivo principal" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="inline-flex items-center gap-2">
                          <span>{opt.emoji}</span>
                          <span>{opt.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dash-bf">
                Percentual de gordura <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="dash-bf"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 18"
                  value={form.bodyFat}
                  onChange={(e) => update({ bodyFat: e.target.value })}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se tiver uma bioimpedância recente, o valor torna o cálculo calórico ainda mais preciso.
              </p>
            </div>

            {/* Alergias — multi-select, com toggle por botão. */}
            <div className="space-y-1.5">
              <Label>Alergias e Restrições</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALLERGY_OPTIONS.map((opt, index) => {
                  const selected = form.allergies.includes(opt.label);
                  return (
                    <motion.div
                      key={opt.value}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={{ x: 6, backgroundColor: "hsl(var(--surface-1))" }}
                      className="rounded-lg"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            allergies: selected
                              ? form.allergies.filter((a) => a !== opt.label)
                              : [...form.allergies, opt.label],
                          })
                        }
                        className={`flex w-full items-center gap-2 rounded-lg border-2 p-2.5 text-left transition-all ${
                          selected
                            ? "border-destructive/60 bg-destructive/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        aria-pressed={selected}
                      >
                        <span className="text-base" aria-hidden>
                          {opt.emoji}
                        </span>
                        <span className="flex-1 text-xs font-medium">{opt.label}</span>
                        <motion.div
                          animate={{
                            scale: selected ? [1, 1.3, 1] : 1,
                            rotate: selected ? [0, 8, 0] : 0,
                          }}
                          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                          className="flex shrink-0"
                        >
                          {selected && <CheckCircle2 className="h-3.5 w-3.5 text-destructive" />}
                        </motion.div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                A IA considera estas restrições em todos os próximos planos.
              </p>
            </div>

            <Separator />

            <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-end gap-3">
              <p className="text-xs text-muted-foreground md:mr-auto">
                As alterações entram em vigor no próximo plano gerado.
              </p>
              <Button type="submit" disabled={saving} className="gap-2 min-w-[140px]">
                {saving ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <div className="card-clinical lg:col-span-2">
        <div className="border-b border-[hsl(var(--surface-3))] p-4 sm:p-5">
          <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-[hsl(var(--ink-3))]">
            Pagamento
          </p>
          <h3 className="mt-1 flex items-center gap-2 font-display text-base font-semibold text-[hsl(var(--ink-1))] sm:text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            Métodos de pagamento
          </h3>
          <p className="mt-1 text-sm text-[hsl(var(--ink-2))]">
            Gerencie cartões, Pix e recibos para validações futuras.
          </p>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <p className="font-display font-semibold text-sm mb-1">
              Nenhum método cadastrado
            </p>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Em breve você poderá salvar cartão de crédito, chave Pix favorita e gerenciar recibos — tudo em um só lugar.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled
              aria-disabled="true"
            >
              <Lock className="h-3.5 w-3.5" />
              Em breve
            </Button>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/50 p-3 text-xs text-muted-foreground leading-relaxed">
            🔒 Seus dados de pagamento serão criptografados e processados por gateways certificados (Stripe / Mercado Pago).
            A nutrIAprova <strong>nunca</strong> armazena o número completo do cartão.
          </div>
        </div>
      </div>
    </div>
  );
}
