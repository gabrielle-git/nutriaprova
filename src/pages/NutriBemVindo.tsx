import { motion, type Variants } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins, Shield, CheckCircle2, Zap, ArrowRight,
  Leaf, BarChart3, Lock, Gift, Wallet, Clock,
} from "lucide-react";

// ── Helpers de animação ────────────────────────────────────────────────────
const fade = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { delay, duration: 0.45, ease: "easeOut" } },
});

const stagger: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.12 } },
};

// ── Conteúdo estático ──────────────────────────────────────────────────────
const COIN_STEPS = [
  {
    icon:  Gift,
    title: "5 Moedas de Boas-Vindas",
    desc:  "Você começa com 5 moedas grátis. Cada moeda = 1 job de validação que você pode aceitar.",
    color: "text-primary bg-primary/10",
  },
  {
    icon:  Shield,
    title: "Valide e Ganhe R$ 15,00",
    desc:  "Revise e valide a dieta gerada pela IA com seu CRN. O cliente paga e você recebe R$ 15,00 líquidos por validação.",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
  },
  {
    icon:  Wallet,
    title: "Saque ou Reinvista",
    desc:  "No Freemium, seu saldo fica disponível como crédito para upgrade. Em planos pagos, você saca quando quiser.",
    color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
  },
  {
    icon:  Zap,
    title: "IA Acelera Seu Trabalho",
    desc:  "A IA gera o rascunho do cardápio. Você confere, ajusta e assina. Simples e rápido.",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
  },
];

const PLAN_COMPARE = [
  { name: "Freemium", coins: "5",   ia: "—",         saque: "🔒 Crédito p/ upgrade", price: "Grátis"       },
  { name: "Basic",    coins: "20",  ia: "5/dia",      saque: "✅ Disponível",         price: "R$ 49,90/mês" },
  { name: "Premium",  coins: "120", ia: "10/dia",     saque: "✅ Disponível",         price: "R$ 99,90/mês" },
  { name: "Clínica",  coins: "∞",   ia: "Ilimitado",  saque: "✅ Disponível",         price: "R$ 199,90/mês"},
];

// ── Componente ─────────────────────────────────────────────────────────────
export default function NutriBemVindo() {
  const navigate    = useNavigate();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <Leaf className="h-5 w-5 text-primary" />
          nutr<span className="text-primary">IA</span>prova
        </div>
        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
          Bem-vindo(a), Nutricionista!
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
              <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>

          <motion.h1
            variants={fade(0.1)}
            className="text-3xl md:text-4xl font-display font-bold mb-3"
          >
            Bem-vindo(a) ao ecossistema{" "}
            <span className="text-gradient-emerald">nutrIAprova</span>
          </motion.h1>

          <motion.p variants={fade(0.2)} className="text-muted-foreground text-base max-w-xl mx-auto">
            Antes de começar, entenda como funciona o sistema de moedas e validações —
            o coração da plataforma.
          </motion.p>

          {profile?.full_name && (
            <motion.p variants={fade(0.3)} className="mt-3 text-sm font-medium text-primary">
              Olá, {profile.full_name.split(" ")[0]}! Sua conta foi criada com sucesso. 🎉
            </motion.p>
          )}
        </motion.div>

        {/* Moedas */}
        <motion.section initial="hidden" animate="show" variants={stagger} className="mb-12">
          <motion.h2
            variants={fade()}
            className="text-lg font-display font-semibold mb-5 flex items-center gap-2"
          >
            <Coins className="h-5 w-5 text-primary" />
            Como funcionam as Moedas e Validações
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COIN_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={i}
                  variants={fade()}
                  className="rounded-xl border border-border bg-card p-5 flex gap-4"
                >
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${step.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Aviso CRN */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 p-4 mb-10 flex gap-3"
        >
          <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              CRN bloqueado para edição
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Após o cadastro, o CRN fica em modo leitura para garantir integridade das
              validações. Ele aparece na sua assinatura digital e pode ser consultado
              nas configurações.
            </p>
          </div>
        </motion.div>

        {/* Tabela de planos */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mb-12"
        >
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Visão Rápida dos Planos
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Plano</th>
                  <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Moedas</th>
                  <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">IA/dia</th>
                  <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Saque</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Preço</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_COMPARE.map((p, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-center text-primary font-semibold">{p.coins}</td>
                    <td className="px-4 py-3 text-center">{p.ia}</td>
                    <td className="px-4 py-3 text-center text-xs">{p.saque}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Você começa no Freemium. Faça upgrade quando quiser em{" "}
            <button onClick={() => navigate("/planos")} className="text-primary underline underline-offset-2">
              /planos
            </button>.
          </p>
        </motion.section>

        {/* Próximos passos */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mb-10"
        >
          <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Próximos Passos
          </h2>
          <ul className="space-y-3">
            {[
              { done: true,  text: "Conta criada com sucesso" },
              { done: false, text: "Complete seu perfil e adicione foto (aumenta conversão em 3×)" },
              { done: false, text: "Cadastre sua chave PIX para receber pagamentos" },
              { done: false, text: "Aceite seu primeiro job de validação e ganhe R$ 15,00" },
              { done: false, text: "Faça upgrade para liberar IA e dashboard avançado" },
            ].map((item, i) => (
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
            onClick={() => navigate("/")}
          >
            Ir para o Painel <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="flex-1 gap-2 h-12" onClick={() => navigate("/cadastro-pix")}>
            <Wallet className="h-4 w-4" /> Cadastrar Chave PIX
          </Button>
          <Button variant="ghost" className="flex-1 gap-2 h-12" onClick={() => navigate("/planos")}>
            Ver Planos
          </Button>
        </motion.div>
      </main>
    </div>
  );
}