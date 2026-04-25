import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Building2, Zap, Coins, CreditCard, QrCode, ShieldCheck } from "lucide-react";

interface PlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
}

// Paleta harmônica (sem amarelo):
//   - emerald (verde esmeralda) → plano principal / CTAs
//   - teal (azul petróleo)       → plano Clínica / destaques premium
// Evita qualquer `text-coin-gold` / `text-yellow-*` que poluía a UI.
const PLANS = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Para quem está começando",
    price: "Grátis",
    priceDetail: "sem cobrança recorrente",
    icon: Sparkles,
    iconClass: "text-muted-foreground",
    borderClass: "border-border",
    coins: "20 moedas iniciais",
    ai: "5 correções de IA por dia",
    benefits: [
      "20 moedas iniciais ao ativar o plano",
      "5 correções de IA por dia (Gemini)",
      "R$ 15,00 por validação aprovada",
      "Feed público de pedidos de dieta",
      "Painel básico de ganhos",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Para quem quer escalar",
    price: "R$ 99,90",
    priceDetail: "/mês",
    icon: Crown,
    iconClass: "text-primary",
    borderClass: "border-primary",
    highlight: true,
    coins: "120 moedas/mês",
    ai: "10 correções de IA por dia",
    benefits: [
      "120 moedas renovadas todo mês",
      "10 correções de IA por dia (Gemini)",
      "Leads exclusivos encaminhados por Personals",
      "Assinatura digital com CRN nos PDFs",
      "Painel de retenção + WhatsApp Bot",
      "Comissões de afiliados (10%)",
    ],
  },
  {
    id: "clinic",
    name: "Clínica",
    tagline: "Para clínicas e grupos",
    price: "R$ 199,90",
    priceDetail: "/mês",
    icon: Building2,
    // Verde esmeralda mais escuro / azul petróleo — harmoniza com o resto.
    iconClass: "text-teal-700 dark:text-teal-300",
    borderClass: "border-teal-600/60 dark:border-teal-400/50",
    coins: "Moedas ilimitadas",
    ai: "IA ilimitada (sem cap diário)",
    benefits: [
      "Moedas ilimitadas — validações sem custo por job",
      "IA ilimitada (sem limite diário de correções)",
      "White-label: logotipo da sua clínica nos PDFs",
      "Assinatura personalizada + selo CRN",
      "Até 4 nutricionistas parceiros no mesmo painel",
      "Suporte prioritário e CRM de Leads",
    ],
  },
];

export default function PlansModal({ open, onOpenChange, currentTier = "basic" }: PlansModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Planos e Assinaturas</DialogTitle>
          <DialogDescription>
            Escolha o plano ideal para escalar seus atendimentos no nutrIAprova.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentTier === plan.id;
            return (
              <Card
                key={plan.id}
                className={`relative ${plan.borderClass} ${plan.highlight ? "border-2 shadow-lg" : "border"} ${
                  isCurrent ? "ring-2 ring-primary/40" : ""
                }`}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Mais Popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge variant="outline" className="absolute -top-2.5 right-3 bg-card border-primary text-primary">
                    Plano Atual
                  </Badge>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${plan.iconClass}`} />
                    <CardTitle className="font-display text-lg">{plan.name}</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{plan.tagline}</p>
                  <div className="mt-3">
                    <span className="text-3xl font-display font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground ml-1">{plan.priceDetail}</span>
                  </div>

                  {/* Destaque rápido: Moedas + IA — tirar dúvida de um olhar */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
                      <Coins className={`h-3 w-3 ${plan.iconClass}`} />
                      {plan.coins}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
                      <Zap className={`h-3 w-3 ${plan.iconClass}`} />
                      {plan.ai}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-2">
                    {plan.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${plan.iconClass}`} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full mt-4 ${plan.highlight ? "emerald-gradient text-primary-foreground" : ""}`}
                    variant={plan.highlight ? "default" : "outline"}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Plano Ativo" : `Assinar ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Métodos de pagamento aceitos */}
        <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-display font-semibold">Métodos de pagamento aceitos</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <QrCode className="h-4 w-4 text-primary" />
              <span className="font-medium">Pix</span>
              <span className="text-xs text-muted-foreground">— aprovação imediata</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-medium">Cartão de crédito</span>
              <span className="text-xs text-muted-foreground">— Visa, Master, Elo, Amex</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Pagamentos processados com criptografia. Cancele quando quiser, sem multa.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
