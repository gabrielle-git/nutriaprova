import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Crown,
  Sparkles,
  Building2,
  Zap,
  Coins,
  CreditCard,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: string;
}

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const PLANS = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Para quem está começando",
    priceMonthly: 0,
    isFree: true,
    freeLabel: "Grátis",
    priceDetail: "sem cobrança recorrente",
    icon: Sparkles,
    iconClass: "text-[hsl(var(--ink-3))]",
    coins: "20 moedas iniciais",
    ai: "5 correções de IA por dia",
    benefits: [
      "20 moedas iniciais ao ativar o plano",
      "5 correções de IA por dia (Gemini)",
      "R$ 15,00 por validação aprovada",
      "Feed público de pedidos de dieta",
      "Painel básico de ganhos",
    ],
    notIncluded: ["Leads exclusivos", "Comissões de afiliados (10%)"],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Para quem quer escalar",
    priceMonthly: 99.9,
    isFree: false,
    priceDetail: "/mês",
    icon: Crown,
    iconClass: "text-primary",
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
    notIncluded: [] as string[],
  },
  {
    id: "clinic",
    name: "Clínica",
    tagline: "Para clínicas e grupos",
    priceMonthly: 199.9,
    isFree: false,
    priceDetail: "/mês",
    icon: Building2,
    iconClass: "text-teal-700 dark:text-teal-300",
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
    notIncluded: [] as string[],
  },
];

export default function PlansModal({ open, onOpenChange, currentTier = "basic" }: PlansModalProps) {
  const [annual, setAnnual] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="font-display text-2xl font-extrabold text-[hsl(var(--ink-1))]">
            Planos e assinaturas
          </DialogTitle>
          <DialogDescription className="font-sans text-base text-[hsl(var(--ink-2))]">
            Escolha o plano ideal para escalar seus atendimentos no nutrIAprova.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-auto mt-2 flex w-full max-w-sm justify-center">
          <div
            className="inline-flex rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] p-1"
            role="group"
            aria-label="Mensal ou anual"
          >
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300",
                !annual
                  ? "bg-[hsl(var(--surface-0))] text-[hsl(var(--ink-1))] shadow-sm"
                  : "text-[hsl(var(--ink-3))]",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "relative z-10 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300",
                annual
                  ? "bg-[hsl(var(--surface-0))] text-[hsl(var(--ink-1))] shadow-sm"
                  : "text-[hsl(var(--ink-3))]",
              )}
            >
              Anual
              <span className="badge-gold !px-1.5 !py-0.5 text-[0.6rem] leading-none">-20%</span>
            </button>
          </div>
        </div>
        <p className="text-center text-[11px] text-[hsl(var(--ink-3))]">Exibição: preço anual = equivalente por mês com -20%.</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentTier === plan.id;
            const isHighlight = "highlight" in plan && plan.highlight;
            const linePrice = (() => {
              if (plan.isFree) {
                return { main: plan.freeLabel, suffix: "" as string, note: "sem cobrança recorrente" as string | null };
              }
              if (!annual) {
                return { main: formatBrl(plan.priceMonthly), suffix: plan.priceDetail, note: null as string | null };
              }
              return {
                main: formatBrl(plan.priceMonthly * 0.8),
                suffix: plan.priceDetail,
                note: "Fidelidade anual (-20%)",
              };
            })();

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col overflow-visible rounded-[var(--radius)]",
                  isHighlight
                    ? "border-2 border-[hsl(var(--primary))] shadow-card-hover"
                    : "card-clinical",
                  isCurrent && "ring-2 ring-primary/30",
                )}
              >
                {isHighlight && (
                  <Badge className="absolute -top-3 left-1/2 z-10 w-max min-w-0 -translate-x-1/2 rounded-full border-0 bg-[hsl(var(--primary))] px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white sm:text-[11px]">
                    Mais popular
                  </Badge>
                )}
                {isCurrent && (
                  <Badge
                    variant="outline"
                    className="absolute -top-2.5 right-2 z-10 border-primary bg-card text-primary sm:right-3"
                  >
                    Plano atual
                  </Badge>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", plan.iconClass)} />
                    <CardTitle className="font-display text-[1.25rem] font-bold text-[hsl(var(--ink-1))]">{plan.name}</CardTitle>
                  </div>
                  <p className="mt-1 font-sans text-xs text-[hsl(var(--ink-3))]">{plan.tagline}</p>
                  <div className="mt-3 min-h-[3.2rem]">
                    <div className="flex flex-wrap items-baseline gap-1">
                      <span className="font-display text-[2.5rem] font-extrabold leading-none text-brand">{linePrice.main}</span>
                      {linePrice.suffix ? (
                        <span className="font-sans text-sm text-[hsl(var(--ink-3))]">{linePrice.suffix}</span>
                      ) : null}
                    </div>
                    {linePrice.note && <p className="mt-0.5 font-sans text-xs text-[hsl(var(--ink-3))]">{linePrice.note}</p>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--surface-3))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--ink-1))]">
                      <Coins className={cn("h-3 w-3", plan.iconClass)} />
                      {plan.coins}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--surface-3))] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--ink-1))]">
                      <Zap className={cn("h-3 w-3", plan.iconClass)} />
                      {plan.ai}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <ul className="space-y-2">
                    {plan.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 font-sans text-sm text-[hsl(var(--ink-2))]">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" strokeWidth={2.5} />
                        <span>{b}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((b) => (
                      <li key={b} className="flex items-start gap-2 font-sans text-sm text-[hsl(var(--ink-3))]">
                        <X className="mt-0.5 h-4 w-4 flex-shrink-0 opacity-80" strokeWidth={2} />
                        <span className="line-through opacity-80">{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn("mt-4 w-full", isHighlight && "btn-primary")}
                    variant={isHighlight ? "default" : "outline"}
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Plano ativo" : `Assinar ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 card-clinical rounded-[var(--radius)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Métodos de pagamento aceitos</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] px-3 py-2 text-sm text-[hsl(var(--ink-1))]">
              <QrCode className="h-4 w-4 text-primary" />
              <span className="font-medium">Pix</span>
              <span className="text-xs text-[hsl(var(--ink-3))]">— aprovação imediata</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] px-3 py-2 text-sm text-[hsl(var(--ink-1))]">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="font-medium">Cartão de crédito</span>
              <span className="text-xs text-[hsl(var(--ink-3))]">— Visa, Master, Elo, Amex</span>
            </span>
          </div>
          <p className="mt-3 font-sans text-xs text-[hsl(var(--ink-3))]">
            Pagamentos processados com criptografia. Cancele quando quiser, sem multa.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
