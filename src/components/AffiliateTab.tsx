import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Users, DollarSign, TrendingUp, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { trackInviteEvent } from "@/services/inviteAnalytics";

export default function AffiliateTab() {
  const { user } = useAuth();
  const refCode = user?.id?.slice(0, 8) || "abc123";
  const refLink = `nutrIAprova.com/ref/${refCode}`;

  const mockData = {
    totalReferrals: 7,
    conversions: 3,
    pendingCommission: 35.97,
    paidCommission: 71.94,
    history: [
      { date: "10/04/2026", name: "Maria S.", status: "convertido", value: 11.99 },
      { date: "08/04/2026", name: "João P.", status: "convertido", value: 11.99 },
      { date: "05/04/2026", name: "Ana L.", status: "pendente", value: 11.99 },
      { date: "02/04/2026", name: "Carlos M.", status: "convertido", value: 11.99 },
      { date: "28/03/2026", name: "Fernanda R.", status: "pendente", value: 11.99 },
    ],
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://${refLink}`);
    // Analytics — registra a cópia no painel admin (Performance de Convites).
    void trackInviteEvent({
      code: refCode,
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
            <Input value={`https://${refLink}`} readOnly className="font-mono text-sm" />
            <Button onClick={copyLink} variant="outline" className="gap-1.5 flex-shrink-0">
              <Copy className="h-4 w-4" /> Copiar
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
              window.open(`https://wa.me/?text=${encodeURIComponent(`Olha essa plataforma incrível de dietas! Use meu link: https://${refLink}`)}`, "_blank");
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
            <p className="text-2xl font-display font-bold">{mockData.totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Indicações</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold">{mockData.conversions}</p>
            <p className="text-xs text-muted-foreground">Conversões</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5 text-center">
            <DollarSign className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold text-primary">R$ {mockData.pendingCommission.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Pendente</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-5 text-center">
            <DollarSign className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold">R$ {mockData.paidCommission.toFixed(2)}</p>
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
            {mockData.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
