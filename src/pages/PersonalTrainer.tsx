import { motion, type Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { setPendingSignup } from "@/lib/pendingSignup";
import { Button } from "@/components/ui/button";
import {
  Leaf, ArrowRight, DollarSign, Link2, BarChart3,
  CheckCircle2, Dumbbell, Users, Zap, Shield, Star,
  ChevronRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Variantes de animação tipadas
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp: Variants = {
  hidden:  { opacity: 0, y: 24 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay, ease: "easeOut" },
  }),
};

const stagger: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariant: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Dados estáticos
// ─────────────────────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    icon:  DollarSign,
    title: "R$ 10,00 por indicação paga",
    desc:  "Cada aluno que você indicar e efetuar o pagamento rende R$ 10,00 direto para você. Sem teto, sem burocracia.",
  },
  {
    icon:  Link2,
    title: "Link de afiliado único",
    desc:  "Receba um link personalizado com seu código. Compartilhe onde quiser: WhatsApp, Instagram, grupos de treino.",
  },
  {
    icon:  BarChart3,
    title: "Painel de análise de leads",
    desc:  "Acompanhe em tempo real: cliques, cadastros, conversões e comissões pendentes — tudo em um único lugar.",
  },
  {
    icon:  Shield,
    title: "Pagamento garantido",
    desc:  "Comissões processadas todo dia 10 via Pix. Histórico completo de transações disponível no painel.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Cadastre-se",        desc: "Crie sua conta como Personal Trainer em menos de 2 minutos." },
  { step: "02", title: "Receba seu link",     desc: "Um link exclusivo é gerado automaticamente com seu código de afiliado." },
  { step: "03", title: "Indique seus alunos", desc: "Compartilhe o link com sua base de alunos e seguidores." },
  { step: "04", title: "Ganhe por conversão", desc: "Cada pagamento confirmado gera R$ 10,00 de comissão para você." },
];

const TESTIMONIALS = [
  {
    name:  "Felipe A.",
    role:  "Personal Trainer — SP",
    text:  "Indiquei 12 alunos no primeiro mês e já recebi R$ 120. O produto vende sozinho porque a proposta é muito boa.",
    stars: 5,
  },
  {
    name:  "Rodrigo M.",
    role:  "Coach de Alta Performance — RJ",
    text:  "Meus alunos já vinham me pedindo indicação de nutricionista. Agora eu indico o nutrIAprova e ainda ganho comissão.",
    stars: 5,
  },
  {
    name:  "Fernanda C.",
    role:  "Personal Online — MG",
    text:  "O painel de leads é muito intuitivo. Consigo ver exatamente quantos cliques meu link recebeu e o que converteu.",
    stars: 5,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function PersonalTrainerLanding() {
  const navigate = useNavigate();

  /**
   * Redireciona para /auth forçando:
   *  - query param  role=personal_trainer  (lido pelo componente Auth para pré-selecionar o cargo)
   *  - state        { openRegister: true } (abre direto no formulário de cadastro)
   */
  const goSignup = () => {
    setPendingSignup({ role: "personal_trainer" });
    navigate("/auth?role=personal_trainer&openRegister=true", { state: { openRegister: true } });
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-background">

      {/* ══════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════ */}
      <motion.header
        initial={{ y: -56, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-6 py-4 border-b border-border/50
                   backdrop-blur-sm sticky top-0 z-50 bg-background/85"
      >
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => navigate("/")}
        >
          <Leaf className="h-5 w-5 text-primary" />
          <span className="font-display font-bold text-lg">
            nutr<span className="text-primary">IA</span>prova
          </span>
        </div>

        {/* CTA no header — mesmo goSignup */}
        <Button
          className="emerald-gradient text-primary-foreground h-9 px-5 text-sm"
          onClick={goSignup}
        >
          Quero ser parceiro
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </motion.header>

      <main className="flex-1">

        {/* ════════════════════════════════════════════════════════
            HERO
        ════════════════════════════════════════════════════════ */}
        <section className="relative flex flex-col items-center justify-center text-center
                            px-6 py-28 overflow-hidden min-h-[80vh]">
          {/* Blobs decorativos */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -left-32 top-0 h-[480px] w-[480px] rounded-full
                         bg-emerald-400/10 dark:bg-emerald-500/12 blur-[90px]"
              animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full
                         bg-teal-400/8 dark:bg-teal-400/10 blur-[100px]"
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />
          </div>

          <motion.div
            className="relative z-10 max-w-3xl mx-auto"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            {/* Badge */}
            <motion.div
              variants={fadeUp} custom={0}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6
                         border border-primary/30 bg-primary/8 text-primary text-sm font-medium"
            >
              <Dumbbell className="h-3.5 w-3.5" />
              Programa de Parceiros — Personal Trainers
            </motion.div>

            {/* Título */}
            <motion.h1
              variants={fadeUp} custom={0.05}
              className="text-5xl md:text-6xl font-display font-bold leading-tight mb-5"
            >
              Transforme sua{" "}
              <span className="text-gradient-emerald">rede de alunos</span>
              {" "}em uma{" "}
              <span className="text-gradient-emerald">renda recorrente</span>
            </motion.h1>

            {/* Subtítulo */}
            <motion.p
              variants={fadeUp} custom={0.1}
              className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10"
            >
              Indique o nutrIAprova para seus alunos e ganhe{" "}
              <strong className="text-foreground font-semibold">R$ 10,00 por cada indicação paga</strong>.
              {" "}Sem mensalidades, sem burocracia. Você indica — nós cuidamos do resto.
            </motion.p>

            {/* CTAs do Hero */}
            <motion.div
              variants={fadeUp} custom={0.15}
              className="flex flex-wrap gap-3 justify-center"
            >
              {/* ▸ Redireciona para /auth?role=personal_trainer + openRegister: true */}
              <Button
                size="lg"
                className="emerald-gradient text-primary-foreground px-8 h-12 text-base"
                onClick={goSignup}
              >
                Quero ser parceiro agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-12 text-base border-border hover:bg-muted/40"
                onClick={() => {
                  document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Ver como funciona
              </Button>
            </motion.div>

            {/* Mini-prova social */}
            <motion.div
              variants={fadeUp} custom={0.25}
              className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Cadastro gratuito
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Pagamento todo dia 10 via Pix
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Sem limite de comissões
              </span>
            </motion.div>
          </motion.div>
        </section>

        {/* ════════════════════════════════════════════════════════
            BENEFÍCIOS
        ════════════════════════════════════════════════════════ */}
        <section className="px-6 py-20 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="text-center mb-12"
            >
              <motion.h2 variants={cardVariant} className="text-3xl md:text-4xl font-display font-bold mb-3">
                O que você ganha como{" "}
                <span className="text-gradient-emerald">parceiro</span>
              </motion.h2>
              <motion.p variants={cardVariant} className="text-muted-foreground max-w-xl mx-auto">
                Um programa pensado para Personal Trainers que querem agregar valor
                à sua oferta e gerar renda passiva.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 gap-5"
            >
              {BENEFITS.map((b, i) => {
                const Icon = b.icon;
                return (
                  <motion.div
                    key={i} variants={cardVariant}
                    className="rounded-2xl border border-border bg-card p-6 flex gap-4"
                  >
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl emerald-gradient
                                    flex items-center justify-center mt-0.5">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold mb-1">{b.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            COMO FUNCIONA
        ════════════════════════════════════════════════════════ */}
        <section id="como-funciona" className="px-6 py-20">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="text-center mb-14"
            >
              <motion.h2 variants={cardVariant} className="text-3xl md:text-4xl font-display font-bold mb-3">
                Como funciona em{" "}
                <span className="text-gradient-emerald">4 passos</span>
              </motion.h2>
              <motion.p variants={cardVariant} className="text-muted-foreground">
                Simples, rápido e sem burocracia.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6"
            >
              {HOW_IT_WORKS.map((s, i) => (
                <motion.div key={i} variants={cardVariant} className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full emerald-gradient
                                  flex items-center justify-center mb-4 shadow-lg">
                    <span className="font-display font-bold text-primary-foreground text-lg">{s.step}</span>
                  </div>
                  <h3 className="font-display font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CALCULADORA DE GANHOS
        ════════════════════════════════════════════════════════ */}
        <section className="px-6 py-20 bg-muted/30">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="text-center mb-10"
            >
              <motion.h2 variants={cardVariant} className="text-3xl md:text-4xl font-display font-bold mb-3">
                Quanto você pode <span className="text-gradient-emerald">ganhar</span>?
              </motion.h2>
              <motion.p variants={cardVariant} className="text-muted-foreground">
                Veja o potencial de ganho dependendo do tamanho da sua base.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {[
                { alunos: 10,  total: 100,  perfil: "Personal iniciante" },
                { alunos: 50,  total: 500,  perfil: "Personal estabelecido" },
                { alunos: 150, total: 1500, perfil: "Coach com grande base" },
              ].map((row, i) => (
                <motion.div
                  key={i} variants={cardVariant}
                  className="rounded-2xl border border-border bg-card p-6 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-3 text-muted-foreground text-sm">
                    <Users className="h-4 w-4" />
                    {row.alunos} alunos indicados
                  </div>
                  <p className="text-4xl font-display font-bold text-primary mb-1">
                    R$ {row.total.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.perfil}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
              className="text-center text-xs text-muted-foreground mt-4"
            >
              * Cálculo baseado em R$ 10,00 por indicação paga. Sem limite máximo de indicações.
            </motion.p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            DEPOIMENTOS
        ════════════════════════════════════════════════════════ */}
        <section className="px-6 py-20">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={0}
              className="text-3xl md:text-4xl font-display font-bold text-center mb-12"
            >
              O que nossos <span className="text-gradient-emerald">parceiros dizem</span>
            </motion.h2>
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {TESTIMONIALS.map((t, i) => (
                <motion.div key={i} variants={cardVariant} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: t.stars }).map((_, s) => (
                      <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{t.text}"</p>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            DIFERENCIAIS RÁPIDOS
        ════════════════════════════════════════════════════════ */}
        <section className="px-6 py-16 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
            >
              {[
                { icon: Zap,        title: "Aprovação instantânea", desc: "Seu link de afiliado é gerado logo após o cadastro. Zero espera." },
                { icon: BarChart3,  title: "Painel completo",       desc: "Visualize cliques, leads, conversões e histórico de comissões em tempo real." },
                { icon: DollarSign, title: "Saque fácil",           desc: "Pix automático no dia 10 de cada mês. Mínimo de R$ 50 para saque." },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i} variants={cardVariant}
                    className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center text-center"
                  >
                    <div className="w-10 h-10 rounded-xl emerald-gradient flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h3 className="font-display font-semibold text-sm mb-1">{f.title}</h3>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            CTA FINAL
        ════════════════════════════════════════════════════════ */}
        <section className="relative px-6 py-24 text-center overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                         h-[460px] w-[800px] rounded-full
                         bg-emerald-400/8 dark:bg-emerald-500/10 blur-[110px]"
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="relative z-10 max-w-2xl mx-auto"
          >
            <motion.div
              variants={fadeUp} custom={0}
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6
                         border border-primary/30 bg-primary/8 text-primary text-sm font-medium"
            >
              <Dumbbell className="h-3.5 w-3.5" />
              Cadastro 100% gratuito
            </motion.div>

            <motion.h2
              variants={fadeUp} custom={0.05}
              className="text-4xl md:text-5xl font-display font-bold mb-4"
            >
              Pronto para <span className="text-gradient-emerald">ser parceiro</span>?
            </motion.h2>

            <motion.p variants={fadeUp} custom={0.1} className="text-muted-foreground mb-8 text-lg">
              Crie sua conta agora, receba seu link de afiliado e comece a
              indicar ainda hoje. R$ 10,00 por aluno pago — sem limite.
            </motion.p>

            {/* ▸ CTA final — mesmo goSignup: /auth?role=personal_trainer + { openRegister: true } */}
            <motion.div variants={fadeUp} custom={0.15}>
              <Button
                size="lg"
                className="emerald-gradient text-primary-foreground px-10 h-14 text-lg shadow-lg"
                onClick={goSignup}
              >
                Quero ser parceiro
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>

            <motion.p variants={fadeUp} custom={0.2} className="mt-5 text-xs text-muted-foreground">
              Ao se cadastrar você concorda com nossos{" "}
              <span className="underline cursor-pointer">Termos de Afiliados</span>.
            </motion.p>
          </motion.div>
        </section>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground border-t border-border/50">
        © 2026 nutrIAprova — Programa de Parceiros Personal Trainers — LGPD
      </footer>
    </div>
  );
}