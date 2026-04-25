import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, ArrowRight, Coins, CheckCircle2, BarChart3, Shield, Clock, DollarSign, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { setPendingSignup } from "@/lib/pendingSignup";

const MONTHLY_TIERS = [
  {
    name: "Plano Básico",
    coins: 50,
    price: "R$ 49,90",
    period: "/mês",
    perValidation: "R$ 1,00",
    earning: "R$ 15,00 líquidos por validação",
    popular: true,
  },
  {
    name: "Plano Pro",
    coins: 120,
    price: "R$ 99,90",
    period: "/mês",
    perValidation: "R$ 0,83",
    earning: "R$ 15,00 líquidos por validação",
    popular: false,
  },
  {
    name: "Plano Clínica",
    coins: 300,
    price: "R$ 199,90",
    period: "/mês",
    perValidation: "R$ 0,67",
    earning: "R$ 15,00 líquidos por validação",
    popular: false,
  },
];

const ANNUAL_TIERS = [
  {
    name: "Básico Anual",
    coins: 50,
    price: "R$ 39,92",
    period: "/mês",
    totalPrice: "R$ 479,00/ano",
    perValidation: "R$ 0,80",
    earning: "R$ 15,00 líquidos por validação",
    popular: true,
    badge: "2 MESES GRÁTIS",
    subtitle: "50 moedas/mês • Cobrado mensalmente",
  },
  {
    name: "Pro Anual",
    coins: 120,
    price: "R$ 79,92",
    period: "/mês",
    totalPrice: "R$ 959,00/ano",
    perValidation: "R$ 0,67",
    earning: "R$ 15,00 líquidos por validação",
    popular: false,
    badge: "20% OFF",
    subtitle: "120 moedas/mês • Cobrado mensalmente",
  },
  {
    name: "Clínica Anual",
    coins: 300,
    price: "R$ 159,92",
    period: "/mês",
    totalPrice: "R$ 1.919,00/ano",
    perValidation: "R$ 0,53",
    earning: "R$ 15,00 líquidos por validação",
    popular: false,
    badge: "20% OFF",
    subtitle: "300 moedas/mês • Cobrado mensalmente",
  },
];

const BENEFITS = [
  { icon: DollarSign, title: "R$ 15,00 por Validação", desc: "O cliente paga R$ 39,90. Você recebe R$ 15,00 líquidos por cada plano validado." },
  { icon: Clock, title: "Flexibilidade Total", desc: "Aceite jobs quando quiser. Trabalhe de qualquer lugar, no seu ritmo." },
  { icon: BarChart3, title: "Dashboard Inteligente", desc: "Acompanhe seus ganhos, validações e desempenho em tempo real." },
  { icon: Shield, title: "Respaldo Profissional", desc: "Seu CRN garante a credibilidade. A IA faz o trabalho pesado." },
];

export default function NutricionistasLanding() {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const tiers = billingCycle === "monthly" ? MONTHLY_TIERS : ANNUAL_TIERS;

  /**
   * Todos os CTAs de cadastro da página levam para /auth?role=nutritionist
   * com state { openRegister: true } para abrir diretamente o formulário de cadastro
   * com o perfil "Nutri" pré-selecionado.
   */
  const goSignup = () => {
    setPendingSignup({ role: "nutritionist" });
    navigate("/auth?role=nutritionist&openRegister=true", { state: { openRegister: true } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-display font-bold text-xl">Nutr<span className="text-primary">IA</span>prova</span>
        </div>
        {/* Botão de login no header permanece como login simples */}
        <Button variant="outline" onClick={() => navigate("/auth")}>Entrar</Button>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <Badge className="mb-4 emerald-gradient text-primary-foreground">Para Nutricionistas</Badge>
          <h1 className="text-3xl md:text-6xl font-display font-bold mb-4">
            Ganhe <span className="text-gradient-emerald">R$ 15,00</span> por validação
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            O cliente paga R$ 39,90 por um plano alimentar validado. Você recebe R$ 15,00 líquidos por cada validação usando seu CRN. Aceitar um job custa apenas 1 Moeda.
          </p>
          {/* CTA principal do hero */}
          <Button size="lg" className="mt-8 emerald-gradient text-primary-foreground px-8" onClick={goSignup}>
            Criar Minha Conta como Nutricionista <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>

        {/* Financial split */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-16">
          <Card className="glass-card border-primary/20 max-w-2xl mx-auto">
            <CardContent className="p-6">
              <h3 className="font-display font-bold text-center mb-4">Como funciona o Split Financeiro</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-accent/50 p-4">
                  <p className="text-2xl font-display font-bold">R$ 39,90</p>
                  <p className="text-xs text-muted-foreground">Cliente paga</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-4">
                  <p className="text-2xl font-display font-bold text-primary">R$ 15,00</p>
                  <p className="text-xs text-muted-foreground">Você recebe</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-2xl font-display font-bold text-muted-foreground">1 Moeda</p>
                  <p className="text-xs text-muted-foreground">Custo por job</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Benefits */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {BENEFITS.map((b) => (
            <Card key={b.title} className="glass-card">
              <CardContent className="pt-6">
                <b.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-display font-semibold mb-1">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Pricing */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-3xl font-display font-bold text-center mb-2">Pacotes de Moedas</h2>
          <p className="text-muted-foreground text-center mb-6">Compre moedas para aceitar jobs. Cada job aceito custa 1 Moeda.</p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "emerald-gradient text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all relative ${
                billingCycle === "annual"
                  ? "emerald-gradient text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              Anual
              <span className="absolute -top-2 -right-2 text-[10px] bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full font-bold">
                -20%
              </span>
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <Card key={tier.name} className={`glass-card relative ${tier.popular ? "border-primary ring-2 ring-primary/20" : ""}`}>
                {tier.popular && billingCycle === "monthly" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="emerald-gradient text-primary-foreground">Mais Popular</Badge>
                  </div>
                )}
                {"badge" in tier && (tier as any).badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-destructive text-destructive-foreground animate-pulse">
                      🔥 {(tier as any).badge}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="font-display">{tier.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-4xl font-display font-bold">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </div>
                   {"subtitle" in tier && (
                     <p className="text-xs text-primary font-semibold mt-1">{(tier as any).subtitle}</p>
                   )}
                   {"totalPrice" in tier && (
                     <p className="text-[10px] text-muted-foreground mt-0.5">Total: {(tier as any).totalPrice}</p>
                   )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span><strong>{tier.coins} moedas</strong> incluídas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{tier.perValidation} por moeda</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="font-semibold text-primary">{tier.earning}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Dashboard completo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>Saque disponível</span>
                    </div>
                  </div>
                  {/* ▸ CTA de cada plano → /auth?role=nutritionist + openRegister: true */}
                  <Button
                    className={`w-full ${tier.popular ? "emerald-gradient text-primary-foreground" : ""}`}
                    variant={tier.popular ? "default" : "outline"}
                    onClick={goSignup}
                  >
                    Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-20 text-center">
          <h2 className="text-3xl font-display font-bold mb-10">Como Funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Cadastre-se com CRN", desc: "Informe seu registro profissional e crie sua conta." },
              { step: "2", title: "Compre Moedas", desc: "Adquira créditos (Plano Básico: 50 moedas por R$ 49,90)." },
              { step: "3", title: "Valide e Ganhe R$ 15,00", desc: "Aceite jobs, revise o plano IA e aprove. Cada validação rende R$ 15,00 líquidos." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full emerald-gradient flex items-center justify-center text-primary-foreground font-display font-bold text-lg mb-4">{s.step}</div>
                <h3 className="font-display font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* ▸ CTA final → /auth?role=nutritionist + openRegister: true */}
          <Button size="lg" className="mt-10 emerald-gradient text-primary-foreground px-8" onClick={goSignup}>
            Criar Minha Conta <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </main>

      <footer className="px-6 py-4 text-center text-xs text-muted-foreground border-t border-border/50">
        © 2026 nutrIAprova — Dados protegidos conforme LGPD
      </footer>
    </div>
  );
}