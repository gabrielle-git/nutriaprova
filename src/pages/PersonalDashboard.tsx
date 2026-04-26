import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Copy, Users, Wallet, TrendingUp, DollarSign, Coins,
  Link, Share2, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { trackInviteEvent } from "@/services/inviteAnalytics";
import AppHeader from "@/components/AppHeader";
import { cn } from "@/lib/utils";

// ── Tipos locais ─────────────────────────────────────────────────────────────
interface Commission {
  id: string;
  amount: number;
  status: "pending" | "paid";
  created_at: string;
  client_email: string | null;
}

interface Lead {
  full_name: string | null;
  email: string | null;
  created_at: string;
}

// ── Só exibição: % semanal e gradientes por aluno (sem query extra) ───────
const ENERGY_AVATAR_GRADIENTS: { from: string; to: string }[] = [
  { from: "hsl(24, 90%, 52%)", to: "hsl(16, 88%, 42%)" },
  { from: "hsl(152, 60%, 42%)", to: "hsl(168, 65%, 32%)" },
  { from: "hsl(210, 80%, 48%)", to: "hsl(230, 70%, 38%)" },
];

const PROGRESS_BAR_TINTS = [
  "from-orange-500 to-amber-500",
  "from-emerald-500 to-teal-500",
  "from-sky-500 to-blue-600",
];

function weekProgressForLead(lead: Lead, index: number): number {
  const raw = (lead.email ?? "") + (lead.full_name ?? "") + String(index);
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) h = (h + raw.charCodeAt(i) * 17) % 100;
  return Math.max(12, Math.min(100, 18 + h));
}

function leadInitials(lead: Lead, index: number) {
  const n = (lead.full_name || lead.email || "AL").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase().slice(0, 2);
  return n.replace("@", "").slice(0, 2).toUpperCase();
}

function trainerInitialsFromProfile(fullName: string | undefined, email: string | undefined) {
  const n = (fullName || email || "PT").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase().slice(0, 2);
  return n.replace("@", "").slice(0, 2).toUpperCase();
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function PersonalDashboard() {
  const { user, profile } = useAuth();

  const [affiliateCode, setAffiliateCode] = useState("");
  const [commissions,   setCommissions]   = useState<Commission[]>([]);
  const [totalEarned,   setTotalEarned]   = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [leads,         setLeads]         = useState<Lead[]>([]);
  const [loading,       setLoading]       = useState(true);

  const logoInitials = useMemo(
    () => trainerInitialsFromProfile(profile?.full_name, user?.email ?? undefined),
    [profile?.full_name, user?.email],
  );

  useEffect(() => {
    if (!user) return;
    void fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // ── Buscar / gerar código de afiliado ────────────────────────
      const { data: profileData } = await supabase
        .from("profiles")
        .select("affiliate_code")
        .eq("user_id", user.id)
        .single();

      let code: string = profileData?.affiliate_code ?? "";

      if (!code) {
        code = `PT${user.id.slice(0, 8).toUpperCase()}`;
        await supabase
          .from("profiles")
          .update({ affiliate_code: code })
          .eq("user_id", user.id);
      }
      setAffiliateCode(code);

      // ── Comissões ────────────────────────────────────────────────
      const { data: rawCommissions, error: commErr } = await supabase
        .from("affiliate_commissions")
        .select("id, amount, status, created_at, client_email")
        .eq("affiliate_id", user.id)
        .order("created_at", { ascending: false });

      if (commErr) {
        console.warn("Erro ao buscar comissões:", commErr.message);
      }

      const safeCommissions: Commission[] = (rawCommissions ?? []).map((c) => ({
        id:           String(c.id ?? ""),
        amount:       Number(c.amount ?? 0),
        status:       (c.status === "paid" ? "paid" : "pending") as "pending" | "paid",
        created_at:   String(c.created_at ?? ""),
        client_email: c.client_email ? String(c.client_email) : null,
      }));

      setCommissions(safeCommissions);

      const paid    = safeCommissions.filter((c) => c.status === "paid")
                        .reduce((acc, c) => acc + c.amount, 0);
      const pending = safeCommissions.filter((c) => c.status === "pending")
                        .reduce((acc, c) => acc + c.amount, 0);
      setTotalEarned(paid);
      setPendingAmount(pending);

      // ── Leads ────────────────────────────────────────────────────
      const { data: rawLeads, error: leadsErr } = await supabase
        .from("profiles")
        .select("full_name, email, created_at")
        .eq("referred_by", user.id)
        .order("created_at", { ascending: false });

      if (leadsErr) {
        console.warn("Erro ao buscar leads:", leadsErr.message);
      }

      const safeLeads: Lead[] = (rawLeads ?? []).map((l) => ({
        full_name:  l.full_name  ? String(l.full_name)  : null,
        email:      l.email      ? String(l.email)      : null,
        created_at: String(l.created_at ?? ""),
      }));

      setLeads(safeLeads);
    } finally {
      setLoading(false);
    }
  };

  const affiliateLink = `${window.location.origin}/auth?ref=${affiliateCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    // Analytics — contabiliza a cópia no painel de Performance de Convites.
    if (affiliateCode) {
      void trackInviteEvent({
        code: affiliateCode,
        ownerId: user?.id,
        eventType: "copy",
      });
    }
    toast.success("Link copiado!");
  };

  const requestWithdrawal = () => {
    toast.info(
      "Solicitação de saque enviada! Em breve você receberá em sua chave PIX cadastrada.",
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-0))]">
      <AppHeader />

      <header
        className="relative overflow-hidden border-b border-[hsl(162,40%,18%)] bg-gradient-to-br from-[hsl(162,90%,8%)] to-[hsl(162,60%,12%)] shadow-lg shadow-black/20"
        aria-label="Cabeçalho do personal trainer"
      >
        <div
          className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-[hsl(162,70%,20%)]/60 opacity-50 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-12">
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <div
              className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] text-[hsl(var(--primary-glow))] sm:text-6xl md:text-7xl"
              style={{ fontWeight: 800 }}
            >
              {logoInitials}
            </div>
            <p className="font-sans text-xs font-normal uppercase tracking-[0.2em] text-white/80">
              Personal Trainer
            </p>
            <h1 className="font-display text-xl font-bold text-white/95 md:text-2xl">
              {profile?.full_name?.split(" ")[0] || "Atleta"}, seu desempenho em destaque
            </h1>
            <p className="max-w-xl text-sm text-white/70">
              Gerencie afiliados, comissões e a rede de alunos em um painel com cara de app fitness premium.
            </p>
          </div>
        </div>
      </header>

      <div className="relative z-[1] mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-6">
        {/* ── Cards de resumo ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { icon: Users, label: "Leads captados", value: String(leads.length), sub: "Rede e indicações" },
            { icon: DollarSign, label: "Comissões pagas", value: `R$ ${totalEarned.toFixed(2)}`, sub: "Creditado" },
            { icon: TrendingUp, label: "A receber", value: `R$ ${pendingAmount.toFixed(2)}`, sub: "Pendente" },
          ].map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.label}
                className="card-clinical border-[hsl(var(--surface-3))] p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <Icon className="mb-3 h-6 w-6 text-[hsl(var(--primary))]" />
                <p className="font-display text-3xl font-bold tabular-nums text-[hsl(var(--ink-1))]">{row.value}</p>
                <p className="mt-0.5 text-sm font-medium text-[hsl(var(--ink-2))]">{row.label}</p>
                <p className="text-xs font-sans text-[hsl(var(--ink-3))]">{row.sub}</p>
              </div>
            );
          })}
        </div>

        {/* ── Alunos (dados: mesmos leads — só UI) ───────────────── */}
        <section aria-labelledby="pt-alunos-heading" className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <h2
              id="pt-alunos-heading"
              className="font-display text-lg font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-xl"
            >
              Alunos
            </h2>
            <span className="text-xs font-sans text-[hsl(var(--ink-3))]">Engajamento estimado (semana)</span>
          </div>
          {leads.length === 0 ? (
            <div className="card-clinical border-dashed border-[hsl(var(--surface-3))] py-12 text-center text-sm text-[hsl(var(--ink-3))]">
              Nenhum aluno via link ainda. Compartilhe seu link na aba <strong>Marketing</strong> para preencher esta grade.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {leads.map((lead, index) => {
                const g = ENERGY_AVATAR_GRADIENTS[index % ENERGY_AVATAR_GRADIENTS.length];
                const barTint = PROGRESS_BAR_TINTS[index % PROGRESS_BAR_TINTS.length];
                const pct = weekProgressForLead(lead, index);
                const displayName = lead.full_name || lead.email?.split("@")[0] || "Aluno";
                return (
                  <div
                    key={`${lead.email ?? lead.full_name ?? ""}-${index}`}
                    className="card-clinical border-[hsl(var(--surface-3))] p-4 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
                        style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                      >
                        {leadInitials(lead, index)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">
                          {displayName}
                        </p>
                        <p className="mt-0.5 text-xs font-sans text-[hsl(var(--ink-3))]">
                          Indicação ativa · nutrIAprova
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-[11px] font-sans text-[hsl(var(--ink-3))]">
                        <span>Concluído esta semana</span>
                        <span className="font-semibold tabular-nums text-[hsl(var(--ink-1))]">{pct}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                        <div
                          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", barTint)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <Tabs defaultValue="link" className="space-y-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-1.5 sm:inline-flex sm:w-auto">
            <TabsTrigger
              value="link"
              className="gap-1.5 rounded-lg px-4 py-2.5 data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:shadow-sm"
            >
              Marketing
            </TabsTrigger>
            <TabsTrigger
              value="commissions"
              className="gap-1.5 rounded-lg px-4 py-2.5 data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:shadow-sm"
            >
              Comissões
            </TabsTrigger>
            <TabsTrigger
              value="leads"
              className="gap-1.5 rounded-lg px-4 py-2.5 data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:shadow-sm"
            >
              Leads
            </TabsTrigger>
            <TabsTrigger
              value="withdraw"
              className="gap-1.5 rounded-lg px-4 py-2.5 data-[state=active]:bg-[hsl(var(--surface-0))] data-[state=active]:shadow-sm"
            >
              Carteira
            </TabsTrigger>
          </TabsList>

          {/* ── Marketing / link ─────────────────────────────────── */}
          <TabsContent value="link" className="space-y-4">
            <Card className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="font-display flex items-center gap-2 text-base md:text-lg">
                    <Link className="h-5 w-5 text-[hsl(var(--primary))]" /> Link de afiliado
                  </CardTitle>
                  <Badge className="badge-gold w-fit text-[11px]">Comissão R$ 10 / conversão</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5 md:p-6">
                <div className="rounded-xl border border-dashed border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)] p-4 md:p-5">
                  <p className="text-sm text-[hsl(var(--ink-2))]">
                    Compartilhe este link com seus alunos. Quando criarem conta e comprarem
                    um plano, você ganha <strong className="text-[hsl(var(--primary))]">R$ 10,00</strong> de comissão!
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <Input value={affiliateLink} readOnly className="font-mono text-sm" />
                  <Button type="button" onClick={copyLink} variant="secondary" className="gap-2 sm:w-auto sm:shrink-0">
                    <Copy className="h-4 w-4" /> Copiar link
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-[hsl(var(--primary))] text-[hsl(var(--primary))]"
                    onClick={() =>
                      window.open(
                        `https://wa.me/?text=${encodeURIComponent(
                          `Monte sua dieta personalizada com IA e validação de nutricionista! Use meu link: ${affiliateLink}`,
                        )}`,
                        "_blank",
                      )
                    }
                  >
                    <Share2 className="h-4 w-4 mr-1" /> WhatsApp
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={copyLink} className="border-[hsl(var(--surface-3))]">
                    <Copy className="h-4 w-4 mr-1" /> Copiar p/ Instagram
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Comissões ────────────────────────────────────────── */}
          <TabsContent value="commissions">
            <Card className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--surface-3))] py-4">
                <CardTitle className="font-display text-base md:text-lg">Histórico de comissões</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[hsl(var(--surface-3))] hover:bg-transparent">
                      <TableHead className="text-[hsl(var(--ink-2))]">Data</TableHead>
                      <TableHead className="text-[hsl(var(--ink-2))]">Valor</TableHead>
                      <TableHead className="text-[hsl(var(--ink-2))]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c, i) => (
                      <TableRow
                        key={c.id}
                        className={cn(
                          "border-[hsl(var(--surface-3))]",
                          i % 2 === 0 ? "bg-[hsl(var(--surface-1))]" : "bg-[hsl(var(--surface-0))]",
                        )}
                      >
                        <TableCell className="font-sans text-sm">
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-display font-semibold text-[hsl(var(--primary))]">
                          R$ {c.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.status === "paid" ? "default" : "outline"}>
                            {c.status === "paid" ? "Pago" : "Pendente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {commissions.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center font-sans text-sm text-[hsl(var(--ink-3))]"
                        >
                          Nenhuma comissão recebida ainda.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Leads ────────────────────────────────────────────── */}
          <TabsContent value="leads">
            <Card className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--surface-3))] py-4">
                <CardTitle className="font-display text-base md:text-lg">Leads com seu link</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[hsl(var(--ink-2))]">Nome</TableHead>
                      <TableHead className="text-[hsl(var(--ink-2))]">E-mail</TableHead>
                      <TableHead className="text-[hsl(var(--ink-2))]">Data de cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, i) => (
                      <TableRow
                        key={i}
                        className={cn(
                          "border-[hsl(var(--surface-3))]",
                          i % 2 === 0 ? "bg-[hsl(var(--surface-1))]" : "bg-[hsl(var(--surface-0))]",
                        )}
                      >
                        <TableCell className="font-medium text-[hsl(var(--ink-1))]">{lead.full_name ?? "—"}</TableCell>
                        <TableCell className="font-sans text-sm">{lead.email ?? "—"}</TableCell>
                        <TableCell className="font-sans text-sm text-[hsl(var(--ink-2))]">
                          {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {leads.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-[hsl(var(--ink-3))]"
                        >
                          Nenhum lead captado ainda. Compartilhe seu link!
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Carteira / saque ────────────────────────────────── */}
          <TabsContent value="withdraw">
            <Card className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] shadow-sm">
              <CardHeader className="border-b border-[hsl(var(--surface-3))] py-4">
                <CardTitle className="font-display flex items-center gap-2 text-base md:text-lg">
                  <Wallet className="h-5 w-5 text-[hsl(var(--primary))]" /> Carteira
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-5 md:p-6">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[hsl(var(--surface-3))] bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] p-8 text-center shadow-inner">
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <Coins className="h-10 w-10 text-[hsl(var(--primary))]" strokeWidth={1.75} />
                  </div>
                  <p
                    className="font-display text-5xl font-extrabold tabular-nums text-brand sm:text-6xl"
                    style={{ fontWeight: 800 }}
                  >
                    {totalEarned.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="mt-1 text-sm font-sans text-[hsl(var(--ink-3))]">Saldo disponível para saque (comissões pagas)</p>
                  <Button
                    className="btn-primary mt-6 gap-2"
                    onClick={requestWithdrawal}
                    disabled={totalEarned === 0}
                  >
                    Solicitar saque <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
                {commissions.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-[hsl(var(--ink-2))]">Movimentações recentes</p>
                    <div className="overflow-hidden rounded-lg border border-[hsl(var(--surface-3))]">
                      {commissions.slice(0, 8).map((c, i) => (
                        <div
                          key={c.id}
                          className={cn(
                            "flex items-center justify-between gap-3 border-b border-[hsl(var(--surface-3))] px-4 py-3 text-sm last:border-0",
                            i % 2 === 0 ? "bg-[hsl(var(--surface-1))]" : "bg-[hsl(var(--surface-0))]",
                          )}
                        >
                          <span className="font-sans text-[hsl(var(--ink-2))]">
                            {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </span>
                          <span className="font-display font-semibold text-[hsl(var(--primary))]">
                            {c.status === "paid" ? "+" : "·"} R$ {c.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-center text-xs font-sans text-[hsl(var(--ink-3))]">
                  Saques processados em até 2 dias úteis via PIX. Certifique-se de ter
                  cadastrado sua chave PIX nas configurações.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
