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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Clock, CheckCircle2, Eye, Sparkles, AlertCircle, TrendingUp, FileText, PieChart, Wallet, DollarSign, Users, Lock, Gift, BookOpen, CreditCard, PartyPopper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { adjustDietWithAI, type DietPlan } from "@/services/n8nService";
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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Painel do Nutricionista</h1>
          <p className="text-muted-foreground text-sm">Feed de solicitações em tempo real</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-coin-gold/10 border border-coin-gold/30">
            <Coins className="h-4 w-4 text-coin-gold" />
            <span className="font-display font-bold text-coin-gold-foreground">{profile?.credits ?? 0}</span>
            <span className="text-xs text-muted-foreground">moedas</span>
          </div>
          <Button
            size="sm"
            onClick={() => setPlansOpen(true)}
            className="emerald-gradient text-primary-foreground gap-1"
          >
            <CreditCard className="h-4 w-4" /> Planos e Assinaturas
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => navigate("/blog")}
          >
            <BookOpen className="h-4 w-4" /> Novo Artigo
          </Button>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <Tabs defaultValue="jobs" className="space-y-6">
        <TabsList>
          <TabsTrigger value="jobs">
            <FileText className="h-4 w-4 mr-1" /> Solicitações
          </TabsTrigger>
          <TabsTrigger value="retention">
            <Users className="h-4 w-4 mr-1" /> Retenção & Acompanhamento
          </TabsTrigger>
          <TabsTrigger value="affiliate">
            <Gift className="h-4 w-4 mr-1" /> Indique e Ganhe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Ganho Mensal (R$)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlyEarnings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="ganho" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  Dietas Validadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={validationHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Line type="monotone" dataKey="validacoes" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={{ fill: "hsl(160, 84%, 39%)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-display font-bold text-primary">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Validadas</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-display font-bold">{requests.filter(r => r.status === "pending").length}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-display font-bold">{requests.filter(r => r.status === "in_review" && r.nutritionist_id === user?.id).length}</p>
                <p className="text-xs text-muted-foreground">Em Revisão</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-2xl font-display font-bold text-primary">R$ {withdrawalBalance.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Saldo Disponível</p>
              </CardContent>
            </Card>
          </div>

          {/* Unified Balance & Earnings Card (replaces redundant R$ 15 mentions) */}
          <Card className="glass-card border-primary/30 bg-gradient-to-br from-primary/5 via-accent/10 to-primary/5">
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/15 flex-shrink-0">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo Disponível</p>
                  <p className="font-display font-bold text-lg text-primary">R$ {withdrawalBalance.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:border-l sm:border-border/50 sm:pl-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-coin-gold/15 flex-shrink-0">
                  <Coins className="h-5 w-5 text-coin-gold" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Moedas Restantes</p>
                  <p className="font-display font-bold text-lg">{profile?.credits ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:border-l sm:border-border/50 sm:pl-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/15 flex-shrink-0">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Potencial com moedas</p>
                  <p className="font-display font-bold text-lg text-primary">
                    R$ {((profile?.credits ?? 0) * 15).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Ratings */}
          <NutriRatingsCard />

          {/* Signature Editor */}
          <SignatureEditor />

          {/* Request Feed */}
          <h2 className="text-xl font-display font-semibold">Solicitações</h2>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : requests.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhuma solicitação no momento</p>
                <p className="text-muted-foreground">Novos pedidos aparecerão aqui em tempo real</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {requests.map((req) => {
                const status = STATUS_CONFIG[req.status];
                const StatusIcon = status.icon;
                const data = req.client_data as any;
                return (
                  <Card key={req.id} className="glass-card hover:shadow-md transition-shadow">
                    <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${status.color}`} />
                        <div>
                          <p className="font-medium flex items-center gap-2 flex-wrap">
                            Pedido #{req.id.slice(0, 8)}
                            {data?.goal && (
                              <span className="text-muted-foreground text-sm">
                                — {data.goal === "perder_peso" ? "Emagrecimento" : data.goal === "ganhar_massa" ? "Ganho de Massa" : "Manutenção"}
                              </span>
                            )}
                            {req.assigned_nutritionist_id === user?.id && (
                              <Badge className="bg-primary/15 text-primary border-primary/40 text-[10px] gap-1">
                                <Gift className="h-3 w-3" /> Lead Exclusivo (Sua Indicação)
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {data?.birthDate ? `Nasc: ${new Date(data.birthDate).toLocaleDateString("pt-BR")}` : data?.age ? `${data.age} anos` : ""} {data?.weight && `• ${data.weight}kg`} • {new Date(req.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        {req.status === "pending" && (
                          profile && profile.credits > 0 ? (
                            <Button size="sm" onClick={() => handleAcceptJob(req)}>
                              <Coins className="h-4 w-4 mr-1" /> Aceitar (1 moeda)
                            </Button>
                          ) : (
                            <Button size="sm" disabled className="opacity-50">
                              <Coins className="h-4 w-4 mr-1" /> Sem moedas
                            </Button>
                          )
                        )}
                        {req.status === "in_review" && req.nutritionist_id === user?.id && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openReview(req)}>
                              <Eye className="h-4 w-4 mr-1" /> Revisar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openPdfView(req)}>
                              <FileText className="h-4 w-4 mr-1" /> Ver PDF
                            </Button>
                          </div>
                        )}
                        {req.status === "completed" && req.nutritionist_id === user?.id && (
                          <Button size="sm" variant="ghost" onClick={() => openPdfView(req)}>
                            <FileText className="h-4 w-4 mr-1" /> Ver PDF
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
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