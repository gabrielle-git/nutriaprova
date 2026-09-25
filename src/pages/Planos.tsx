import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useSpring,
  useTransform,
  useInView,
} from "framer-motion";
import {
  Brain,
  ShieldCheck,
  TrendingUp,
  Users,
  Coins,
  Zap,
  QrCode,
  CreditCard,
  Check,
  X,
  ChevronDown,
  ArrowLeft,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, type Profile } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import PlanCheckoutModal, { type CheckoutPlanSelection } from "@/components/PlanCheckoutModal";
import { toast } from "sonner";
import { downgradeOwnPlanToFreemium } from "@/services/profileEconomicService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const benefits = [
  {
    icon: <Brain className="h-8 w-8 text-primary" />,
    title: "IA que trabalha por você",
    description:
      "Valide e corrija planos alimentares em segundos com a IA do Gemini 1.5 ajustando proteína, carbo, gordura e alergias.",
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: "Assinatura legal e marca própria",
    description:
      "Todos os nutricionistas usam assinatura em texto (nome + CRN) nos PDFs. A logomarca da clínica nos documentos é exclusiva dos planos Premium e Clínica.",
  },
  {
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
    title: "Ganhe mais atendendo mais",
    description:
      "Sistema de moedas: cada validação gera receita. Faça upgrade e desbloqueie saques via Pix.",
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Plano Clínica para equipes",
    description:
      "Convide até 4 nutricionistas parceiros, compartilhe a marca e gerencie tudo num só painel.",
  },
];

type PlanTier = "freemium" | "basic" | "premium" | "clinic";

interface PlanCard {
  name: string;
  tier: PlanTier;
  tagline: string;
  /** Valor mensal em reais (só exibição do toggle anual) */
  monthlyBrl: number | null;
  coins: string;
  ai: string;
  highlight?: boolean;
}

const planSummary: PlanCard[] = [
  {
    name: "Freemium",
    tier: "freemium",
    monthlyBrl: null,
    tagline: "Conhecer a plataforma",
    coins: "5 moedas (bônus único)",
    ai: "Sem IA — só visualização",
  },
  {
    name: "Basic",
    tier: "basic",
    monthlyBrl: 39.9,
    tagline: "Primeiros atendimentos",
    coins: "20 moedas iniciais",
    ai: "5 correções de IA por dia",
  },
  {
    name: "Premium",
    tier: "premium",
    monthlyBrl: 99.9,
    tagline: "Escalando a carteira",
    coins: "120 moedas renovadas/mês",
    ai: "10 correções de IA por dia",
    highlight: true,
  },
  {
    name: "Clínica",
    tier: "clinic",
    monthlyBrl: 199.9,
    tagline: "Equipe + marca própria",
    coins: "Moedas ilimitadas",
    ai: "IA ilimitada (sem cap diário)",
  },
];

/** Linhas do card: texto + incluso no plano */
const cardFeatureRows: Record<
  PlanTier,
  { text: string; included: boolean }[]
> = {
  freemium: [
    { text: "Feed de pedidos de dieta", included: true },
    { text: "5 moedas (bônus único)", included: true },
    { text: "Assinatura digital (nome + CRN) nos PDFs", included: true },
    { text: "Upload de logomarca (white-label)", included: false },
    { text: "Correções de IA", included: false },
    { text: "Saque via Pix", included: false },
    { text: "Leads exclusivos", included: false },
    { text: "White-label / equipe", included: false },
  ],
  basic: [
    { text: "20 moedas iniciais", included: true },
    { text: "Assinatura digital (nome + CRN) nos PDFs", included: true },
    { text: "Upload de logomarca (white-label)", included: false },
    { text: "5 correções de IA por dia", included: true },
    { text: "Ganho de R$ 15,00 líquidos por validação", included: true },
    { text: "Saque via Pix", included: true },
    { text: "Leads exclusivos", included: false },
    { text: "Comissões de afiliados (10%)", included: false },
  ],
  premium: [
    { text: "Tudo do plano Basic, e mais:", included: true },
    { text: "120 moedas renovadas/mês", included: true },
    { text: "10 correções de IA por dia", included: true },
    { text: "Leads exclusivos", included: true },
    { text: "Upload de logomarca (white-label)", included: true },
    { text: "Comissões de afiliados (10%)", included: true },
    { text: "White-label equipe multi-nutri", included: false },
  ],
  clinic: [
    { text: "Tudo do plano Premium, e mais:", included: true },
    { text: "Moedas ilimitadas", included: true },
    { text: "IA ilimitada (sem cap diário)", included: true },
    { text: "Até 4 nutricionistas no painel, ideal para escalar sua experiência clínica", included: true },
    { text: "Suporte prioritário + CRM", included: true },
  ],
};

const compareBoolRows: { label: string; tiers: Record<PlanTier, boolean> }[] = [
  { label: "Saque via Pix", tiers: { freemium: false, basic: true, premium: true, clinic: true } },
  { label: "Correções de IA", tiers: { freemium: false, basic: true, premium: true, clinic: true } },
  { label: "Leads exclusivos", tiers: { freemium: false, basic: false, premium: true, clinic: true } },
  {
    label: "Assinatura digital (nome + CRN) nos PDFs",
    tiers: { freemium: true, basic: true, premium: true, clinic: true },
  },
  {
    label: "Upload de logomarca (white-label)",
    tiers: { freemium: false, basic: false, premium: true, clinic: true },
  },
  { label: "Comissões de afiliados", tiers: { freemium: false, basic: false, premium: true, clinic: true } },
  { label: "White-label + equipe", tiers: { freemium: false, basic: false, premium: false, clinic: true } },
];

const faqItems = [
  {
    q: "Posso mudar de plano depois?",
    a: "Sim. Você pode fazer upgrade ou ajustar seu plano quando precisar; o time de suporte orienta sobre o que muda em moedas e IA.",
  },
  {
    q: "Como funcionam as moedas?",
    a: "As moedas são usadas no fluxo de validação de dietas. Planos pagos incluem pacotes maiores ou ilimitados, conforme o tier.",
  },
  {
    q: "O desconto anual de 20% vale para sempre?",
    a: "O -20% na opção anual reflete economia sobre a base mensal para quem prefere compromisso anual — condições comerciais podem ser atualizadas com aviso prévio.",
  },
  {
    q: "Quais formas de pagamento aceitam?",
    a: "Pix com aprovação rápida e cartão de crédito (bandeiras principais), com processamento seguro.",
  },
];

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function priceDisplayMain(
  p: PlanCard,
  annual: boolean,
): { main: string; suffix: string; note: string | null } {
  if (p.monthlyBrl == null) {
    return { main: "Grátis", suffix: "", note: "sem cartão para começar" };
  }
  if (!annual) {
    return { main: formatBrl(p.monthlyBrl), suffix: "/mês", note: null };
  }
  return {
    main: formatBrl(p.monthlyBrl * 0.8),
    suffix: "/mês",
    note: "Equivalente com fidelidade anual (-20%)",
  };
}

const tierOrder: PlanTier[] = ["freemium", "basic", "premium", "clinic"];

function planosHomePath(profile: Profile | null): string {
  if (profile?.role === "client") return "/dashboard";
  return "/inicio";
}

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

function UrgencyHours() {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const spring = useSpring(0, { stiffness: 55, damping: 22 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  useEffect(() => {
    if (isInView) spring.set(24);
  }, [isInView, spring]);
  return (
    <motion.span ref={ref} className="text-brand-animated inline-block font-display text-2xl font-bold tabular-nums">
      {display}
    </motion.span>
  );
}

export default function PlanosLanding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlanSelection | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const homePath = planosHomePath(profile);
  const isDark = resolvedTheme === "dark";
  const currentTier = String(profile?.plan_tier ?? "freemium").toLowerCase();
  const hasPaidPlan = currentTier === "basic" || currentTier === "premium" || currentTier === "clinic";

  const goAuthRegister = () => {
    navigate("/auth?role=nutritionist&openRegister=true");
  };

  /** CTA “começar grátis” / visitante: cadastro; logado: hub do perfil. */
  const goStartFree = () => {
    if (!user) {
      goAuthRegister();
      return;
    }
    navigate(homePath);
  };

  const openCheckoutForPlan = (p: PlanCard) => {
    if (!user) {
      goAuthRegister();
      return;
    }
    if (p.tier === "freemium") {
      toast.info("O plano Freemium já está disponível na sua conta.");
      navigate(homePath);
      return;
    }
    if (currentTier === p.tier) {
      toast.info(`Você já está no plano ${p.name}.`);
      return;
    }
    const base = p.monthlyBrl ?? 0;
    const amt = annual ? Math.round(base * 0.8 * 100) / 100 : base;
    setCheckoutPlan({ name: p.name, tier: p.tier, amount: amt });
    setCheckoutOpen(true);
  };

  const handleCancelSubscription = async () => {
    if (!user || !hasPaidPlan) return;

    setCancelling(true);
    try {
      await downgradeOwnPlanToFreemium();
      await refreshProfile();
      toast.success(
        "Plano alterado para Freemium. Faça upgrade ou compre moedas para continuar validando e acessando recursos premium.",
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível cancelar a assinatura.";
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-[hsl(var(--surface-3))] bg-background/95 px-3 py-2.5 backdrop-blur-md sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 gap-1.5 px-2 text-[hsl(var(--ink-2))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--ink-1))]"
          aria-label="Voltar"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span className="hidden text-sm sm:inline">Voltar</span>
        </Button>
        <div className="flex items-center gap-2">
          {user && hasPaidPlan && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                  Cancelar assinatura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar? Você perderá os benefícios exclusivos e voltará para o plano Freemium.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelando..." : "Sim, cancelar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] text-slate-900 dark:bg-white dark:text-slate-900"
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {!user && (
      <section className="relative overflow-hidden bg-hero px-4 py-16 md:py-20">
        <div
          className="bg-grid pointer-events-none absolute inset-0 opacity-30"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <motion.button
            type="button"
            onClick={goStartFree}
            className="btn-primary btn-breathe border-beam relative h-12 overflow-hidden px-10 text-base text-white"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 350 }}
          >
            Começar grátis
          </motion.button>
          <p className="mt-3 font-sans text-xs text-[hsl(var(--ink-3))]">Sem cartão para testar · cancele quando quiser</p>
        </div>
      </section>
      )}

      {/* Planos */}
      <section className="border-y border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] py-16 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <motion.h1
              className="font-display text-[2.5rem] font-extrabold leading-tight tracking-tight text-[hsl(var(--ink-1))]"
              initial={{ opacity: 0, scale: 0.88, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              Escolha seu plano
            </motion.h1>
            <motion.p
              className="mx-auto mt-3 max-w-md font-sans text-base font-normal text-[hsl(var(--ink-2))] md:max-w-2xl"
              initial={{ opacity: 0, scale: 0.88, filter: "blur(12px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
            >
              Escale validações com IA, moedas e PDFs profissionais. Compare com clareza e suba de nível quando fizer sentido.
            </motion.p>
          </div>
          <div className="mb-8 flex justify-center">
            <motion.div
              layout
              className="relative inline-flex min-w-[280px] rounded-full bg-[hsl(var(--surface-2))] p-1 shadow-sm"
              role="group"
              aria-label="Período de cobrança"
            >
              <motion.div
                layoutId="billing-toggle-planos"
                className="pointer-events-none absolute bottom-1 top-1 rounded-full bg-white shadow-sm dark:bg-white"
                style={{ width: "calc(50% - 4px)" }}
                initial={false}
                animate={{ left: annual ? "calc(50% + 0px)" : "4px" }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={cn(
                  "relative z-10 flex-1 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200",
                  !annual ? "text-slate-900 dark:text-slate-900" : "text-[hsl(var(--ink-3))]",
                )}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={cn(
                  "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200",
                  annual ? "text-slate-900 dark:text-slate-900" : "text-[hsl(var(--ink-3))]",
                )}
              >
                Anual
                <motion.span
                  className="badge-gold origin-center scale-90 text-[0.65rem] leading-none"
                  animate={{ scale: annual ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  -20%
                </motion.span>
              </button>
            </motion.div>
          </div>
          <p className="mb-10 text-center text-xs text-[hsl(var(--ink-3))]">
            {annual
              ? "Valores equivalentes ao mês com economia de 20% na fidelidade anual (exibição)."
              : "Preços base mensal. Você pode comparar o anual no toggle acima."}
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {planSummary.map((p, index) => {
              const display = priceDisplayMain(p, annual);
              const priceKey = `${display.main}|${display.suffix}|${annual}|${p.tier}`;
              return (
                <TiltCard
                  key={p.name}
                  className={cn(
                    "h-full",
                    p.highlight && "border-beam gradient-border rounded-[var(--radius)]",
                  )}
                >
                  <motion.div
                    className="h-full"
                    initial={{ opacity: 0, y: 40, scale: 0.93 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ delay: index * 0.12, ease: [0.16, 1, 0.3, 1], duration: 0.55 }}
                  >
                    <motion.div
                      className={cn(
                        "group relative flex h-full min-h-[320px] flex-col rounded-[var(--radius)] p-6",
                        p.highlight
                          ? "border-2 border-[hsl(var(--primary))] shadow-card-hover"
                          : "card-clinical",
                      )}
                      animate={p.highlight ? { y: [0, -4, 0] } : { y: 0 }}
                      transition={
                        p.highlight
                          ? { duration: 3, repeat: Infinity, ease: "easeInOut" }
                          : { duration: 0.3 }
                      }
                    >
                    {p.highlight && (
                      <motion.span
                        className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[hsl(var(--primary))] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm"
                        initial={{ opacity: 0, y: -10, scale: 0.7 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 18 }}
                      >
                        Mais popular
                      </motion.span>
                    )}

                    <h3 className="font-display text-[1.25rem] font-bold text-[hsl(var(--ink-1))]">{p.name}</h3>
                    <p className="mt-0.5 font-sans text-xs text-[hsl(var(--ink-3))]">{p.tagline}</p>

                    <div className="mt-4 min-h-[4.5rem]">
                      <div className="flex flex-wrap items-baseline gap-1.5">
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
                              {display.main}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                        {display.suffix ? (
                          <span className="font-sans text-sm font-normal text-[hsl(var(--ink-3))]">{display.suffix}</span>
                        ) : null}
                      </div>
                      {display.note && (
                        <p className="mt-1 font-sans text-xs text-[hsl(var(--ink-3))]">{display.note}</p>
                      )}
                    </div>

                    <div className="mb-4 mt-2 space-y-2 border-b border-[hsl(var(--surface-3))] pb-4">
                      <div className="flex items-start gap-2">
                        <Coins className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        <span className="font-sans text-sm text-[hsl(var(--ink-2))]">{p.coins}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        <span className="font-sans text-sm text-[hsl(var(--ink-2))]">{p.ai}</span>
                      </div>
                    </div>

                    <ul className="mb-5 flex-1 space-y-2.5">
                      {cardFeatureRows[p.tier].map((row, fi) => {
                        const isCascadeHeader = row.text.startsWith("Tudo do plano");
                        const isClinicTeamExclusive =
                          row.included && row.text.includes("escalar sua experiência clínica");
                        const featureHighlight = isCascadeHeader || isClinicTeamExclusive;
                        return (
                          <motion.li
                            key={row.text}
                            className="flex items-start gap-2"
                            initial={{ opacity: 0, x: -16 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.15 }}
                            transition={{ delay: fi * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          >
                            {row.included ? (
                              <motion.span
                                className="mt-0.5 inline-flex"
                                initial={{ scale: 0, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                viewport={{ once: true, amount: 0.15 }}
                                transition={{
                                  delay: fi * 0.06 + 0.1,
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 22,
                                }}
                              >
                                <Check className={cn("h-4 w-4 flex-shrink-0", featureHighlight ? "text-emerald-600" : "text-primary")} strokeWidth={2.5} />
                              </motion.span>
                            ) : (
                              <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(var(--ink-3))] opacity-70" strokeWidth={2} />
                            )}
                            <span
                              className={cn(
                                "font-sans text-[14px] leading-snug",
                                row.included ? "text-[hsl(var(--ink-2))]" : "text-[hsl(var(--ink-3))] line-through",
                                featureHighlight && row.included && "font-semibold text-primary",
                              )}
                            >
                              {row.text}
                            </span>
                          </motion.li>
                        );
                      })}
                    </ul>

                    <div className="mt-auto flex justify-center pt-1">
                      {(() => {
                        const isCurrentPlan = !!user && currentTier === p.tier;
                        if (p.highlight) {
                          return (
                            <motion.button
                              type="button"
                              onClick={() => openCheckoutForPlan(p)}
                              disabled={isCurrentPlan}
                              className="btn-primary btn-breathe border-beam relative w-full overflow-hidden py-2.5 text-white shadow-none transition-shadow group-hover:shadow-[0_0_32px_hsl(158_72%_32%_/_0.5)] disabled:cursor-not-allowed disabled:opacity-70"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              transition={{ type: "spring", stiffness: 350 }}
                            >
                              {isCurrentPlan ? "Plano ativo" : `Escolher ${p.name}`}
                            </motion.button>
                          );
                        }
                        return (
                          <button
                            type="button"
                            onClick={() => openCheckoutForPlan(p)}
                            disabled={isCurrentPlan}
                            className="w-full rounded-[var(--radius-sm)] border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-[hsl(var(--surface-2))] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                          >
                            {isCurrentPlan ? "Plano ativo" : `Escolher ${p.name}`}
                          </button>
                        );
                      })()}
                    </div>
                    </motion.div>
                  </motion.div>
                </TiltCard>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <motion.button
              type="button"
              onClick={goStartFree}
              className="btn-primary btn-breathe border-beam relative h-12 overflow-hidden px-10 text-base text-white"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 350 }}
            >
              Começar agora
            </motion.button>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="mb-10 text-center font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl">
          Por que a nutrIAprova?
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="card-clinical flex gap-4 rounded-2xl p-6"
            >
              <div className="shrink-0">{b.icon}</div>
              <div>
                <h3 className="mb-1 font-display text-lg font-bold text-[hsl(var(--ink-1))]">{b.title}</h3>
                <p className="font-sans text-sm text-[hsl(var(--ink-2))]">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Urgência / escassez (percepção de valor — SLA de onboarding) */}
      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="pulse-brand rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--primary))]/5 px-6 py-8 text-center">
          <p className="font-display text-base font-semibold text-[hsl(var(--ink-1))] md:text-lg">
            Onboarding prioritário: primeira resposta em até{" "}
            <UrgencyHours />
            <span className="text-brand-animated font-bold">h</span>
            {" "}úteis após confirmação do pagamento nos planos pagos.
          </p>
        </div>
      </section>

      {/* Comparativo */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="mb-6 text-center font-display text-2xl font-bold text-[hsl(var(--ink-1))]">Comparativo</h2>
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[hsl(var(--surface-3))]">
          <div className="max-h-[min(70vh,520px)] overflow-y-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--surface-3))]">
                  <th className="sticky top-0 z-20 bg-[hsl(var(--surface-0))] py-3 pl-3 pr-2 font-display text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--ink-2))] shadow-[0_1px_0_hsl(var(--surface-3))]">
                    Recurso
                  </th>
                  {tierOrder.map((t) => {
                    const plan = planSummary.find((x) => x.tier === t);
                    return (
                      <th
                        key={t}
                        className="sticky top-0 z-20 bg-[hsl(var(--surface-0))] px-2 py-3 text-center font-display text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--ink-1))] shadow-[0_1px_0_hsl(var(--surface-3))]"
                      >
                        {plan?.name}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {compareBoolRows.map((row) => (
                  <tr key={row.label} className="border-b border-[hsl(var(--surface-3))] last:border-0">
                    <td className="px-3 py-3 font-sans text-[hsl(var(--ink-2))]">{row.label}</td>
                    {tierOrder.map((t) => (
                      <td key={t} className="px-2 py-3 text-center">
                        {row.tiers[t] ? (
                          <Check
                            className="mx-auto h-4 w-4 animate-fade-in text-primary"
                            strokeWidth={2.5}
                            aria-label="Inclui"
                          />
                        ) : (
                          <X
                            className="mx-auto h-4 w-4 animate-fade-in text-[hsl(var(--ink-3))]"
                            strokeWidth={2}
                            aria-label="Não inclui"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] py-16 px-4">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 text-center font-display text-2xl font-bold text-[hsl(var(--ink-1))]">Perguntas frequentes</h2>
          <div className="flex w-full flex-col gap-3">
            {faqItems.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="card-clinical overflow-hidden rounded-[var(--radius)] border border-[hsl(var(--surface-3))] !border-solid"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-display text-base font-semibold text-[hsl(var(--ink-1))] hover:bg-[hsl(var(--surface-2))]/50"
                  >
                    {item.q}
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="inline-flex shrink-0"
                    >
                      <ChevronDown className="h-4 w-4 text-[hsl(var(--ink-3))]" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-3 text-left font-sans text-sm font-normal text-[hsl(var(--ink-2))]">
                          {item.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pagamento */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="mb-2 font-display text-2xl font-bold text-[hsl(var(--ink-1))]">Métodos de pagamento</h2>
          <p className="mx-auto max-w-xl font-sans text-sm text-[hsl(var(--ink-2))]">
            Pague como preferir. Processamento criptografado, sem armazenar dados de cartão no servidor.
          </p>
        </div>

        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card-clinical flex items-center gap-4 rounded-2xl p-6">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <QrCode className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-display font-bold text-[hsl(var(--ink-1))]">Pix</p>
              <p className="mt-0.5 font-sans text-xs text-[hsl(var(--ink-2))]">Aprovação em segundos. Ideal para assinatura recorrente.</p>
            </div>
          </div>

          <div className="card-clinical flex items-center gap-4 rounded-2xl p-6">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-display font-bold text-[hsl(var(--ink-1))]">Cartão de crédito</p>
              <p className="mt-0.5 font-sans text-xs text-[hsl(var(--ink-2))]">Visa, Mastercard, Elo e Amex. Cobrança automática todo mês.</p>
            </div>
          </div>
        </div>
      </section>

      <PlanCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={checkoutPlan}
        billingPeriod={annual ? "annual" : "monthly"}
      />
    </div>
  );
}
