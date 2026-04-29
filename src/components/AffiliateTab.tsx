import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Users, DollarSign, TrendingUp, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { trackInviteEvent } from "@/services/inviteAnalytics";
import { supabase } from "@/integrations/supabase/client";

type ReferredProfile = {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
};

type ReferralTransaction = {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  created_at: string;
  description: string | null;
};

export default function AffiliateTab() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referredProfiles, setReferredProfiles] = useState<ReferredProfile[]>([]);
  const [referredTransactions, setReferredTransactions] = useState<ReferralTransaction[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    void (async () => {
      setLoading(true);
      try {
        const { data: referrals, error: referralsError } = await (supabase as any)
          .from("profiles")
          .select("id, user_id, full_name, created_at")
          .eq("referred_by", user.id)
          .order("created_at", { ascending: false });
        if (referralsError) throw referralsError;
        const safeReferrals = (referrals ?? []) as ReferredProfile[];
        setReferredProfiles(safeReferrals);

        const referredUserIds = safeReferrals.map((p) => p.user_id);
        if (referredUserIds.length === 0) {
          setReferredTransactions([]);
          return;
        }

        const { data: txs, error: txError } = await (supabase as any)
          .from("transactions")
          .select("id, user_id, amount, type, created_at, description")
          .in("user_id", referredUserIds)
          .order("created_at", { ascending: false });
        if (txError) throw txError;
        setReferredTransactions((txs ?? []) as ReferralTransaction[]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Falha ao carregar dados de indicação.";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const referralLink = useMemo(() => {
    if (!profile?.id) return "";
    return `${window.location.origin}/cadastro?ref=${profile.id}`;
  }, [profile?.id]);

  const stats = useMemo(() => {
    const referralsByUser = new Map<string, ReferralTransaction[]>();
    for (const tx of referredTransactions) {
      const bucket = referralsByUser.get(tx.user_id) ?? [];
      bucket.push(tx);
      referralsByUser.set(tx.user_id, bucket);
    }

    const paidSignals = new Set(
      referredTransactions
        .filter((tx) => {
          const t = String(tx.type || "").toLowerCase();
          return tx.amount > 0 && (t.includes("plan_upgrade") || t.includes("credit_purchase") || t.includes("payment"));
        })
        .map((tx) => tx.user_id),
    );

    const commissionByUser = new Map<string, number>();
    for (const tx of referredTransactions) {
      const t = String(tx.type || "").toLowerCase();
      const d = String(tx.description || "").toLowerCase();
      if (!t.includes("commission") && !d.includes("comiss")) continue;
      commissionByUser.set(tx.user_id, (commissionByUser.get(tx.user_id) ?? 0) + Number(tx.amount ?? 0));
    }

    const history = referredProfiles.map((p) => {
      const converted = paidSignals.has(p.user_id) || (commissionByUser.get(p.user_id) ?? 0) > 0;
      return {
        id: p.id,
        name: p.full_name?.trim() || "Usuário indicado",
        date: new Date(p.created_at).toLocaleDateString("pt-BR"),
        status: converted ? "convertido" : "pendente",
        value: commissionByUser.get(p.user_id) ?? 0,
      };
    });

    const commissionTotal = Array.from(commissionByUser.values()).reduce((sum, n) => sum + n, 0);
    return {
      totalReferrals: referredProfiles.length,
      conversions: paidSignals.size,
      pendingCommission: 0,
      paidCommission: commissionTotal,
      history,
    };
  }, [referredProfiles, referredTransactions]);

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    void trackInviteEvent({
      code: profile?.id ?? "",
      ownerId: user?.id,
      eventType: "copy",
    });
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent border border-primary/20 text-sm mb-3">
          <Gift className="h-3.5 w-3.5 text-primary" />
          Programa de Indicação
        </div>
        <h2 className="text-2xl font-display font-bold">Indique e Ganhe</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ganhe <strong className="text-primary">30% de comissão</strong> (R$ 11,99) por cada indicação que virar cliente.
        </p>
      </div>

      {/* Referral Link */}
      <Card className="glass-card border-primary/20">
        <CardContent className="p-6">
          <p className="text-sm font-medium mb-2">Seu link de indicação:</p>
          <div className="flex gap-2">
            <Input value={referralLink || "Carregando link..."} readOnly className="font-mono text-sm" />
            <Button onClick={copyLink} variant="outline" className="gap-1.5 flex-shrink-0">
              <Copy className="h-4 w-4" /> Copiar Link
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
              window.open(`https://wa.me/?text=${encodeURIComponent(`Olha essa plataforma incrível de dietas! Use meu link: ${referralLink}`)}`, "_blank");
            }}>
              <Share2 className="h-3 w-3" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={copyLink}>
              <Share2 className="h-3 w-3" /> Instagram
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-5 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold">{loading ? "..." : stats.totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Cadastros gerados</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold">{loading ? "..." : stats.conversions}</p>
            <p className="text-xs text-muted-foreground">Conversões pagas</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5 text-center">
            <DollarSign className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold text-primary">R$ {(loading ? 0 : stats.pendingCommission).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Pendente</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5 text-center">
            <DollarSign className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold">R$ {(loading ? 0 : stats.paidCommission).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Comissão Paga</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-display text-lg">Vendas por Indicação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Carregando métricas de indicação...</p>
            ) : stats.history.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum cadastro por indicação ainda.</p>
            ) : (
              stats.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{h.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={h.status === "convertido" ? "default" : "outline"} className="text-xs">
                      {h.status === "convertido" ? "Convertido" : "Pendente"}
                    </Badge>
                    <span className="text-sm font-semibold text-primary">R$ {h.value.toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
