import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Leaf, LogOut, ShieldCheck, Users, Stethoscope, DollarSign,
  AlertTriangle, Eye, FileText, Coins, Zap, FlaskConical,
  Search, Crown, CheckCircle2, Loader2, ShieldAlert, BadgeCheck, MinusCircle, PlusCircle, Star, MessageSquare,
  User, Dumbbell, BookOpen, Check, X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import AdminSimulationView from "@/components/AdminSimulationView";
import PremiumDietPlanView from "@/components/PremiumDietPlanView";
import PlansModal from "@/components/PlansModal";
import ClinicLogoUpload from "@/components/ClinicLogoUpload";
import LeadHunterCRM from "@/components/admin/LeadHunterCRM";
import { Radar } from "lucide-react";
import type { DietPlan } from "@/services/n8nService";

type Profile = any;
type Transaction = any;
type DietRequest = any;

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

export default function AdminSupremo() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dietRequests, setDietRequests] = useState<DietRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [pendingPosts, setPendingPosts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [devMode, setDevMode] = useState(true);
  const [creditAmount, setCreditAmount] = useState<Record<string, string>>({});
  const [creditAction, setCreditAction] = useState<Record<string, "add" | "remove">>({});

  // Search & filter
  const [userSearch, setUserSearch] = useState("");
  const [dietStatusFilter, setDietStatusFilter] = useState<string>("all");
  const [transactionSearch, setTransactionSearch] = useState("");

  // Simulation
  const [simRequest, setSimRequest] = useState<DietRequest | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [pdfRequest, setPdfRequest] = useState<DietRequest | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [viewPost, setViewPost] = useState<any | null>(null);
  const [plansModalOpen, setPlansModalOpen] = useState(false);

  // CRN Audit
  const [crnVerifying, setCrnVerifying] = useState<Record<string, boolean>>({});
  const [crnResults, setCrnResults] = useState<Record<string, "valid" | "alert" | null>>({});

  const isSupremeAdmin = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();

  useEffect(() => {
    if (!loading && !isSupremeAdmin) {
      navigate("/");
    }
  }, [loading, isSupremeAdmin, navigate]);

  useEffect(() => {
    if (isSupremeAdmin) fetchData();
  }, [isSupremeAdmin]);

  const fetchData = async () => {
    setLoadingData(true);
    const [profilesRes, transactionsRes, dietRes, feedbackRes, postsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("diet_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("client_feedback").select("*").order("created_at", { ascending: false }),
      supabase.from("blog_posts" as any).select("*").eq("status", "pending_review").order("created_at", { ascending: false }),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (dietRes.data) setDietRequests(dietRes.data);
    if (feedbackRes.data) setFeedbacks(feedbackRes.data);
    if (postsRes.data) setPendingPosts(postsRes.data as any[]);
    setLoadingData(false);
  };

  const approvePost = async (postId: string) => {
    const { error } = await supabase.from("blog_posts" as any).update({ status: "published" } as any).eq("id", postId);
    if (error) toast.error(error.message);
    else {
      toast.success("Artigo aprovado e publicado!");
      fetchData();
    }
  };

  const rejectPost = async (postId: string) => {
    if (!confirm("Recusar e excluir este artigo?")) return;
    const { error } = await supabase.from("blog_posts" as any).delete().eq("id", postId);
    if (error) toast.error(error.message);
    else {
      toast.success("Artigo recusado e removido.");
      fetchData();
    }
  };

  const toggleApproval = async (p: Profile) => {
    await supabase.from("profiles").update({ approved: !p.approved }).eq("id", p.id);
    toast.success(p.approved ? "Nutricionista suspenso" : "Nutricionista aprovado");
    fetchData();
  };

  const addCredits = async (p: Profile) => {
    const amount = parseInt(creditAmount[p.id] || "0");
    const action = creditAction[p.id] || "add";
    if (!amount || amount <= 0) { toast.error("Informe um valor válido"); return; }
    
    const newCredits = action === "add" ? p.credits + amount : Math.max(0, p.credits - amount);
    await supabase.from("profiles").update({ credits: newCredits }).eq("id", p.id);
    await supabase.from("transactions").insert({
      user_id: p.user_id, amount: action === "add" ? amount : -amount, type: "credit_purchase" as const,
      description: `Admin Supreme ${action === "add" ? "adicionou" : "removeu"} ${amount} moedas`,
    });
    toast.success(`${amount} moedas ${action === "add" ? "adicionadas" : "removidas"} para ${p.full_name}`);
    setCreditAmount({ ...creditAmount, [p.id]: "" });
    fetchData();
  };

  const handleCrnVerify = (profileId: string) => {
    setCrnVerifying(prev => ({ ...prev, [profileId]: true }));
    setCrnResults(prev => ({ ...prev, [profileId]: null }));
    setTimeout(() => {
      const isValid = Math.random() > 0.2;
      setCrnResults(prev => ({ ...prev, [profileId]: isValid ? "valid" : "alert" }));
      setCrnVerifying(prev => ({ ...prev, [profileId]: false }));
    }, 2000);
  };

  const markDietCompleted = async (req: DietRequest) => {
    await supabase.from("diet_requests").update({
      status: "completed", notes: "Validado manualmente pelo Admin Supremo"
    }).eq("id", req.id);
    toast.success("Dieta marcada como validada!");
    fetchData();
  };

  const getHoursPending = (createdAt: string) =>
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);

  // Filtered data
  const allUsers = useMemo(() =>
    profiles.filter(p =>
      !userSearch || p.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      (p.crn_number && p.crn_number.toLowerCase().includes(userSearch.toLowerCase()))
    ), [profiles, userSearch]);

  const filteredDiets = useMemo(() =>
    dietRequests.filter(d => dietStatusFilter === "all" || d.status === dietStatusFilter),
    [dietRequests, dietStatusFilter]);

  const filteredTransactions = useMemo(() =>
    transactions.filter(t =>
      !transactionSearch || (t.description && t.description.toLowerCase().includes(transactionSearch.toLowerCase())) ||
      t.id.includes(transactionSearch)
    ), [transactions, transactionSearch]);

  const nutritionists = allUsers.filter(p => p.role === "nutritionist");
  const clients = allUsers.filter(p => p.role === "client");
  const completedCount = dietRequests.filter(d => d.status === "completed").length;
  const pendingCount = dietRequests.filter(d => d.status === "pending").length;

  if (loading || !isSupremeAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(160,20%,5%)]">
        <Crown className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(160,20%,5%)] text-[hsl(150,10%,90%)]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[hsl(160,15%,15%)] bg-[hsl(160,20%,7%)]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <Crown className="h-5 w-5 text-primary" />
          <span className="font-display font-bold text-[hsl(150,10%,95%)]">Nutr<span className="text-primary">IA</span>prova</span>
          <Badge className="ml-2 text-xs bg-primary/20 text-primary border-primary/40">
            ADMIN SUPREMO
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[hsl(150,10%,55%)] hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-[hsl(150,10%,55%)] hover:text-[hsl(150,10%,90%)]">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Title + God Mode */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2 text-[hsl(150,10%,95%)]">
            <ShieldCheck className="h-6 md:h-7 w-6 md:w-7 text-primary" />
            Painel Admin Supremo
          </h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">God Mode</span>
            <Switch checked={devMode} onCheckedChange={setDevMode} />
          </div>
        </div>

        {devMode && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 mb-6 flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-display font-bold text-sm text-[hsl(150,10%,95%)]">🧪 God Mode Ativo — CRN Bypass + Controle Total</p>
              <p className="text-xs text-[hsl(150,10%,55%)]">
                Simule validações, adicione moedas, marque dietas como concluídas e teste todo o fluxo sem restrições.
              </p>
            </div>
          </div>
        )}

        {/* View-As Buttons */}
        {devMode && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Button
              variant="outline"
              className="gap-2 border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)] hover:bg-primary/10 hover:border-primary/40 h-12"
              onClick={() => navigate("/?as=client")}
            >
              <User className="h-4 w-4 text-primary" />
              Ver Visão do Cliente
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)] hover:bg-primary/10 hover:border-primary/40 h-12"
              onClick={() => navigate("/?as=nutritionist")}
            >
              <Stethoscope className="h-4 w-4 text-primary" />
              Ver Visão do Nutricionista
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)] hover:bg-primary/10 hover:border-primary/40 h-12"
              onClick={() => navigate("/personal-dashboard")}
            >
              <Dumbbell className="h-4 w-4 text-primary" />
              Ver Visão do Personal
            </Button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
            <CardContent className="pt-6 flex items-center gap-3">
              <DollarSign className="h-7 w-7 text-primary flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold text-[hsl(150,10%,95%)]">R$ {(completedCount * 39.9).toFixed(2)}</p>
                <p className="text-xs text-[hsl(150,10%,55%)]">Receita Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
            <CardContent className="pt-6 flex items-center gap-3">
              <Stethoscope className="h-7 w-7 text-primary flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold text-[hsl(150,10%,95%)]">{nutritionists.length}</p>
                <p className="text-xs text-[hsl(150,10%,55%)]">Nutricionistas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
            <CardContent className="pt-6 flex items-center gap-3">
              <Users className="h-7 w-7 text-primary flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold text-[hsl(150,10%,95%)]">{clients.length}</p>
                <p className="text-xs text-[hsl(150,10%,55%)]">Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="h-7 w-7 text-[hsl(var(--coin-gold))] flex-shrink-0" />
              <div>
                <p className="text-xl md:text-2xl font-display font-bold text-[hsl(150,10%,95%)]">{pendingCount}</p>
                <p className="text-xs text-[hsl(150,10%,55%)]">Pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="audit" className="space-y-4">
          <TabsList className="bg-[hsl(160,20%,10%)] border border-[hsl(160,15%,15%)] flex-wrap">
            <TabsTrigger value="audit" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Users className="h-4 w-4 mr-1" /> Auditoria
            </TabsTrigger>
            <TabsTrigger value="queue" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <FileText className="h-4 w-4 mr-1" /> Fila de Dietas
            </TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <DollarSign className="h-4 w-4 mr-1" /> Financeiro
            </TabsTrigger>
            <TabsTrigger value="crn-audit" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <ShieldAlert className="h-4 w-4 mr-1" /> Auditoria CRN
            </TabsTrigger>
            <TabsTrigger value="feedback" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Star className="h-4 w-4 mr-1" /> Controle de Qualidade
            </TabsTrigger>
            <TabsTrigger value="blog-triage" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <BookOpen className="h-4 w-4 mr-1" /> Moderação de Conteúdo
              {pendingPosts.length > 0 && (
                <Badge className="ml-1.5 bg-[hsl(45,93%,47%)] text-black text-[10px] px-1.5 py-0 h-4">
                  {pendingPosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="plans" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Crown className="h-4 w-4 mr-1" /> Planos & Clínica
            </TabsTrigger>
            <TabsTrigger value="crm" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <Radar className="h-4 w-4 mr-1" /> Radar de Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crm">
            <LeadHunterCRM />
          </TabsContent>

          {/* User Audit */}
          <TabsContent value="audit">
            <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="font-display text-[hsl(150,10%,95%)]">Auditoria de Usuários</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(150,10%,55%)]" />
                    <Input
                      placeholder="Buscar por nome ou CRN..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)] placeholder:text-[hsl(150,10%,40%)]"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[hsl(160,15%,15%)] hover:bg-transparent">
                        <TableHead className="text-[hsl(150,10%,55%)]">Nome</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Papel</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">CRN</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Moedas</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Status</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Dietas</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers.map((p) => {
                        const userDiets = dietRequests.filter(d =>
                          p.role === "nutritionist" ? d.nutritionist_id === p.user_id : d.client_id === p.user_id
                        );
                        return (
                          <TableRow key={p.id} className="border-[hsl(160,15%,15%)] hover:bg-[hsl(160,20%,10%)]">
                            <TableCell className="font-medium text-[hsl(150,10%,90%)]">{p.full_name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                p.role === "admin" ? "border-primary text-primary" :
                                p.role === "nutritionist" ? "border-[hsl(217,91%,60%)] text-[hsl(217,91%,60%)]" :
                                "border-[hsl(150,10%,55%)] text-[hsl(150,10%,55%)]"
                              }>
                                {p.role === "admin" ? "Admin" : p.role === "nutritionist" ? "Nutricionista" : "Cliente"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[hsl(150,10%,55%)]">{p.crn_number || "—"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-[hsl(150,10%,90%)]">
                                <Coins className="h-3 w-3 text-[hsl(45,93%,47%)]" />
                                {p.credits}
                              </div>
                            </TableCell>
                            <TableCell>
                              {p.role === "nutritionist" && (
                                <div className="flex items-center gap-2">
                                  <Badge variant={p.approved ? "default" : "destructive"} className="text-xs">
                                    {p.approved ? "Aprovado" : "Pendente"}
                                  </Badge>
                                  <Switch checked={p.approved} onCheckedChange={() => toggleApproval(p)} />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-[hsl(150,10%,55%)]">{userDiets.length}</TableCell>
                            <TableCell>
                            {(p.role === "nutritionist" || p.role === "admin") && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={`h-7 w-7 ${(creditAction[p.id] || "add") === "add" ? "text-primary" : "text-muted-foreground"}`}
                                    onClick={() => setCreditAction({ ...creditAction, [p.id]: "add" })}
                                  >
                                    <PlusCircle className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={`h-7 w-7 ${creditAction[p.id] === "remove" ? "text-destructive" : "text-muted-foreground"}`}
                                    onClick={() => setCreditAction({ ...creditAction, [p.id]: "remove" })}
                                  >
                                    <MinusCircle className="h-3.5 w-3.5" />
                                  </Button>
                                  <Input
                                    type="number"
                                    placeholder="Qtd"
                                    className="w-16 h-8 text-xs bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)]"
                                    value={creditAmount[p.id] || ""}
                                    onChange={(e) => setCreditAmount({ ...creditAmount, [p.id]: e.target.value })}
                                  />
                                  <Button size="sm" variant="outline" className="h-8 text-xs border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)] hover:bg-[hsl(160,20%,12%)]" onClick={() => addCredits(p)}>
                                    <Coins className="h-3 w-3 mr-1" /> {(creditAction[p.id] || "add") === "add" ? "Add" : "Rem"}
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {allUsers.length === 0 && (
                        <TableRow className="border-[hsl(160,15%,15%)]">
                          <TableCell colSpan={7} className="text-center text-[hsl(150,10%,55%)] py-8">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Diet Queue */}
          <TabsContent value="queue">
            <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="font-display text-[hsl(150,10%,95%)]">Fila de Solicitações</CardTitle>
                  <Select value={dietStatusFilter} onValueChange={setDietStatusFilter}>
                    <SelectTrigger className="w-48 bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)]">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="in_review">Em Revisão</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[hsl(160,15%,15%)] hover:bg-transparent">
                        <TableHead className="text-[hsl(150,10%,55%)]">ID</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Status</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Criado</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Horas</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Alerta</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDiets.map((req) => {
                        const hours = getHoursPending(req.created_at);
                        const isUrgent = req.status === "pending" && hours >= 18;
                        return (
                          <TableRow key={req.id} className={`border-[hsl(160,15%,15%)] hover:bg-[hsl(160,20%,10%)] ${isUrgent ? "bg-destructive/10" : ""}`}>
                            <TableCell className="font-mono text-xs text-[hsl(150,10%,55%)]">{req.id.slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant={req.status === "completed" ? "default" : req.status === "in_review" ? "secondary" : "outline"}
                                className={req.status === "pending" ? "border-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)]" : ""}>
                                {req.status === "pending" ? "Pendente" : req.status === "in_review" ? "Em Revisão" : "Concluído"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-[hsl(150,10%,55%)]">{new Date(req.created_at).toLocaleString("pt-BR")}</TableCell>
                            <TableCell>
                              {req.status === "pending" ? (
                                <span className={`text-[hsl(150,10%,90%)] ${isUrgent ? "text-destructive font-bold" : ""}`}>{hours.toFixed(1)}h</span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {isUrgent && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />SLA 24h</Badge>}
                            </TableCell>
                             <TableCell>
                              <div className="flex items-center gap-2">
                                {req.ai_draft && (
                                  <Button size="sm" variant="outline"
                                    className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                    onClick={() => { setPdfRequest(req); setPdfOpen(true); }}>
                                    <FileText className="h-3 w-3" /> Ver PDF
                                  </Button>
                                )}
                                {devMode && req.status !== "completed" && (
                                  <>
                                    <Button size="sm" variant="outline"
                                      className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                      onClick={() => { setSimRequest(req); setSimOpen(true); }}>
                                      <Eye className="h-3 w-3" /> Testar Fluxo
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                                      onClick={() => markDietCompleted(req)}>
                                      <CheckCircle2 className="h-3 w-3" /> Validar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredDiets.length === 0 && (
                        <TableRow className="border-[hsl(160,15%,15%)]">
                          <TableCell colSpan={6} className="text-center text-[hsl(150,10%,55%)] py-8">
                            Nenhuma solicitação encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financial */}
          <TabsContent value="financial">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-display font-bold text-primary">R$ {(completedCount * 39.9).toFixed(2)}</p>
                    <p className="text-xs text-[hsl(150,10%,55%)]">Receita Bruta (R$ 39,90/plano)</p>
                  </CardContent>
                </Card>
                <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-display font-bold text-destructive">R$ {(completedCount * 15).toFixed(2)}</p>
                    <p className="text-xs text-[hsl(150,10%,55%)]">Pendente p/ Nutricionistas (R$ 15/validação)</p>
                  </CardContent>
                </Card>
                <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
                  <CardContent className="pt-6 text-center">
                    <p className="text-2xl font-display font-bold text-primary">R$ {(completedCount * 24.9).toFixed(2)}</p>
                    <p className="text-xs text-[hsl(150,10%,55%)]">Lucro Plataforma (R$ 24,90/plano)</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <CardTitle className="font-display text-[hsl(150,10%,95%)]">Log de Transações</CardTitle>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(150,10%,55%)]" />
                      <Input
                        placeholder="Buscar transações..."
                        value={transactionSearch}
                        onChange={(e) => setTransactionSearch(e.target.value)}
                        className="pl-9 bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)] placeholder:text-[hsl(150,10%,40%)]"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[hsl(160,15%,15%)] hover:bg-transparent">
                          <TableHead className="text-[hsl(150,10%,55%)]">ID</TableHead>
                          <TableHead className="text-[hsl(150,10%,55%)]">Tipo</TableHead>
                          <TableHead className="text-[hsl(150,10%,55%)]">Valor</TableHead>
                          <TableHead className="text-[hsl(150,10%,55%)]">Split</TableHead>
                          <TableHead className="text-[hsl(150,10%,55%)]">Descrição</TableHead>
                          <TableHead className="text-[hsl(150,10%,55%)]">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((t) => (
                          <TableRow key={t.id} className="border-[hsl(160,15%,15%)] hover:bg-[hsl(160,20%,10%)]">
                            <TableCell className="font-mono text-xs text-[hsl(150,10%,55%)]">{t.id.slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)]">
                                {t.type === "credit_purchase" ? "Compra" : t.type === "job_acceptance" ? "Aceite" : "Reembolso"}
                              </Badge>
                            </TableCell>
                            <TableCell className={t.amount >= 0 ? "text-primary" : "text-destructive"}>
                              {t.amount >= 0 ? "+" : ""}{t.amount}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <span className="text-primary">R$ 24,90</span>
                                <span className="text-[hsl(150,10%,55%)]"> / </span>
                                <span className="text-[hsl(150,10%,90%)]">R$ 15,00</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-[hsl(150,10%,55%)]">{t.description || "—"}</TableCell>
                            <TableCell className="text-xs text-[hsl(150,10%,55%)]">{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                        {filteredTransactions.length === 0 && (
                          <TableRow className="border-[hsl(160,15%,15%)]">
                            <TableCell colSpan={6} className="text-center text-[hsl(150,10%,55%)] py-8">
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

          {/* CRN Audit */}
          <TabsContent value="crn-audit">
            <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-[hsl(150,10%,95%)] flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Auditoria de CRN — Verificação com IA
                </CardTitle>
                <p className="text-xs text-[hsl(150,10%,55%)]">
                  Simule a consulta automatizada à base nacional de registros profissionais.
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[hsl(160,15%,15%)] hover:bg-transparent">
                        <TableHead className="text-[hsl(150,10%,55%)]">Nome</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">CRN</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Status Aprovação</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Resultado IA</TableHead>
                        <TableHead className="text-[hsl(150,10%,55%)]">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nutritionists.map((p) => (
                        <TableRow key={p.id} className="border-[hsl(160,15%,15%)] hover:bg-[hsl(160,20%,10%)]">
                          <TableCell className="font-medium text-[hsl(150,10%,90%)]">{p.full_name || "—"}</TableCell>
                          <TableCell className="font-mono text-sm text-[hsl(150,10%,90%)]">{p.crn_number || "Não informado"}</TableCell>
                          <TableCell>
                            <Badge variant={p.approved ? "default" : "destructive"} className="text-xs">
                              {p.approved ? "Aprovado" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {crnVerifying[p.id] ? (
                              <div className="flex items-center gap-2 text-xs text-[hsl(150,10%,55%)]">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Consultando base nacional...
                              </div>
                            ) : crnResults[p.id] === "valid" ? (
                              <Badge className="gap-1 bg-primary/20 text-primary border-primary/30">
                                <BadgeCheck className="h-3 w-3" /> Validado: Nome confere com CRN
                              </Badge>
                            ) : crnResults[p.id] === "alert" ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> Alerta: Divergência de Dados
                              </Badge>
                            ) : (
                              <span className="text-xs text-[hsl(150,10%,40%)]">Não verificado</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs"
                              onClick={() => handleCrnVerify(p.id)}
                              disabled={crnVerifying[p.id] || !p.crn_number}
                            >
                              {crnVerifying[p.id] ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ShieldAlert className="h-3 w-3" />
                              )}
                              Verificar com IA
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {nutritionists.length === 0 && (
                        <TableRow className="border-[hsl(160,15%,15%)]">
                          <TableCell colSpan={5} className="text-center text-[hsl(150,10%,55%)] py-8">
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
          {/* Feedback */}
          <TabsContent value="feedback">
            <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-[hsl(150,10%,95%)] flex items-center gap-2">
                  <Star className="h-5 w-5 text-[hsl(45,93%,47%)]" />
                  Controle de Qualidade — Avaliações dos Clientes
                </CardTitle>
                <p className="text-xs text-[hsl(150,10%,55%)]">
                  Monitore as notas (1 a 5 estrelas) e comentários para garantir a qualidade do atendimento dos nutricionistas.
                </p>
              </CardHeader>
              <CardContent>
                {feedbacks.length === 0 ? (
                  <div className="text-center py-12 text-[hsl(150,10%,55%)]">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm">Nenhum feedback recebido ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbacks.map((fb) => {
                      const clientProfile = profiles.find(p => p.user_id === fb.client_id);
                      const isNegative = fb.rating <= 2;
                      return (
                        <div
                          key={fb.id}
                          className={`rounded-lg border p-4 ${
                            isNegative
                              ? "border-destructive/50 bg-destructive/10"
                              : "border-[hsl(160,15%,15%)] bg-[hsl(160,20%,6%)]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm ${isNegative ? "text-destructive" : "text-[hsl(150,10%,90%)]"}`}>
                                {clientProfile?.full_name || "Cliente anônimo"}
                              </span>
                              <span className="text-xs text-[hsl(150,10%,40%)]">
                                #{fb.diet_request_id?.slice(0, 8)}
                              </span>
                              {isNegative && (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Negativo
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`h-4 w-4 ${star <= fb.rating ? "text-[hsl(45,93%,47%)] fill-[hsl(45,93%,47%)]" : "text-[hsl(160,15%,20%)]"}`}
                                  />
                                ))}
                              </div>
                              {isNegative && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                                  onClick={() => toast.info(`Iniciando contato com ${clientProfile?.full_name || "cliente"}...`)}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Entrar em Contato
                                </Button>
                              )}
                            </div>
                          </div>
                          {fb.comment && (
                            <p className={`text-sm italic ${isNegative ? "text-destructive/80" : "text-[hsl(150,10%,55%)]"}`}>
                              "{fb.comment}"
                            </p>
                          )}
                          <p className="text-xs text-[hsl(150,10%,40%)] mt-2">
                            {new Date(fb.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blog Triage */}
          <TabsContent value="blog-triage">
            <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-[hsl(150,10%,95%)] flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Revisão de Artigos
                  <Badge variant="outline" className="border-primary/40 text-primary ml-2">
                    {pendingPosts.length} pendente{pendingPosts.length === 1 ? "" : "s"}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-[hsl(150,10%,55%)] mt-1">
                  Artigos enviados por Nutricionistas e Personal Trainers aguardando aprovação para publicação no blog público.
                </p>
              </CardHeader>
              <CardContent>
                {pendingPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-10 w-10 text-primary/40 mx-auto mb-3" />
                    <p className="text-[hsl(150,10%,55%)]">Nenhum artigo aguardando revisão.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingPosts.map((post) => {
                      const author = profiles.find((p) => p.user_id === post.author_id);
                      return (
                        <div
                          key={post.id}
                          className="rounded-lg border border-[hsl(160,15%,15%)] bg-[hsl(160,20%,6%)] p-4"
                        >
                          <div className="flex flex-col md:flex-row gap-4">
                            {post.cover_image_url && (
                              <img
                                src={post.cover_image_url}
                                alt={post.title}
                                className="w-full md:w-32 h-24 object-cover rounded-md border border-[hsl(160,15%,15%)] flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge variant="outline" className="text-xs border-[hsl(160,15%,18%)] text-[hsl(150,10%,55%)]">
                                  {post.category}
                                </Badge>
                                <Badge variant="outline" className="text-xs border-[hsl(45,93%,47%)] text-[hsl(45,93%,47%)]">
                                  ⏳ Pendente
                                </Badge>
                                <span className="text-xs text-[hsl(150,10%,40%)]">
                                  {author?.full_name || "Autor desconhecido"}
                                  {author?.role && ` • ${author.role === "nutritionist" ? "Nutricionista" : author.role === "personal_trainer" ? "Personal" : author.role}`}
                                </span>
                                <span className="text-xs text-[hsl(150,10%,40%)]">
                                  {new Date(post.created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                              <h3 className="font-display font-bold text-[hsl(150,10%,95%)] mb-1">
                                {post.title}
                              </h3>
                              <p className="text-sm text-[hsl(150,10%,55%)] line-clamp-2">
                                {post.excerpt || post.content.slice(0, 200)}
                              </p>
                              <div className="flex items-center gap-2 mt-3 flex-wrap">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 border-primary/40 text-primary hover:bg-primary/10"
                                  onClick={() => setViewPost(post)}
                                >
                                  <Eye className="h-3.5 w-3.5" /> Ler Artigo Completo
                                </Button>
                                <Button
                                  size="sm"
                                  className="emerald-gradient text-primary-foreground gap-1"
                                  onClick={() => approvePost(post.id)}
                                >
                                  <Check className="h-3.5 w-3.5" /> Aprovar e Publicar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                                  onClick={() => rejectPost(post.id)}
                                >
                                  <X className="h-3.5 w-3.5" /> Recusar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans & Clinic Logo Tab — Admin can preview tier features */}
          <TabsContent value="plans">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
                <CardHeader>
                  <CardTitle className="font-display text-[hsl(150,10%,95%)] flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Visualizar Planos da Plataforma
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-[hsl(150,10%,55%)]">
                    Abra o modal de Planos exatamente como nutricionistas e personals veem.
                  </p>
                  <Button
                    onClick={() => setPlansModalOpen(true)}
                    className="emerald-gradient text-primary-foreground gap-2"
                  >
                    <Crown className="h-4 w-4" /> Abrir Modal de Planos
                  </Button>
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[hsl(160,15%,15%)]">
                    <div className="text-center">
                      <p className="text-xs text-[hsl(150,10%,55%)]">Basic</p>
                      <p className="font-display font-bold text-[hsl(150,10%,95%)]">{profiles.filter(p => ((p as any).plan_tier || "basic") === "basic").length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[hsl(150,10%,55%)]">Premium</p>
                      <p className="font-display font-bold text-primary">{profiles.filter(p => (p as any).plan_tier === "premium").length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-[hsl(150,10%,55%)]">Clínica</p>
                      <p className="font-display font-bold text-[hsl(var(--coin-gold))]">{profiles.filter(p => (p as any).plan_tier === "clinic").length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="[&>div]:bg-[hsl(160,20%,8%)] [&>div]:border-[hsl(160,15%,15%)] [&_*]:!text-[hsl(150,10%,90%)] [&_p.text-muted-foreground]:!text-[hsl(150,10%,55%)]">
                <ClinicLogoUpload />
              </div>
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

      {/* PDF Full-Screen Modal */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Visualização do Plano — #{pdfRequest?.id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          {pdfRequest?.ai_draft && (
            <PremiumDietPlanView
              plan={pdfRequest.ai_draft as unknown as DietPlan}
              nutritionistName="Admin Supremo"
              crnNumber="Bypass"
              isCompleted={pdfRequest.status === "completed"}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Article Full-Read Modal */}
      <Dialog open={!!viewPost} onOpenChange={(o) => !o && setViewPost(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {viewPost?.title}
            </DialogTitle>
          </DialogHeader>
          {viewPost && (
            <div className="space-y-4">
              {viewPost.cover_image_url && (
                <img src={viewPost.cover_image_url} alt={viewPost.title} className="w-full max-h-72 object-cover rounded-lg border" />
              )}
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <Badge variant="outline">{viewPost.category}</Badge>
                <span>{new Date(viewPost.created_at).toLocaleDateString("pt-BR")}</span>
                <span>•</span>
                <span>{profiles.find((p) => p.user_id === viewPost.author_id)?.full_name || "Autor"}</span>
              </div>
              {viewPost.excerpt && (
                <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">{viewPost.excerpt}</p>
              )}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
                {viewPost.content}
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button className="emerald-gradient text-primary-foreground gap-1 flex-1" onClick={() => { approvePost(viewPost.id); setViewPost(null); }}>
                  <Check className="h-4 w-4" /> Aprovar e Publicar
                </Button>
                <Button variant="outline" className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 flex-1" onClick={() => { rejectPost(viewPost.id); setViewPost(null); }}>
                  <X className="h-4 w-4" /> Recusar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PlansModal open={plansModalOpen} onOpenChange={setPlansModalOpen} currentTier="clinic" />
    </div>
  );
}
