import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Leaf, LogOut, ShieldCheck, Users, Stethoscope, DollarSign, AlertTriangle, Clock, Eye, FileText, Coins, Zap, Bot, FlaskConical, Share2, MousePointerClick, Copy as CopyIcon, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AdminSimulationView from "@/components/AdminSimulationView";
import RetentionBotPreview from "@/components/RetentionBotPreview";
import { fetchInvitePerformance, type ProfessionalPerformance } from "@/services/inviteAnalytics";
import { adminSetProfessionalApproval } from "@/services/profileSecurityService";

type Profile = any;
type Transaction = any;
type DietRequest = any;

export default function Admin() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dietRequests, setDietRequests] = useState<DietRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [devMode, setDevMode] = useState(false);
  const [mockView, setMockView] = useState<"admin" | "nutritionist" | "client">("admin");
  const [creditAmount, setCreditAmount] = useState<Record<string, string>>({});

  // Simulation
  const [simRequest, setSimRequest] = useState<DietRequest | null>(null);
  const [simOpen, setSimOpen] = useState(false);

  // Performance de Convites
  const [invitePerf, setInvitePerf] = useState<ProfessionalPerformance[]>([]);
  const [loadingInvitePerf, setLoadingInvitePerf] = useState(false);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
      void loadInvitePerformance();
    }
  }, [isAdmin]);

  const loadInvitePerformance = async () => {
    setLoadingInvitePerf(true);
    try {
      const rows = await fetchInvitePerformance();
      setInvitePerf(rows);
    } finally {
      setLoadingInvitePerf(false);
    }
  };

  const fetchData = async () => {
    setLoadingData(true);
    const [profilesRes, transactionsRes, dietRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("diet_requests").select("*").order("created_at", { ascending: false }),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (dietRes.data) setDietRequests(dietRes.data);
    setLoadingData(false);
  };

  const toggleApproval = async (p: Profile) => {
    try {
      await adminSetProfessionalApproval(p.user_id, !p.approved);
      toast.success(p.approved ? "Nutricionista suspenso" : "Nutricionista aprovado");
      fetchData();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const addCredits = async (p: Profile) => {
    const amount = parseInt(creditAmount[p.id] || "0");
    if (!amount || amount <= 0) { toast.error("Informe um valor válido"); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ credits: p.credits + amount })
      .eq("id", p.id);
    if (error) { toast.error("Erro ao adicionar créditos"); return; }
    await supabase.from("transactions").insert({
      user_id: p.user_id,
      amount,
      type: "credit_purchase" as const,
      description: `Admin adicionou ${amount} moedas manualmente`,
    });
    toast.success(`${amount} moedas adicionadas para ${p.full_name}`);
    setCreditAmount({ ...creditAmount, [p.id]: "" });
    fetchData();
  };

  const getHoursPending = (createdAt: string) =>
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Leaf className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  const nutritionists = profiles.filter((p) => p.role === "nutritionist");
  const clients = profiles.filter((p) => p.role === "client");
  const totalRevenue = transactions
    .filter((t) => t.type === "credit_purchase")
    .reduce((acc, t) => acc + t.amount, 0);
  const pendingRequests = dietRequests.filter((r) => r.status === "pending");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <Leaf className="h-5 w-5 text-primary" />
          <span className="font-display font-bold">Nutr<span className="text-brand-animated">IAprova</span></span>
          <span className="badge-live text-xs min-h-[1em]" aria-hidden />
          <Badge variant="outline" className="ml-2 text-xs border-destructive text-destructive">ADMIN</Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.full_name || user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Title + Dev Mode + View Toggles */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 md:h-7 w-6 md:w-7 text-primary" />
            Painel Administrativo
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {/* Dev Mode Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-destructive/30 bg-destructive/5">
              <FlaskConical className="h-4 w-4 text-destructive" />
              <span className="text-xs font-semibold">Dev Test Mode</span>
              <Switch checked={devMode} onCheckedChange={setDevMode} />
            </div>
            {/* View Toggles */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Visão:</span>
              {(["admin", "nutritionist", "client"] as const).map((v) => (
                <Button
                  key={v}
                  size="sm"
                  variant={mockView === v ? "default" : "outline"}
                  onClick={() => {
                    setMockView(v);
                    toast.info(`Modo: ${v === "admin" ? "Administrador" : v === "nutritionist" ? "Nutricionista" : "Cliente"}`);
                  }}
                  className="text-xs"
                >
                  {v === "admin" ? "Admin" : v === "nutritionist" ? "Nutri" : "Cliente"}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Dev Mode Banner */}
        {devMode && (
          <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 mb-6 flex items-center gap-3">
            <Zap className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-display font-bold text-sm">🧪 Developer God Mode Ativo</p>
              <p className="text-xs text-muted-foreground">
                CRN bypass habilitado. Use "Simular Validação" em qualquer dieta pendente para testar o fluxo completo de nutricionista.
              </p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="pt-6 flex items-center gap-3">
              <DollarSign className="h-7 w-7 text-primary flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold">R$ {(totalRevenue * 39.9).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Receita Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6 flex items-center gap-3">
              <Stethoscope className="h-7 w-7 text-primary flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold">{nutritionists.length}</p>
                <p className="text-xs text-muted-foreground">Nutricionistas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6 flex items-center gap-3">
              <Users className="h-7 w-7 text-primary flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold">{clients.length}</p>
                <p className="text-xs text-muted-foreground">Clientes Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="h-7 w-7 text-coin-gold flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold">{pendingRequests.length}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="queue">
          <TabsList className="flex-wrap">
            <TabsTrigger value="queue">Fila de Dietas</TabsTrigger>
            <TabsTrigger value="nutritionists">Nutricionistas</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="payments">Financeiro</TabsTrigger>
            <TabsTrigger value="invites" className="gap-1.5">
              <Share2 className="h-4 w-4" />
              Performance de Convites
            </TabsTrigger>
            <TabsTrigger value="tools">Ferramentas</TabsTrigger>
          </TabsList>

          {/* Diet Queue */}
          <TabsContent value="queue">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Fila de Solicitações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <p className="text-muted-foreground text-center py-8">Carregando...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead>Horas</TableHead>
                          <TableHead>Alerta</TableHead>
                          {devMode && <TableHead>Dev Action</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dietRequests.map((req) => {
                          const hours = getHoursPending(req.created_at);
                          const isUrgent = req.status === "pending" && hours >= 18;
                          return (
                            <TableRow key={req.id} className={isUrgent ? "bg-destructive/10" : ""}>
                              <TableCell className="font-mono text-xs">{req.id.slice(0, 8)}</TableCell>
                              <TableCell>
                                <Badge variant={req.status === "completed" ? "default" : req.status === "in_review" ? "secondary" : "outline"}>
                                  {req.status === "pending" ? "Pendente" : req.status === "in_review" ? "Em Revisão" : "Concluído"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{new Date(req.created_at).toLocaleString("pt-BR")}</TableCell>
                              <TableCell>
                                {req.status === "pending" ? (
                                  <span className={isUrgent ? "text-destructive font-bold" : ""}>
                                    {hours.toFixed(1)}h
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                {isUrgent && (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    SLA 24h
                                  </Badge>
                                )}
                              </TableCell>
                              {devMode && (
                                <TableCell>
                                  {req.status !== "completed" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                      onClick={() => { setSimRequest(req); setSimOpen(true); }}
                                    >
                                      <FlaskConical className="h-3 w-3" />
                                      Simular Validação
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                        {dietRequests.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={devMode ? 6 : 5} className="text-center text-muted-foreground py-8">
                              Nenhuma solicitação registrada
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nutritionists */}
          <TabsContent value="nutritionists">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Nutricionistas Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CRN</TableHead>
                        <TableHead>Moedas</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aprovar</TableHead>
                        <TableHead>Add Moedas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nutritionists.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell className="font-medium">{n.full_name || "—"}</TableCell>
                          <TableCell>{n.crn_number || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Coins className="h-3 w-3 text-coin-gold" />
                              {n.credits}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={n.approved ? "default" : "destructive"}>
                              {n.approved ? "Aprovado" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch checked={n.approved} onCheckedChange={() => toggleApproval(n)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                placeholder="Qtd"
                                className="w-16 h-8 text-xs"
                                value={creditAmount[n.id] || ""}
                                onChange={(e) => setCreditAmount({ ...creditAmount, [n.id]: e.target.value })}
                              />
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addCredits(n)}>
                                <Coins className="h-3 w-3 mr-1" /> Add
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {nutritionists.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhum nutricionista registrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients */}
          <TabsContent value="clients">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Clientes Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cadastro</TableHead>
                        <TableHead>Dietas Solicitadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.full_name || "—"}</TableCell>
                          <TableCell>{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>{dietRequests.filter((d) => d.client_id === c.user_id).length}</TableCell>
                        </TableRow>
                      ))}
                      {clients.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            Nenhum cliente registrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial / Payment Log */}
          <TabsContent value="payments">
            <div className="space-y-6">
              {/* Revenue Split Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="glass-card">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-display font-bold text-primary">
                      R$ {(dietRequests.filter((d) => d.status === "completed").length * 39.9).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Receita Bruta (R$ 39,90/plano)</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-display font-bold text-destructive">
                      R$ {(dietRequests.filter((d) => d.status === "completed").length * 15).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Pago a Nutricionistas (R$ 15/validação)</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-display font-bold emerald-gradient bg-clip-text text-transparent">
                      R$ {(dietRequests.filter((d) => d.status === "completed").length * 24.9).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Lucro Plataforma (R$ 24,90/plano)</p>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Log */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display">Log de Transações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Split Status</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono text-xs">{t.id.slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {t.type === "credit_purchase" ? "Compra" : t.type === "job_acceptance" ? "Aceite" : "Reembolso"}
                              </Badge>
                            </TableCell>
                            <TableCell className={t.amount >= 0 ? "text-primary" : "text-destructive"}>
                              {t.amount >= 0 ? "+" : ""}{t.amount}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <span className="text-primary">R$ 24,90 plat.</span>
                                <span className="text-muted-foreground"> / </span>
                                <span>R$ 15,00 nutri</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{t.description || "—"}</TableCell>
                            <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                        {transactions.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhuma transação
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance de Convites — rastreia cliques, cópias e vendas por
              código de afiliado (nutri + personal). Dados vêm da tabela
              invite_analytics (migration 20260423120000). */}
          <TabsContent value="invites">
            <div className="space-y-6">
              {/* Resumo */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="glass-card">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <Users className="h-7 w-7 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xl md:text-2xl font-display font-bold">
                        {invitePerf.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Profissionais com código</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <MousePointerClick className="h-7 w-7 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xl md:text-2xl font-display font-bold">
                        {invitePerf.reduce((acc, p) => acc + p.clicks, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Cliques únicos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <CopyIcon className="h-7 w-7 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xl md:text-2xl font-display font-bold">
                        {invitePerf.reduce((acc, p) => acc + p.copies, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Cópias de link/código</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <TrendingUp className="h-7 w-7 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xl md:text-2xl font-display font-bold text-primary">
                        R$ {invitePerf
                          .reduce((acc, p) => acc + p.revenue, 0)
                          .toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vendas geradas ({invitePerf.reduce((acc, p) => acc + p.sales, 0)})
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="font-display flex items-center gap-2">
                      <Share2 className="h-5 w-5 text-primary" />
                      Performance por Profissional
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Métricas agregadas por código de afiliado (nutri + personal).
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadInvitePerformance}
                    disabled={loadingInvitePerf}
                  >
                    {loadingInvitePerf ? "Atualizando..." : "Atualizar"}
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingInvitePerf ? (
                    <p className="text-muted-foreground text-center py-8">
                      Carregando métricas...
                    </p>
                  ) : invitePerf.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Ainda não há dados de convites registrados.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Profissional</TableHead>
                            <TableHead>Papel</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead className="text-right">Cliques</TableHead>
                            <TableHead className="text-right">Cópias</TableHead>
                            <TableHead className="text-right">Vendas</TableHead>
                            <TableHead className="text-right">Receita</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invitePerf.map((p) => (
                            <TableRow key={p.code}>
                              <TableCell className="font-medium">{p.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {p.role === "nutritionist"
                                    ? "Nutricionista"
                                    : p.role === "personal_trainer"
                                    ? "Personal"
                                    : p.role || "—"}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{p.code}</TableCell>
                              <TableCell className="text-right">{p.clicks}</TableCell>
                              <TableCell className="text-right">{p.copies}</TableCell>
                              <TableCell className="text-right font-semibold">
                                {p.sales}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-primary">
                                R$ {p.revenue.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tools */}
          <TabsContent value="tools">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <RetentionBotPreview />
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-display text-sm flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Análise de Biotipo (Lead Magnet)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Preview da feature de engajamento pré-compra</p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-primary/20 bg-accent/20 p-4 text-center">
                    <p className="text-sm font-medium mb-2">📊 Análise de Biotipo Gratuita</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Antes de pagar, o cliente recebe via e-mail uma análise de biotipo gerada por IA, provando a inteligência da plataforma.
                    </p>
                    <Badge variant="outline" className="text-xs">Futura implementação</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Simulation Sheet */}
      {simRequest && (
        <AdminSimulationView
          request={simRequest}
          open={simOpen}
          onOpenChange={setSimOpen}
          onComplete={fetchData}
        />
      )}
    </div>
  );
}
