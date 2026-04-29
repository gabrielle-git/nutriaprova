import { useState, useRef, useEffect } from "react";
import {
  AnimatePresence,
  motion,
  useSpring,
  useInView,
  useTransform,
} from "framer-motion";
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
import PlanCheckoutModal, { type CheckoutPlanSelection } from "@/components/PlanCheckoutModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    tagline: "Primeiros atendimentos",
    priceMonthly: 39.9,
    isFree: false,
    priceDetail: "/mês",
    icon: Sparkles,
    iconClass: "text-[hsl(var(--ink-3))]",
    coins: "20 moedas iniciais",
    ai: "5 correções de IA por dia",
    benefits: [
      "20 moedas iniciais",
      "Assinatura digital (nome + CRN) nos PDFs",
      "5 correções de IA por dia",
      "Ganho de R$ 15,00 por dieta validada",
      "Saque via Pix",
    ],
    notIncluded: [
      "Upload de logomarca (white-label)",
      "Leads exclusivos",
      "Comissões de afiliados (10%)",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Escalando a carteira",
    priceMonthly: 99.9,
    isFree: false,
    priceDetail: "/mês",
    icon: Crown,
    iconClass: "text-primary",
    highlight: true,
    coins: "120 moedas renovadas/mês",
    ai: "10 correções de IA por dia",
    benefits: [
      "Tudo do plano Basic, e mais:",
      "120 moedas renovadas/mês",
      "10 correções de IA por dia",
      "Leads exclusivos",
      "Upload de logomarca (white-label)",
      "Comissões de afiliados (10%)",
    ],
    notIncluded: ["White-label equipe multi-nutri"],
  },
  {
    id: "clinic",
    name: "Clínica",
    tagline: "Equipe + marca própria",
    priceMonthly: 199.9,
    isFree: false,
    priceDetail: "/mês",
    icon: Building2,
    iconClass: "text-teal-700 dark:text-teal-300",
    coins: "Moedas ilimitadas",
    ai: "IA ilimitada (sem cap diário)",
    benefits: [
      "Tudo do plano Premium, e mais:",
      "Moedas ilimitadas",
      "IA ilimitada (sem cap diário)",
      "Até 4 nutricionistas no painel, ideal para escalar sua experiência clínica",
      "Suporte prioritário + CRM",
    ],
    notIncluded: [] as string[],
  },
];

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
    const y = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
    setTilt({ x, y });
  };
  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: "spring", stiffness: 250, damping: 25 }}
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Contador visual para reforço de urgência (SLA) — usa useSpring + useInView conforme PROMPT 6. */
function ModalUrgencyHours() {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-5%" });
  const spring = useSpring(0, { stiffness: 55, damping: 22 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  useEffect(() => {
    if (isInView) spring.set(24);
  }, [isInView, spring]);
  return (
    <motion.span ref={ref} className="text-brand-animated inline-block font-display text-lg font-bold tabular-nums">
      {display}
    </motion.span>
  );
}

export default function PlansModal({ open, onOpenChange, currentTier = "freemium" }: PlansModalProps) {
  const { user, refreshProfile } = useAuth();
  const [annual, setAnnual] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlanSelection | null>(null);
  const [downgrading, setDowngrading] = useState(false);
  const normalizedCurrentTier = String(currentTier || "freemium").toLowerCase();

  const openCheckoutForPlan = (plan: (typeof PLANS)[number], amount: number) => {
    setCheckoutPlan({ name: plan.name, tier: plan.id, amount });
    setCheckoutOpen(true);
  };

  const handleDowngradeToFreemium = async () => {
    if (!user) {
      toast.error("Faça login para alterar seu plano.");
      return;
    }
    const confirmed = window.confirm(
      "Tem certeza que deseja cancelar a assinatura e voltar para o plano Freemium?",
    );
    if (!confirmed) return;

    setDowngrading(true);
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ plan_tier: "freemium" })
        .eq("user_id", user.id);
      if (profileErr) throw profileErr;

      const { error: txErr } = await supabase.from("transactions").insert({
        user_id: user.id,
        amount: 0,
        type: "plan_downgrade",
        description: "Downgrade para Freemium solicitado pelo usuário",
      });
      if (txErr) throw txErr;

      await refreshProfile();
      toast.success("Plano alterado para Freemium.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível fazer o downgrade.";
      toast.error(message);
    } finally {
      setDowngrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader className="text-center sm:text-left">
          <motion.div
            initial={{ opacity: 0, scale: 0.88, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <DialogTitle className="font-display text-2xl font-extrabold text-[hsl(var(--ink-1))]">
              Planos e assinaturas
            </DialogTitle>
            <DialogDescription className="font-sans text-base text-[hsl(var(--ink-2))]">
              Escolha o plano ideal para escalar seus atendimentos no nutrIAprova.
            </DialogDescription>
          </motion.div>
        </DialogHeader>

        <div className="relative mx-auto mt-2 flex w-full max-w-sm justify-center">
          <div
            className="bg-grid pointer-events-none absolute inset-0 -z-10 opacity-20"
            aria-hidden
          />
          <motion.div
            layout
            className="relative inline-flex min-w-[260px] rounded-full bg-[hsl(var(--surface-2))] p-1 shadow-sm"
            role="group"
            aria-label="Mensal ou anual"
          >
            <motion.div
              layoutId="billing-toggle-modal"
              className="pointer-events-none absolute bottom-1 top-1 rounded-full bg-white shadow-sm"
              style={{ width: "calc(50% - 4px)" }}
              initial={false}
              animate={{ left: annual ? "calc(50% + 0px)" : "4px" }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            />
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "relative z-10 flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                !annual ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-3))]",
              )}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                annual ? "text-[hsl(var(--ink-1))]" : "text-[hsl(var(--ink-3))]",
              )}
            >
              Anual
              <motion.span
                className="badge-gold !px-1.5 !py-0.5 text-[0.6rem] leading-none"
                animate={{ scale: annual ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              >
                -20%
              </motion.span>
            </button>
          </motion.div>
        </div>
        <p className="text-center text-[11px] text-[hsl(var(--ink-3))]">Exibição: preço anual = equivalente por mês com -20%.</p>

        <div className="pulse-brand mt-4 rounded-xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 px-4 py-3 text-center">
          <p className="font-sans text-xs text-[hsl(var(--ink-2))]">
            Resposta do onboarding em até{" "}
            <ModalUrgencyHours />
            <span className="text-brand-animated font-semibold">h</span>
            {" "}úteis após a confirmação do pagamento.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3 md:items-stretch">
          {PLANS.map((plan, index) => {
            const Icon = plan.icon;
            const isCurrent = normalizedCurrentTier === plan.id;
            const isHighlight = "highlight" in plan && plan.highlight;
            const linePrice = (() => {
              if (plan.isFree) {
                return {
                  main: "Grátis",
                  suffix: "" as string,
                  note: "sem cobrança recorrente" as string | null,
                };
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
            const priceKey = `${linePrice.main}|${annual}|${plan.id}`;

            const cardInner = (
              <Card
                className={cn(
                  "group relative flex min-h-full flex-col overflow-visible rounded-[var(--radius)]",
                  isHighlight
                    ? "border-2 border-[hsl(var(--primary))] shadow-card-hover"
                    : "card-clinical",
                  isCurrent && "ring-2 ring-primary/30",
                  isHighlight && "border-beam gradient-border",
                )}
              >
                {isHighlight && (
                  <motion.div
                    className="absolute -top-3 left-1/2 z-10 w-max min-w-0 -translate-x-1/2"
                    initial={{ opacity: 0, y: -10, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 18 }}
                  >
                    <Badge className="rounded-full border-0 bg-[hsl(var(--primary))] px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-white sm:text-[11px]">
                      Mais popular
                    </Badge>
                  </motion.div>
                )}
                {isCurrent && (
                  <Badge
                    variant="outline"
                    className="absolute -top-2.5 right-2 z-10 border-primary bg-card text-primary sm:right-3"
                  >
                    Plano atual
                  </Badge>
                )}

                <motion.div
                  animate={isHighlight ? { y: [0, -4, 0] } : { y: 0 }}
                  transition={
                    isHighlight
                      ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.2 }
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", plan.iconClass)} />
                      <CardTitle className="font-display text-[1.25rem] font-bold text-[hsl(var(--ink-1))]">{plan.name}</CardTitle>
                    </div>
                    <p className="mt-1 font-sans text-xs text-[hsl(var(--ink-3))]">{plan.tagline}</p>
                    <div className="mt-3 min-h-[3.2rem]">
                      <div className="flex flex-wrap items-baseline gap-1">
                        <span className="font-display text-[2.5rem] font-extrabold leading-none text-brand">
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={priceKey}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ duration: 0.2 }}
                              className="inline-block"
                            >
                              {linePrice.main}
                            </motion.span>
                          </AnimatePresence>
                        </span>
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
                  <CardContent className="mt-auto flex flex-1 flex-col space-y-3">
                    <ul className="flex-1 space-y-2">
                      {plan.benefits.map((b, fi) => {
                        const isCascadeHeader = b.startsWith("Tudo do plano");
                        const isClinicTeamExclusive = b.includes("escalar sua experiência clínica");
                        const featureHighlight = isCascadeHeader || isClinicTeamExclusive;
                        return (
                          <motion.li
                            key={b}
                            className="flex items-start gap-2 font-sans text-sm text-[hsl(var(--ink-2))]"
                            initial={{ opacity: 0, x: -16 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.1 }}
                            transition={{ delay: fi * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <motion.span
                              className="mt-0.5 inline-flex"
                              initial={{ scale: 0, opacity: 0 }}
                              whileInView={{ scale: 1, opacity: 1 }}
                              viewport={{ once: true, amount: 0.1 }}
                              transition={{
                                delay: fi * 0.06 + 0.1,
                                type: "spring",
                                stiffness: 500,
                                damping: 22,
                              }}
                            >
                              <Check className={cn("h-4 w-4 flex-shrink-0", featureHighlight ? "text-emerald-600" : "text-primary")} strokeWidth={2.5} />
                            </motion.span>
                            <span className={cn(featureHighlight && "font-semibold text-primary leading-snug")}>{b}</span>
                          </motion.li>
                        );
                      })}
                      {plan.notIncluded.map((b) => (
                        <li key={b} className="flex items-start gap-2 font-sans text-sm text-[hsl(var(--ink-3))]">
                          <X className="mt-0.5 h-4 w-4 flex-shrink-0 opacity-80" strokeWidth={2} />
                          <span className="line-through opacity-80">{b}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto">
                      {isHighlight ? (
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 350 }}
                          className="pt-1"
                        >
                          <Button
                            className={cn(
                              "btn-primary btn-breathe border-beam relative w-full overflow-hidden shadow-none transition-shadow group-hover:shadow-[0_0_32px_hsl(158_72%_32%_/_0.5)]",
                            )}
                            variant="default"
                            disabled={isCurrent}
                            onClick={() => openCheckoutForPlan(plan, annual ? plan.priceMonthly * 0.8 : plan.priceMonthly)}
                          >
                            {isCurrent ? "Plano ativo" : `Escolher ${plan.name}`}
                          </Button>
                        </motion.div>
                      ) : (
                        <Button
                          className="w-full border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] text-slate-900 hover:bg-[hsl(var(--surface-2))] dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                          variant="outline"
                          disabled={isCurrent}
                          onClick={() => openCheckoutForPlan(plan, annual ? plan.priceMonthly * 0.8 : plan.priceMonthly)}
                        >
                          {isCurrent ? "Plano ativo" : `Escolher ${plan.name}`}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </motion.div>
              </Card>
            );

            return (
              <motion.div
                key={plan.id}
                className="h-full"
                initial={{ opacity: 0, y: 40, scale: 0.93 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.12, ease: [0.16, 1, 0.3, 1], duration: 0.55 }}
              >
                <TiltCard className={cn("h-full", isHighlight && "rounded-[var(--radius)]")}>
                  {cardInner}
                </TiltCard>
              </motion.div>
            );
          })}
        </div>

        {normalizedCurrentTier !== "freemium" && (
          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-xs text-[hsl(var(--ink-3))] underline underline-offset-4 hover:text-destructive disabled:opacity-60"
              onClick={handleDowngradeToFreemium}
              disabled={downgrading}
            >
              {downgrading ? "Processando cancelamento..." : "Cancelar assinatura (voltar para Freemium)"}
            </button>
          </div>
        )}

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
      <PlanCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={checkoutPlan}
        onApproved={() => onOpenChange(false)}
      />
    </Dialog>
  );
}
