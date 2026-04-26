import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const benefits = [
  {
    icon: <Brain className="h-8 w-8 text-primary" />,
    title: "IA que trabalha por você",
    description:
      "Valide e corrija planos alimentares em segundos com a IA do Gemini 1.5 ajustando proteína, carbo, gordura e alergias.",
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-primary" />,
    title: "Assinatura digital + logo",
    description:
      "Gere PDFs profissionais com sua assinatura e logomarca — white-label completo no plano Clínica.",
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
    monthlyBrl: 49.9,
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
    { text: "Correções de IA", included: false },
    { text: "Saque via Pix", included: false },
    { text: "Leads exclusivos", included: false },
    { text: "White-label / equipe", included: false },
  ],
  basic: [
    { text: "20 moedas iniciais", included: true },
    { text: "5 correções de IA por dia", included: true },
    { text: "R$ 15,00 por validação", included: true },
    { text: "Saque via Pix", included: true },
    { text: "Leads exclusivos", included: false },
    { text: "Comissões de afiliados (10%)", included: false },
  ],
  premium: [
    { text: "120 moedas renovadas/mês", included: true },
    { text: "10 correções de IA por dia", included: true },
    { text: "Leads exclusivos", included: true },
    { text: "Assinatura digital com CRN", included: true },
    { text: "Comissões de afiliados (10%)", included: true },
    { text: "White-label equipe multi-nutri", included: false },
  ],
  clinic: [
    { text: "Moedas ilimitadas", included: true },
    { text: "IA ilimitada (sem cap diário)", included: true },
    { text: "White-label com logo da clínica", included: true },
    { text: "Até 4 nutricionistas no painel", included: true },
    { text: "Suporte prioritário + CRM", included: true },
    { text: "Todos os benefícios Premium", included: true },
  ],
};

const compareBoolRows: { label: string; tiers: Record<PlanTier, boolean> }[] = [
  { label: "Saque via Pix", tiers: { freemium: false, basic: true, premium: true, clinic: true } },
  { label: "Correções de IA", tiers: { freemium: false, basic: true, premium: true, clinic: true } },
  { label: "Leads exclusivos", tiers: { freemium: false, basic: false, premium: true, clinic: true } },
  { label: "Assinatura / CRN em PDF", tiers: { freemium: false, basic: true, premium: true, clinic: true } },
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

export default function PlanosLanding() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  const goRegister = () => navigate("/auth?role=nutritionist&openRegister=true");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-hero px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-[2.5rem] font-extrabold leading-tight tracking-tight text-[hsl(var(--ink-1))]">
            Escolha seu plano
          </h1>
          <p className="mx-auto mt-3 max-w-md font-sans text-base font-normal text-[hsl(var(--ink-2))]">
            Escale validações com IA, moedas e PDFs profissionais. Compare com clareza e suba de nível quando fizer sentido.
          </p>

          <div className="mx-auto mt-8 flex justify-center">
            <div
              className="relative inline-flex rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] p-1 shadow-sm"
              role="group"
              aria-label="Período de cobrança"
            >
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={cn(
                  "relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
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
                  "relative z-10 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
                  annual
                    ? "bg-[hsl(var(--surface-0))] text-[hsl(var(--ink-1))] shadow-sm"
                    : "text-[hsl(var(--ink-3))]",
                )}
              >
                Anual
                <span className="badge-gold scale-90 text-[0.65rem] leading-none">-20%</span>
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-xs text-[hsl(var(--ink-3))]">
            {annual
              ? "Valores equivalentes ao mês com economia de 20% na fidelidade anual (exibição)."
              : "Preços base mensal. Você pode comparar o anual no toggle acima."}
          </p>

          <button
            type="button"
            onClick={goRegister}
            className="btn-primary mt-8 h-12 px-10 text-base"
          >
            Começar grátis
          </button>
          <p className="mt-3 font-sans text-xs text-[hsl(var(--ink-3))]">Sem cartão para testar · cancele quando quiser</p>
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

      {/* Planos */}
      <section className="border-y border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] py-16 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="mb-2 font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl">Planos e preços</h2>
            <p className="mx-auto max-w-2xl font-sans text-sm text-[hsl(var(--ink-2))]">
              <strong>IA</strong> e <strong>moedas</strong> lado a lado — escolha o ritmo do seu consultório.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {planSummary.map((p) => {
              const display = priceDisplayMain(p, annual);
              return (
                <div
                  key={p.name}
                  className={cn(
                    "relative flex min-h-[320px] flex-col rounded-[var(--radius)] p-6 transition-shadow duration-300",
                    p.highlight
                      ? "border-2 border-[hsl(var(--primary))] shadow-card-hover"
                      : "card-clinical",
                  )}
                >
                  {p.highlight && (
                    <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[hsl(var(--primary))] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
                      Mais popular
                    </span>
                  )}

                  <h3 className="font-display text-[1.25rem] font-bold text-[hsl(var(--ink-1))]">{p.name}</h3>
                  <p className="mt-0.5 font-sans text-xs text-[hsl(var(--ink-3))]">{p.tagline}</p>

                  <div className="mt-4 min-h-[4.5rem]">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="font-display text-[2.5rem] font-extrabold leading-none text-brand">
                        {display.main}
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
                    {cardFeatureRows[p.tier].map((row) => (
                      <li key={row.text} className="flex items-start gap-2">
                        {row.included ? (
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" strokeWidth={2.5} />
                        ) : (
                          <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[hsl(var(--ink-3))] opacity-70" strokeWidth={2} />
                        )}
                        <span
                          className={cn(
                            "font-sans text-[14px] leading-snug",
                            row.included ? "text-[hsl(var(--ink-2))]" : "text-[hsl(var(--ink-3))] line-through",
                          )}
                        >
                          {row.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {p.highlight ? (
                    <button
                      type="button"
                      onClick={goRegister}
                      className="btn-primary mt-auto w-full py-2.5"
                    >
                      Escolher {p.name}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goRegister}
                      className="mt-auto w-full rounded-[var(--radius-sm)] border border-[hsl(var(--surface-3))] bg-transparent py-2.5 text-sm font-semibold text-[hsl(var(--ink-1))] transition-colors hover:bg-[hsl(var(--surface-2))]"
                    >
                      Escolher {p.name}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <button type="button" onClick={goRegister} className="btn-primary h-12 px-10 text-base">
              Começar agora
            </button>
          </div>
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
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqItems.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="card-clinical border-0 !border-0"
              >
                <AccordionTrigger className="px-4 py-3 text-left font-display text-base font-semibold text-[hsl(var(--ink-1))] hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="px-4 pb-3 text-left font-sans text-sm font-normal text-[hsl(var(--ink-2))]">{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
    </div>
  );
}
