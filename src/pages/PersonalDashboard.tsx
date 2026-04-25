import { useState, useEffect } from "react";
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
  Copy, Users, Wallet, TrendingUp, DollarSign,
  Link, Share2, ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { trackInviteEvent } from "@/services/inviteAnalytics";

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

// ── Componente ───────────────────────────────────────────────────────────────
export default function PersonalDashboard() {
  const { user } = useAuth();

  const [affiliateCode, setAffiliateCode] = useState("");
  const [commissions,   setCommissions]   = useState<Commission[]>([]);
  const [totalEarned,   setTotalEarned]   = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [leads,         setLeads]         = useState<Lead[]>([]);
  const [loading,       setLoading]       = useState(true);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold">Painel do Personal Trainer</h1>
          <p className="text-muted-foreground">Gerencie seu link de afiliado, comissões e leads</p>
        </div>

        {/* ── Cards de resumo ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="pt-6 text-center">
              <Users className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-3xl font-display font-bold">{leads.length}</p>
              <p className="text-sm text-muted-foreground">Leads Captados</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6 text-center">
              <DollarSign className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-3xl font-display font-bold text-primary">
                R$ {totalEarned.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Comissões Pagas</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-6 text-center">
              <TrendingUp className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-3xl font-display font-bold">
                R$ {pendingAmount.toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">A Receber</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="link" className="space-y-6">
          <TabsList>
            <TabsTrigger value="link">Link de Afiliado</TabsTrigger>
            <TabsTrigger value="commissions">Comissões</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="withdraw">Saque</TabsTrigger>
          </TabsList>

          {/* ── Link ─────────────────────────────────────────────── */}
          <TabsContent value="link">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Link className="h-5 w-5 text-primary" /> Seu Link Exclusivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Compartilhe este link com seus alunos. Quando criarem conta e comprarem
                  um plano, você ganha <strong>R$ 10,00</strong> de comissão!
                </p>
                <div className="flex gap-2">
                  <Input value={affiliateLink} readOnly className="font-mono text-sm" />
                  <Button onClick={copyLink} variant="outline" className="gap-1.5">
                    <Copy className="h-4 w-4" /> Copiar
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
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
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    <Copy className="h-4 w-4 mr-1" /> Copiar p/ Instagram
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Comissões ────────────────────────────────────────── */}
          <TabsContent value="commissions">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Histórico de Comissões</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-semibold text-primary">
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
                          className="text-center text-muted-foreground py-6"
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
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Leads que usaram seu link</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, i) => (
                      <TableRow key={i}>
                        <TableCell>{lead.full_name ?? "—"}</TableCell>
                        <TableCell>{lead.email ?? "—"}</TableCell>
                        <TableCell>
                          {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {leads.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-6"
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

          {/* ── Saque ────────────────────────────────────────────── */}
          <TabsContent value="withdraw">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" /> Saque de Comissões
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
                  <DollarSign className="h-10 w-10 text-primary mx-auto mb-2" />
                  <p className="text-4xl font-display font-bold text-primary">
                    R$ {totalEarned.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Saldo disponível para saque
                  </p>
                  <Button
                    className="emerald-gradient text-primary-foreground mt-4"
                    onClick={requestWithdrawal}
                    disabled={totalEarned === 0}
                  >
                    Solicitar Saque <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
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