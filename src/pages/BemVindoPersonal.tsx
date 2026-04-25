import { motion, type Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, CheckCircle2, ArrowRight, Leaf, Wallet, Users, Share2 } from "lucide-react";

// ── Helpers de animação ───────────────────────────────────────────────────────
// Tipagem explícita como Variants resolve o erro de tipo do Framer Motion
const fade = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { delay, duration: 0.45, ease: "easeOut" } },
});

const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.12 } },
};

// ── Componente ────────────────────────────────────────────────────────────────
export default function BemVindoPersonal() {
  const navigate  = useNavigate();
  const { profile } = useAuth();

  const steps = [
    {
      icon:  Share2,
      title: "Compartilhe seu link",
      desc:  "Envie seu link exclusivo para seus alunos nas redes sociais ou WhatsApp.",
    },
    {
      icon:  Users,
      title: "Alunos se cadastram",
      desc:  "Quando eles criam uma conta usando seu link, ficam vinculados a você.",
    },
    {
      icon:  Wallet,
      title: "Receba comissões",
      desc:  "A cada plano adquirido por um aluno seu, você ganha R$ 10,00.",
    },
  ];

  const nextSteps = [
    { done: true,  text: "Conta criada com sucesso" },
    { done: false, text: "Acesse seu Painel de Afiliado para ver seu link" },
    { done: false, text: "Compartilhe seu link com seus alunos" },
    { done: false, text: "Acompanhe seus ganhos e solicite saques" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <Leaf className="h-5 w-5 text-primary" />
          nutr<span className="text-primary">IA</span>prova
        </div>
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
          Bem-vindo(a), Personal!
        </Badge>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-14">
        {/* Hero */}
        <motion.div
          className="text-center mb-12"
          initial="hidden"
          animate="show"
          variants={stagger}
        >
          <motion.div variants={fade(0)}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl emerald-gradient mb-5">
              <Dumbbell className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>

          <motion.h1 variants={fade(0.1)} className="text-3xl md:text-4xl font-display font-bold mb-3">
            Bem-vindo(a) ao Programa de Afiliados{" "}
            <span className="text-gradient-emerald">nutrIAprova</span>
          </motion.h1>

          <motion.p variants={fade(0.2)} className="text-muted-foreground text-base max-w-xl mx-auto">
            Ganhe comissões indicando seus alunos para planos alimentares validados por nutricionistas.
          </motion.p>

          {profile?.full_name && (
            <motion.p variants={fade(0.3)} className="mt-3 text-sm font-medium text-primary">
              Olá, {profile.full_name.split(" ")[0]}! Sua conta foi criada com sucesso. 🎉
            </motion.p>
          )}
        </motion.div>

        {/* Como funciona */}
        <motion.section initial="hidden" animate="show" variants={stagger} className="mb-12">
          <motion.h2 variants={fade()} className="text-lg font-display font-semibold mb-5 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Como funciona o programa de afiliados
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  variants={fade()}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col items-center text-center"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold text-sm mb-1">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Próximos passos */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-10"
        >
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" /> Próximos Passos
          </h2>
          <ul className="space-y-3">
            {nextSteps.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  item.done ? "bg-primary text-primary-foreground" : "border-2 border-border"
                }`}>
                  {item.done && <CheckCircle2 className="h-3 w-3" />}
                </div>
                <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button
            className="flex-1 emerald-gradient text-primary-foreground gap-2 h-12 text-base"
            onClick={() => navigate("/personal-dashboard")}
          >
            Ir para o Painel de Afiliado <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 h-12"
            onClick={() => navigate("/configuracoes")}
          >
            Configurar Chave PIX
          </Button>
        </motion.div>
      </main>
    </div>
  );
}