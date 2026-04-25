import { useNavigate } from "react-router-dom";
import {
  Brain, ShieldCheck, TrendingUp, Users,
  Coins, Zap, QrCode, CreditCard, Check,
} from "lucide-react";

const benefits = [
  {
    icon: <Brain className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
    title: "IA que trabalha por você",
    description:
      "Valide e corrija planos alimentares em segundos com a IA do Gemini 1.5 ajustando proteína, carbo, gordura e alergias.",
  },
  {
    icon: <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
    title: "Assinatura digital + Logo",
    description:
      "Gere PDFs profissionais com sua assinatura e logomarca — white-label completo no plano Clínica.",
  },
  {
    icon: <TrendingUp className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
    title: "Ganhe mais atendendo mais",
    description:
      "Sistema de moedas: cada validação gera receita. Faça upgrade e desbloqueie saques via Pix.",
  },
  {
    icon: <Users className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />,
    title: "Plano Clínica para equipes",
    description:
      "Convide até 4 nutricionistas parceiros, compartilhe a marca e gerencie tudo num só painel.",
  },
];

// Comparativo: diferenças de IA e moedas explícitas coluna por coluna.
interface PlanCard {
  name: string;
  price: string;
  tagline: string;
  coins: string;
  ai: string;
  perks: string[];
  highlight?: boolean;
  tier: string;
}

const planSummary: PlanCard[] = [
  {
    name: "Freemium",
    tier: "freemium",
    price: "Grátis",
    tagline: "Conhecer a plataforma",
    coins: "5 moedas (bônus único)",
    ai: "Sem IA — só visualização",
    perks: ["Feed de pedidos", "Sem saque"],
  },
  {
    name: "Basic",
    tier: "basic",
    price: "R$ 49,90/mês",
    tagline: "Primeiros atendimentos",
    coins: "20 moedas iniciais",
    ai: "5 correções de IA por dia",
    perks: ["R$ 15,00 por validação", "Saque via Pix"],
  },
  {
    name: "Premium",
    tier: "premium",
    price: "R$ 99,90/mês",
    tagline: "Escalando a carteira",
    coins: "120 moedas renovadas/mês",
    ai: "10 correções de IA por dia",
    perks: ["Leads exclusivos", "Assinatura com CRN", "Comissões 10%"],
    highlight: true,
  },
  {
    name: "Clínica",
    tier: "clinic",
    price: "R$ 199,90/mês",
    tagline: "Equipe + marca própria",
    coins: "Moedas ilimitadas",
    ai: "IA ilimitada (sem cap diário)",
    perks: ["White-label com logo", "Até 4 nutris", "Suporte prioritário"],
  },
];

export default function PlanosLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white py-24 px-4 text-center">
        <h1 className="text-5xl font-display font-extrabold mb-4">
          Nutr<span className="text-teal-200">IA</span>prova para Nutricionistas
        </h1>
        <p className="text-lg text-emerald-50/90 max-w-2xl mx-auto mb-8">
          Valide dietas com IA, gere PDFs profissionais e aumente sua receita com o sistema de
          moedas da nutrIAprova.
        </p>
        <button
          onClick={() => navigate("/auth?role=nutritionist&openRegister=true")}
          className="bg-teal-700 hover:bg-teal-600 text-white font-bold px-8 py-3 rounded-xl text-lg transition shadow-lg shadow-teal-900/30"
        >
          Começar Grátis
        </button>
        <p className="text-xs text-emerald-100/70 mt-4">
          Sem cartão para testar • Cancele quando quiser
        </p>
      </section>

      {/* ── Benefícios ───────────────────────────────────────────── */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <h2 className="text-3xl font-display font-bold text-center mb-12">
          Por que usar a nutrIAprova?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="flex gap-4 p-6 rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="shrink-0">{b.icon}</div>
              <div>
                <h3 className="font-display font-bold mb-1">{b.title}</h3>
                <p className="text-muted-foreground text-sm">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparativo de Planos ────────────────────────────────── */}
      <section className="bg-emerald-50/50 dark:bg-emerald-950/10 py-20 px-4 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-display font-bold mb-3">Planos e Preços</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Todas as diferenças de <strong>IA</strong> e <strong>moedas</strong> já aparecem em
              cada card — escolha o plano que encaixa no seu ritmo de atendimento.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {planSummary.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl p-5 bg-card border transition shadow-sm hover:shadow-md flex flex-col ${
                  p.highlight
                    ? "border-emerald-600 dark:border-emerald-400 border-2 shadow-lg"
                    : "border-border"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold uppercase px-3 py-1 rounded-full shadow">
                    Mais Popular
                  </span>
                )}
                <h3 className="font-display font-bold text-lg">{p.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{p.tagline}</p>
                <p className="text-emerald-700 dark:text-emerald-400 font-display font-bold text-xl mb-4">
                  {p.price}
                </p>

                {/* Destaque: Moedas + IA — as duas dimensões que o usuário compara */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start gap-2 text-xs">
                    <Coins className="h-3.5 w-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-foreground">{p.coins}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Zap className="h-3.5 w-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-foreground">{p.ai}</span>
                  </div>
                </div>

                <ul className="space-y-1.5 mb-4 flex-1">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate("/auth?role=nutritionist&openRegister=true")}
                  className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    p.highlight
                      ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                      : "border border-border hover:bg-accent"
                  }`}
                >
                  Escolher {p.name}
                </button>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => navigate("/auth?role=nutritionist&openRegister=true")}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-8 py-3 rounded-xl text-lg transition shadow"
            >
              Começar Agora
            </button>
          </div>
        </div>
      </section>

      {/* ── Métodos de Pagamento ─────────────────────────────────── */}
      <section className="py-16 px-4 max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-display font-bold mb-2">Métodos de Pagamento</h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Pague como preferir. Processamento criptografado, sem armazenar dados de cartão no servidor.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <div className="rounded-2xl border-2 border-emerald-600/30 dark:border-emerald-400/30 bg-card p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <QrCode className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <p className="font-display font-bold">Pix</p>
              <p className="text-xs text-muted-foreground">
                Aprovação em segundos. Ideal para pagamento recorrente mensal.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-teal-600/30 dark:border-teal-400/30 bg-card p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
              <CreditCard className="h-7 w-7 text-teal-700 dark:text-teal-300" />
            </div>
            <div>
              <p className="font-display font-bold">Cartão de crédito</p>
              <p className="text-xs text-muted-foreground">
                Visa, Mastercard, Elo e Amex. Cobrança automática todo mês.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
