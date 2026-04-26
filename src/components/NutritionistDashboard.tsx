import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins, Clock, CheckCircle2, Eye, Sparkles, AlertCircle, TrendingUp, FileText, PieChart, Wallet, DollarSign, Users, Lock, Gift, BookOpen, CreditCard, PartyPopper, MessageSquare, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { adjustDietWithAI, type DietPlan, type ClientData } from "@/services/n8nService";
import { jobCoinCost, type PlanTier } from "@/hooks/usePlanTier";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

import SignatureEditor from "./SignatureEditor";
import DietPlanCard from "./DietPlanCard";
import PremiumDietPlanView from "./PremiumDietPlanView";
import RetentionTab from "./RetentionTab";
import AffiliateTab from "./AffiliateTab";
import PlansModal from "./PlansModal";
import NutriRatingsCard from "./NutriRatingsCard";

type DietRequest = any;

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-status-pending", icon: Clock },
  in_review: { label: "Em Revisão", color: "bg-status-review", icon: Eye },
  completed: { label: "Concluído", color: "bg-status-completed", icon: CheckCircle2 },
};

const monthlyEarnings = [
  { month: "Jan", ganho: 120 },
  { month: "Fev", ganho: 200 },
  { month: "Mar", ganho: 180 },
  { month: "Abr", ganho: 340 },
  { month: "Mai", ganho: 280 },
  { month: "Jun", ganho: 410 },
];

const validationHistory = [
  { month: "Jan", validacoes: 4 },
  { month: "Fev", validacoes: 7 },
  { month: "Mar", validacoes: 6 },
  { month: "Abr", validacoes: 12 },
  { month: "Mai", validacoes: 9 },
  { month: "Jun", validacoes: 14 },
];

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
  onAccept: (r: DietRequest) => void;
  onGoRetention: () => void;
  draft: DietPlan | null;
  clientData: ClientData | any;
  onBack?: () => void;
};

function PatientDetailPanel({ request, userId, profile, onBack, onOpenReview, onOpenPdf, onAccept, onGoRetention, draft, clientData: cd }: RequestPanelCommon) {
  const st = STATUS_CONFIG[(request.status as keyof typeof STATUS_CONFIG) ?? "pending"] ?? STATUS_CONFIG.pending;
  const StatusIcon = st.icon;
  const adherence = typeof (cd as any)?.adherence === "number" && !Number.isNaN(Number((cd as any).adherence))
    ? Math.min(100, Math.max(0, Number((cd as any).adherence)))
    : 0;
  const meals = draft?.meals;
  const displayName = patientLabel(cd as { goal?: string; name?: string; full_name?: string } | null | undefined, request.id);
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
          <p className="mt-1.5 font-display text-lg font-bold text-[hsl(var(--ink-1))]">{cd?.weight != null ? `${cd.weight} kg` : "—"}</p>
        </div>
        <div className="card-clinical p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">Altura</p>
          <p className="mt-1.5 font-display text-lg font-bold text-[hsl(var(--ink-1))]">{cd?.height != null ? `${cd.height} cm` : "—"}</p>
        </div>
        <div className="card-clinical p-4 transition-shadow hover:shadow-sm">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">Objetivo</p>
          <p className="mt-1.5 font-display text-base font-bold leading-tight text-[hsl(var(--ink-1))]">{goalLine(cd?.goal)}</p>
        </div>
        <div className="card-clinical flex flex-col items-center justify-center p-4 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">Adesão</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <AdherenceRing value={adherence} size={88} />
            <span className="font-display text-4xl font-bold tabular-nums text-brand leading-none">{adherence}%</span>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-3 font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Timeline de refeições</p>
        {meals ? (
          <ul className="relative ms-1 space-y-0 border-l border-[hsl(var(--surface-3))] pl-6">
            {MEAL_TIMELINE.map((row, i) => {
              const m = (meals as any)[row.k] as { name?: string; calories?: number } | undefined;
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
            <Button type="button" className="btn-primary flex items-center justify-center gap-2 pulse-brand" onClick={() => onAccept(request)}>
              <Sparkles className="h-4 w-4" />
              Gerar Plano com IA
            </Button>
          ) : (
            <Button type="button" className="btn-primary opacity-50" disabled>
              <Sparkles className="h-4 w-4" /> Sem moedas
            </Button>
          )
        )}
        {request.status === "in_review" && request.nutritionist_id === userId && (
          <Button type="button" className="btn-primary flex items-center justify-center gap-2 pulse-brand" onClick={() => onOpenReview(request)}>
            <Sparkles className="h-4 w-4" />
            Gerar Plano com IA
          </Button>
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
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<DietRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DietRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [expertComment, setExpertComment] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"feed" | "pdf">("feed");
  const [plansOpen, setPlansOpen] = useState(false);
  const [mainTab, setMainTab] = useState("jobs");
  const [clinicTab, setClinicTab] = useState<"list" | "detail">("list");

  const fetchRequests = async () => {
    // RLS already filters: pending (unassigned to others) OR own jobs.
    // Pre-assigned (assigned_nutritionist_id = me) are prioritized in the UI.
    const { data } = await supabase
      .from("diet_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      // Prioritize: my exclusive leads first, then public pending, then in_review/completed
      const sorted = [...data].sort((a: any, b: any) => {
        const aMine = a.assigned_nutritionist_id === user?.id ? 0 : 1;
        const bMine = b.assigned_nutritionist_id === user?.id ? 0 : 1;
        return aMine - bMine;
      });
      setRequests(sorted);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

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
      .on("postgres_changes", { event: "*", schema: "public", table: "diet_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const handleAcceptJob = async (request: DietRequest) => {
    if (!user || !profile) return;

    // Custo de moeda depende do plano. Clínica (e Admin Supremo) = 0.
    const tier = ((profile as any).plan_tier ?? "basic") as PlanTier;
    const isSupreme = user.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
    const coinCost = isSupreme ? 0 : jobCoinCost(tier);

    if (coinCost > 0 && profile.credits < coinCost) {
      toast.error("Créditos insuficientes! Você precisa de pelo menos 1 moeda.");
      return;
    }

    // Optimistic lock: only update if still pending (prevents race condition)
    const { data: updated, error } = await supabase
      .from("diet_requests")
      .update({ status: "in_review", nutritionist_id: user.id })
      .eq("id", request.id)
      .eq("status", "pending") // Lock: only if still pending
      .select()
      .single();

    if (error || !updated) {
      toast.error("Este job já foi aceito por outro nutricionista.");
      fetchRequests(); // Refresh to remove it from feed
      return;
    }

    // Deduct credit after successful lock — plano Clínica / Admin Supremo não gastam moedas.
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
      toast.success("Job aceito! Boa validação.");
    } else {
      await supabase.from("transactions").insert({
        user_id: user.id, amount: 0, type: "job_acceptance",
        description: `Aceitou job #${request.id.slice(0, 8)} (Clínica — validação ilimitada)`,
      });
      toast.success("Job aceito! Validação ilimitada do plano Clínica.");
    }
    setSelectedRequest(updated);
    setViewMode("feed");
    setSheetOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    await supabase.from("diet_requests").update({
      status: "completed",
      notes: expertComment || null,
    }).eq("id", selectedRequest.id);
    toast.success("Plano aprovado e enviado ao cliente!");
    setExpertComment("");
    setSheetOpen(false);
    fetchRequests();
  };

  const handleAIAdjust = async () => {
    if (!selectedRequest || !aiInstruction.trim()) return;
    setAdjusting(true);
    try {
      const currentDraft = selectedRequest.ai_draft as unknown as DietPlan;
      const newDraft = await adjustDietWithAI(currentDraft, aiInstruction);
      await supabase.from("diet_requests").update({ ai_draft: newDraft as any }).eq("id", selectedRequest.id);
      setSelectedRequest({ ...selectedRequest, ai_draft: newDraft as any });
      setAiInstruction("");
      toast.success("Plano ajustado pela IA!");
    } catch { toast.error("Erro ao ajustar plano"); }
    finally { setAdjusting(false); }
  };

  const openReview = (request: DietRequest) => {
    setSelectedRequest(request);
    setExpertComment("");
    setViewMode("feed");
    setSheetOpen(true);
  };

  const openPdfView = (request: DietRequest) => {
    setSelectedRequest(request);
    setViewMode("pdf");
    setSheetOpen(true);
  };

  const draft = selectedRequest?.ai_draft as unknown as DietPlan | null;
  const clientData = selectedRequest?.client_data as any;
  const completedCount = requests.filter(r => r.status === "completed" && r.nutritionist_id === user?.id).length;
  const withdrawalBalance = completedCount * 15;
  const isSelectedCompleted = selectedRequest?.status === "completed";
  const planTier = (profile as any)?.plan_tier as string | undefined;
  const activePatientsCount = requests.filter(
    (r) => r.nutritionist_id === user?.id && (r.status === "in_review" || r.status === "completed"),
  ).length;
  const exclusiveLeads = requests.filter((r) => r.status === "pending" && r.assigned_nutritionist_id === user?.id);

  return (
    <div className="mx-auto min-h-0 max-w-[1600px] bg-[hsl(var(--surface-0))] p-4 md:px-6 md:py-5">
      {/* Welcome Bonus Banner (only when starting with bonus credits and no completed jobs yet) */}
      {profile && profile.credits > 0 && completedCount === 0 && (
        <div className="mb-6 rounded-xl border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-accent/20 to-primary/10 p-4 flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 flex-shrink-0">
            <PartyPopper className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-display font-bold text-sm text-foreground">
              Bem-vindo! Você começou com {profile.credits} moedas de bônus.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Com suas {profile.credits} moedas iniciais, você pode lucrar de{" "}
              <strong className="text-primary">R$ {(profile.credits * 15).toFixed(2)}</strong> a{" "}
              <strong className="text-primary">R$ {(profile.credits * 25).toFixed(2)}</strong>{" "}
              (incluindo bônus de indicação de novos clientes).
            </p>
          </div>
        </div>
      )}

      {profile && profile.credits === 0 && (
        <div className="mb-6 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="font-display font-bold text-sm text-foreground">Suas moedas acabaram!</p>
            <p className="text-xs text-muted-foreground">Assine o Plano Premium para continuar validando dietas.</p>
          </div>
          <Button size="sm" onClick={() => setPlansOpen(true)} className="emerald-gradient text-primary-foreground whitespace-nowrap">
            <CreditCard className="h-4 w-4 mr-1" /> Ver Planos
          </Button>
        </div>
      )}

      {/* Cabeçalho clínico + toolbar */}
      <div className="mb-6 flex flex-col gap-4 border-b border-[1px] border-[hsl(var(--surface-3))] pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-[hsl(var(--ink-1))] md:text-[1.75rem]">
            Painel Clínico
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            {planTier === "premium" || planTier === "clinic" ? (
              <span className="badge-gold w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold">Pro</span>
            ) : planTier === "freemium" ? (
              <span className="w-fit rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ink-2))]">
                Free
              </span>
            ) : (
              <span className="w-fit rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ink-2))]">
                Básico
              </span>
            )}
            <div
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-2.5 text-xs font-bold text-white tabular-nums shadow-sm"
              title="Pacientes ativos (revisão + concluídos com você)"
            >
              {activePatientsCount}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-coin-gold/30 bg-coin-gold/10 px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-coin-gold" />
            <span className="font-display text-sm font-bold text-coin-gold-foreground">{profile?.credits ?? 0}</span>
            <span className="text-[10px] text-[hsl(var(--ink-3))]">moedas</span>
          </div>
          <Button size="sm" onClick={() => setPlansOpen(true)} className="emerald-gradient gap-1 text-primary-foreground">
            <CreditCard className="h-4 w-4" /> Planos
          </Button>
          <Button size="sm" variant="outline" className="gap-1 border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/8" onClick={() => navigate("/blog")}>
            <BookOpen className="h-4 w-4" /> Novo Artigo
          </Button>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
        <TabsList className="h-auto w-full max-w-3xl flex-wrap justify-start gap-1 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-1.5 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="jobs"
            className="gap-1.5 rounded-lg px-4 py-2.5 text-sm data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" /> Solicitações
          </TabsTrigger>
          <TabsTrigger
            value="retention"
            className="gap-1.5 rounded-lg px-4 py-2.5 text-sm data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4" /> Retenção & Acompanhamento
          </TabsTrigger>
          <TabsTrigger
            value="affiliate"
            className="gap-1.5 rounded-lg px-4 py-2.5 text-sm data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:shadow-sm"
          >
            <Gift className="h-4 w-4" /> Indique e Ganhe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-8 focus-visible:outline-none">
          {exclusiveLeads.length > 0 && (
            <div className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] p-0 shadow-sm">
              <div className="flex items-center justify-between border-b border-[1px] border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-4 py-3.5">
                <h2 className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Novos Leads</h2>
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[hsl(var(--primary))] px-2 text-xs font-bold text-white">
                  {exclusiveLeads.length}
                </span>
              </div>
              <ul className="divide-y divide-[hsl(var(--surface-3))]">
                {exclusiveLeads.map((req) => {
                  const d = req.client_data as { goal?: string; name?: string; full_name?: string } | null | undefined;
                  const g = avatarGradientHsl((d?.goal || req.id) as string);
                  const nameLine = patientLabel(d, req.id);
                  return (
                    <li key={req.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
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
                          className="h-8 shrink-0 rounded-full border border-[hsl(var(--primary))] bg-transparent px-3.5 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
                          onClick={() => handleAcceptJob(req)}
                        >
                          Ativar
                        </Button>
                      ) : (
                        <Button type="button" size="sm" className="h-8 shrink-0 rounded-full opacity-50" disabled>
                          Ativar
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-[hsl(var(--ink-3))]">Carregando...</div>
          ) : requests.length === 0 ? (
            <div className="card-clinical py-12 text-center">
              <AlertCircle className="mx-auto mb-3 h-10 w-10 text-[hsl(var(--ink-3))]" />
              <p className="font-display font-medium text-[hsl(var(--ink-1))]">Nenhuma solicitação no momento</p>
              <p className="text-sm text-[hsl(var(--ink-3))]">Novos pedidos aparecerão aqui em tempo real</p>
            </div>
          ) : (
            <>
              <div className="md:hidden">
                <Tabs value={clinicTab} onValueChange={(v) => setClinicTab(v as "list" | "detail")}>
                  <TabsList className="mb-3 grid w-full grid-cols-2 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-1">
                    <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-[hsl(var(--surface-0))]">
                      Lista
                    </TabsTrigger>
                    <TabsTrigger value="detail" className="rounded-lg data-[state=active]:bg-[hsl(var(--surface-0))]" disabled={!selectedRequest}>
                      Detalhe
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="list" className="mt-0 max-h-[min(70vh,520px)] space-y-2 overflow-y-auto pr-0.5">
                    {requests.map((req) => {
                      const d = req.client_data as { goal?: string; age?: number; name?: string; full_name?: string } | null | undefined;
                      const g = avatarGradientHsl((d?.goal || req.id) as string);
                      const vis = listStatusVisual(String(req.status));
                      const isSel = selectedRequest?.id === req.id;
                      const act = (req as { updated_at?: string }).updated_at || req.created_at;
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => {
                            setSelectedRequest(req);
                            setClinicTab("detail");
                          }}
                          className={cn(
                            "card-clinical w-full p-3 text-left transition-shadow hover:shadow-md",
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
                        </button>
                      );
                    })}
                  </TabsContent>
                  <TabsContent value="detail" className="mt-0 min-h-[320px]">
                    {selectedRequest ? (
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
                        clientData={selectedRequest.client_data as any}
                      />
                    ) : null}
                  </TabsContent>
                </Tabs>
              </div>

              <div className="hidden min-h-[min(80vh,560px)] md:flex md:overflow-hidden md:rounded-xl md:border md:border-[1px] md:border-[hsl(var(--surface-3))] md:shadow-sm">
                <aside className="flex w-[240px] shrink-0 flex-col border-r border-[1px] border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))]">
                  <div className="border-b border-[1px] border-[hsl(var(--surface-3))] px-3 py-3">
                    <p className="font-display text-xs font-semibold tracking-wide text-[hsl(var(--ink-2))]">Pacientes</p>
                  </div>
                  <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
                    {requests.map((req) => {
                      const d = req.client_data as { goal?: string; name?: string; full_name?: string } | null | undefined;
                      const g = avatarGradientHsl((d?.goal || req.id) as string);
                      const vis = listStatusVisual(String(req.status));
                      const isSel = selectedRequest?.id === req.id;
                      const act = (req as { updated_at?: string }).updated_at || req.created_at;
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => setSelectedRequest(req)}
                          className={cn(
                            "card-clinical w-full p-2.5 text-left transition-all hover:shadow-sm",
                            isSel && "border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--primary))]/4 shadow-none",
                            !isSel && "border border-transparent",
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
                        </button>
                      );
                    })}
                  </div>
                </aside>
                <main className="min-w-0 flex-1 overflow-y-auto bg-[hsl(var(--surface-0))] p-4 lg:p-6">
                  {selectedRequest ? (
                    <PatientDetailPanel
                      request={selectedRequest}
                      userId={user?.id}
                      profile={profile}
                      onOpenReview={openReview}
                      onOpenPdf={openPdfView}
                      onAccept={handleAcceptJob}
                      onGoRetention={() => setMainTab("retention")}
                      draft={selectedRequest.ai_draft as unknown as DietPlan | null}
                      clientData={selectedRequest.client_data as any}
                    />
                  ) : (
                    <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-sm font-sans text-[hsl(var(--ink-3))]">
                      Selecione um paciente na lista para ver detalhes clínicos.
                    </div>
                  )}
                </main>
              </div>
            </>
          )}

          <section className="space-y-6 border-t border-[1px] border-[hsl(var(--surface-3))] pt-8" aria-label="Métricas do negócio">
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
                    <BarChart data={monthlyEarnings}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-3))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--surface-0))",
                          border: "1px solid hsl(var(--surface-3))",
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="ganho" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                    <LineChart data={validationHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-3))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--surface-0))",
                          border: "1px solid hsl(var(--surface-3))",
                          borderRadius: 8,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="validacoes"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {[
                { label: "Validadas", value: completedCount, em: "text-primary" },
                { label: "Pendentes", value: requests.filter((r) => r.status === "pending").length, em: "text-[hsl(var(--ink-1))]" },
                { label: "Em revisão", value: requests.filter((r) => r.status === "in_review" && r.nutritionist_id === user?.id).length, em: "text-[hsl(var(--ink-1))]" },
                { label: "Saldo", value: `R$ ${withdrawalBalance.toFixed(2)}`, em: "text-primary" },
              ].map((s) => (
                <div key={s.label} className="card-clinical p-4 text-center shadow-sm">
                  <p className={cn("text-2xl font-display font-bold", s.em)}>{s.value}</p>
                  <p className="text-[10px] font-medium text-[hsl(var(--ink-3))]">{s.label}</p>
                </div>
              ))}
            </div>

            <Card className="glass-card border-primary/25 bg-gradient-to-br from-primary/5 via-accent/10 to-primary/5 shadow-sm">
              <CardContent className="grid grid-cols-1 items-center gap-4 p-5 sm:grid-cols-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Disponível</p>
                    <p className="font-display text-lg font-bold text-primary">R$ {withdrawalBalance.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:border-l sm:border-[hsl(var(--surface-3))] sm:pl-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-coin-gold/15">
                    <Coins className="h-5 w-5 text-coin-gold" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Moedas Restantes</p>
                    <p className="font-display text-lg font-bold">{profile?.credits ?? 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:border-l sm:border-[hsl(var(--surface-3))] sm:pl-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Potencial com moedas</p>
                    <p className="font-display text-lg font-bold text-primary">R$ {((profile?.credits ?? 0) * 15).toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <NutriRatingsCard />

            <SignatureEditor />
          </section>
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention">
          <RetentionTab nutritionistName={profile?.full_name || "Nutricionista"} />
        </TabsContent>

        {/* Affiliate Tab */}
        <TabsContent value="affiliate">
          <AffiliateTab />
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
                        Sugerir Alterações com IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        placeholder="Ex: Trocar o salmão por tilápia, reduzir carboidratos no jantar..."
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                      />
                      <Button size="sm" variant="outline" onClick={handleAIAdjust} disabled={adjusting || !aiInstruction.trim()}>
                        {adjusting ? "Ajustando..." : "Aplicar Sugestão IA"}
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

      <PlansModal open={plansOpen} onOpenChange={setPlansOpen} currentTier={(profile as any)?.plan_tier || "basic"} />
    </div>
  );
}