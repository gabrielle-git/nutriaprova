import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  FileText,
  History,
  Settings2,
  Sparkles,
  Apple,
  CreditCard,
  Lock,
  Utensils,
  CheckCircle2,
  Eye,
  Save,
  User2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import type { DietPlan } from "@/services/n8nService";
import PremiumDietPlanView from "./PremiumDietPlanView";
import DietProgressTracker from "./DietProgressTracker";
import AppHeader from "./AppHeader";
import CheckoutModal from "./CheckoutModal";

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

// ─────────────────────────────────────────────────────────────────────────────
// Theme toggle — consome o ThemeProvider já existente em src/hooks/useTheme.tsx
// ─────────────────────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      className="gap-2 border-border/60 hover:bg-accent/40"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline text-xs font-medium">
        {isDark ? "Claro" : "Escuro"}
      </span>
    </Button>
  );
}

export default function ClientDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"plan" | "history" | "settings">("plan");
  const [current, setCurrent] = useState<CurrentPlanState>({ status: "loading" });
  const [hasCompletedPlans, setHasCompletedPlans] = useState(false);
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

  // ── Fetch do plano atual (apenas LEITURA — não toca no fluxo de IA) ───────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const fetchCurrent = async () => {
      const { data, error } = await supabase
        .from("diet_requests")
        .select("id, status, ai_draft, created_at")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn("[ClientDashboard] diet_requests fetch error:", error.message);
        setCurrent({ status: "empty" });
        return;
      }

      // O nutricionista atualiza o próprio `ai_draft` quando aprova/ajusta;
      // portanto ele representa tanto o rascunho quanto a versão final.
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
    };

    fetchCurrent();

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
        () => fetchCurrent(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, navigate, profile?.role]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchCompletedFlag = async () => {
      const { data, error } = await supabase
        .from("diet_requests")
        .select("id")
        .eq("client_id", user.id)
        .eq("status", "completed")
        .limit(1);

      if (cancelled) return;
      if (error) {
        console.warn("[ClientDashboard] completed flag fetch:", error.message);
        return;
      }

      setHasCompletedPlans((data ?? []).length > 0);
    };

    void fetchCompletedFlag();
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header global — fornece navegação 'Início', Sair (signOut), notificações
          e acesso rápido ao perfil. Evita que o paciente fique "preso" no painel. */}
      <AppHeader />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
        {/* ═══════════ CABEÇALHO DO PAINEL ═══════════ */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8"
        >
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-primary font-semibold">
              Painel do Paciente
            </p>
            <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground">
              Olá, {firstName}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-xl">
              {hasCompletedPlans
                ? "Suas metas não param. Vamos ajustar sua rota para o próximo nível?"
                : "Responda ao questionário e acompanhe cada etapa até o desbloqueio do seu plano personalizado."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Blog — acesso APENAS LEITURA para o cliente (RBAC). */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/blog")}
              aria-label="Abrir o Blog"
              className="gap-2 border-border/60 hover:bg-accent/40"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline text-xs font-medium">Blog</span>
            </Button>
            <ThemeToggle />
          </div>
        </motion.header>

        {/* Tracker de status do plano ativo — barra de 4 passos (pagamento → IA → nutri → pronto). */}
        <div className="mb-6 -mx-4 md:-mx-0">
          <DietProgressTracker />
        </div>

        {/* ═══════════ TABS PRINCIPAIS ═══════════ */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="w-full md:w-auto grid grid-cols-3 md:inline-flex h-auto p-1 bg-muted/60 backdrop-blur-sm">
            <TabsTrigger value="plan" className="gap-2 py-2.5">
              <Apple className="h-4 w-4" />
              <span className="hidden sm:inline">Meu Plano Atual</span>
              <span className="sm:hidden">Plano</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 py-2.5">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
              <span className="sm:hidden">Histórico</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 py-2.5">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Meu Perfil</span>
              <span className="sm:hidden">Perfil</span>
            </TabsTrigger>
          </TabsList>

          {/* ─────────── ABA 1 — MEU PLANO ATUAL ─────────── */}
          <TabsContent value="plan" className="mt-6 focus-visible:ring-0">
            <CurrentPlanTab state={current} hasCompletedPlans={hasCompletedPlans} />
          </TabsContent>

          {/* ─────────── ABA 2 — HISTÓRICO ─────────── */}
          <TabsContent value="history" className="mt-6 focus-visible:ring-0">
            <HistoryTab />
          </TabsContent>

          {/* ─────────── ABA 3 — CONFIGURAÇÕES & PERFIL ─────────── */}
          <TabsContent value="settings" className="mt-6 focus-visible:ring-0">
            <SettingsTab
              form={profileForm}
              onChange={setProfileForm}
              onSubmit={handleSaveProfile}
              saving={savingProfile}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ABA — MEU PLANO ATUAL
// ═════════════════════════════════════════════════════════════════════════════
function CurrentPlanTab({
  state,
  hasCompletedPlans,
}: {
  state: CurrentPlanState;
  hasCompletedPlans: boolean;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);

  if (state.status === "loading") {
    return (
      <Card className="glass-card">
        <CardContent className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando seu plano...</p>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "empty") {
    return <EmptyPlanState hasCompletedPlans={hasCompletedPlans} />;
  }

  // state.status === "ready"
  const { plan, requestStatus, isCompleted } = state;
  const shouldShowPaywall = requestStatus === "awaiting_payment";

  return (
    <div className="space-y-4">
      {!isCompleted && requestStatus !== "awaiting_payment" && (
        <div className="rounded-xl border border-primary/30 bg-accent/30 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-display font-semibold text-sm">
              {requestStatus === "in_review" || requestStatus === "awaiting_validation"
                ? "Seu plano está em análise pelo nutricionista."
                : "Seu pagamento foi aprovado e agora estamos processando seu plano com IA."}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acompanhe o tracker de status até a liberação da versão completa.
            </p>
          </div>
          <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
            {requestStatus === "in_review" || requestStatus === "awaiting_validation"
              ? "Em análise"
              : "Processando"}
          </Badge>
        </div>
      )}

      {shouldShowPaywall ? (
        <>
          <div className="relative overflow-hidden rounded-2xl">
            <div className="blur-md pointer-events-none select-none opacity-80 max-h-[820px] overflow-hidden">
              <PremiumDietPlanView plan={plan} isCompleted={false} />
            </div>

            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/45 backdrop-blur-[2px] px-4">
              <Card className="w-full max-w-md border-primary/30 bg-card/95 shadow-2xl">
                <CardContent className="p-6 md:p-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full emerald-gradient text-primary-foreground shadow-lg">
                    <Lock className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Plano validado
                  </p>
                  <h2 className="font-display text-2xl md:text-3xl font-bold mt-2">
                    Seu plano de alta performance está pronto e guardado.
                  </h2>
                  <p className="text-sm text-muted-foreground mt-3">
                    Desbloqueie agora para começar sua transformação.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setPaymentOpen(true)}
                    className="mt-6 w-full h-14 text-base font-bold emerald-gradient text-primary-foreground shadow-lg hover:scale-[1.01] transition-transform"
                  >
                    <Lock className="mr-2 h-5 w-5" />
                    Desbloquear Meu Cardápio
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-3">
                    Acesso imediato após confirmação do pagamento.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <CheckoutModal
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            amount={39.9}
            onApproved={() => {
              toast.success("Pagamento aprovado! Agora estamos processando seu plano.");
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
    <Card className="glass-card border-dashed border-2 border-primary/20">
      <CardContent className="py-14 md:py-20 px-6 flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full emerald-gradient opacity-20 blur-2xl" />
          <div className="relative w-20 h-20 rounded-full bg-accent/60 border border-primary/20 flex items-center justify-center">
            <Utensils className="h-9 w-9 text-primary" />
          </div>
        </div>

        <h2 className="font-display font-bold text-2xl md:text-3xl mb-2">
          {hasCompletedPlans
            ? "Suas metas não param. Vamos ajustar sua rota para o próximo nível?"
            : "Vamos iniciar seu questionário personalizado?"}
        </h2>
        <p className="text-muted-foreground max-w-md text-sm md:text-base mb-6">
          {hasCompletedPlans
            ? "Responda novamente com seus objetivos atuais para receber uma nova estratégia alimentar com validação profissional."
            : "Você vai preencher seus dados corporais e objetivos para que nossa IA monte um plano 100% personalizado."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-2xl w-full mb-8">
          {[
            { icon: User2, label: "Dados básicos", hint: "~ 1 min" },
            { icon: Sparkles, label: "Objetivos", hint: "Escolha múltipla" },
            { icon: CheckCircle2, label: "Validação CRN", hint: "Em até 24h" },
          ].map(({ icon: Icon, label, hint }) => (
            <div
              key={label}
              className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 flex items-center gap-3 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={() => navigate("/questionnaire")}
          size="lg"
          className="emerald-gradient text-primary-foreground gap-2 px-8 h-12 text-base"
        >
          <Sparkles className="h-5 w-5" />
          {hasCompletedPlans ? "Atualizar metas e gerar novo plano" : "Preencher questionário"}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-4">
          Você não paga nada para gerar. O investimento é só quando o plano for validado.
        </p>
      </CardContent>
    </Card>
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
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Planos Anteriores
            </CardTitle>
            <CardDescription className="mt-1">
              Revise suas dietas passadas e a evolução dos seus objetivos ao longo do tempo.
            </CardDescription>
          </div>
          <Badge variant="outline" className="hidden md:inline-flex">
            {history.length} registros
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm">Carregando histórico...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Seu histórico aparecerá aqui assim que você concluir um plano.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="group rounded-xl border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-accent/20 transition-all p-4 flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl emerald-gradient/10 bg-accent/60 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-semibold text-base leading-tight">
                      {entry.goal}
                    </p>
                    <Badge
                      variant={entry.status === "completed" ? "default" : "secondary"}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {formatRequestStatus(entry.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gerado em {formatHistoryDate(entry.generatedAt)}
                  </p>
                  {entry.status === "awaiting_payment" && (
                    <p className="text-xs text-primary mt-1 font-medium">
                      Quase lá! Finalize seu acesso para liberar sua dieta.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Calorias/dia</p>
                    <p className="font-display font-bold text-lg leading-tight">
                      {entry.calories > 0 ? entry.calories.toLocaleString("pt-BR") : "--"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 opacity-80 group-hover:opacity-100"
                    disabled={!entry.plan}
                    onClick={() => setSelected(entry)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {entry.plan ? "Visualizar" : "Aguardando IA"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Bloco 1: Dados corporais + objetivo */}
      <Card className="glass-card lg:col-span-3">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <User2 className="h-5 w-5 text-primary" />
            Dados do Perfil
          </CardTitle>
          <CardDescription>
            Mantenha seus dados atualizados para que a IA gere planos sempre precisos.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                {ALLERGY_OPTIONS.map((opt) => {
                  const selected = form.allergies.includes(opt.label);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        update({
                          allergies: selected
                            ? form.allergies.filter((a) => a !== opt.label)
                            : [...form.allergies, opt.label],
                        })
                      }
                      className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left ${
                        selected
                          ? "border-destructive/60 bg-destructive/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      aria-pressed={selected}
                    >
                      <span className="text-base" aria-hidden>
                        {opt.emoji}
                      </span>
                      <span className="text-xs font-medium flex-1">{opt.label}</span>
                      {selected && <CheckCircle2 className="h-3.5 w-3.5 text-destructive" />}
                    </button>
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
        </CardContent>
      </Card>

      {/* Bloco 2: Métodos de pagamento (placeholder visual) */}
      <Card className="glass-card lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Métodos de Pagamento
          </CardTitle>
          <CardDescription>
            Gerencie cartões, Pix e recibos para validações futuras.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
