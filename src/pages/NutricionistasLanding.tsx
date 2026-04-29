import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Leaf,
  ArrowRight,
  Shield,
  Clock,
  DollarSign,
  BarChart3,
  Sparkles,
  Instagram,
  Linkedin,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { setPendingSignup } from "@/lib/pendingSignup";
import { cn } from "@/lib/utils";

const viewportOnce = { once: true as const, amount: 0.15 as const, margin: "-0px 0px -80px 0px" as const };

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.11, delayChildren: 0.06 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.52, ease: [0.16, 1, 0.3, 1] },
  },
};

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 36 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1] },
  },
};

const BENEFITS = [
  { icon: DollarSign, title: "R$ 15,00 por Validação", desc: "O cliente paga R$ 39,90. Você recebe R$ 15,00 líquidos por cada plano validado." },
  { icon: Clock, title: "Flexibilidade Total", desc: "Aceite jobs quando quiser. Trabalhe de qualquer lugar, no seu ritmo." },
  { icon: BarChart3, title: "Dashboard Inteligente", desc: "Acompanhe seus ganhos, validações e desempenho em tempo real." },
  { icon: Shield, title: "Respaldo Profissional", desc: "Seu CRN garante a credibilidade. A IA faz o trabalho pesado." },
];

/** Ilustração editorial — perfis fictícios para a landing pública. */
const SHOWCASE_NUTRITIONISTS = [
  { name: "Dra. Ana Paula Costa", crn: "CRN-3 12.345", focus: "Emagrecimento e reeducação alimentar" },
  { name: "Dr. Ricardo Mendes", crn: "CRN-3 23.456", focus: "Nutrição esportiva e performance" },
  { name: "Dra. Mariana Duarte", crn: "CRN-3 34.567", focus: "Doenças crônicas e diabetes" },
  { name: "Dr. Felipe Albuquerque", crn: "CRN-3 45.678", focus: "Nutrição clínica e infantil" },
];

function initialsFromName(fullName: string) {
  const parts = fullName.replace(/^Dra\.?\s+|^Dr\.?\s+/i, "").trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts[parts.length - 1]?.[0] ?? "";
  return `${a}${b}`.toUpperCase();
}

const FOOTER_STATS = [
  { value: "5", label: "moedas para novos nutricionistas" },
  { value: "R$ 15", label: "por validação aprovada" },
  { value: "3", label: "frentes: cliente, nutri e personal" },
] as const;

/** Links sociais — `variant: primary` = botão em gradiente (referência visual WhatsApp). */
const FOOTER_SOCIAL = [
  { href: "#", icon: MessageCircle, label: "WhatsApp", variant: "primary" as const },
  { href: "#", icon: Instagram, label: "Instagram", variant: "outline" as const },
  { href: "#", icon: Linkedin, label: "LinkedIn", variant: "outline" as const },
  { href: "#", icon: BookOpen, label: "Blog", variant: "outline" as const },
] as const;

function HeroDashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-background to-accent/[0.08] p-6 shadow-xl shadow-primary/10 ring-1 ring-primary/10">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" aria-hidden />
      <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl" aria-hidden />
      <div className="relative space-y-4">
        <div className="flex items-center gap-3 border-b border-border/60 pb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-2.5 w-4/5 max-w-[180px] rounded-full bg-muted" />
            <div className="h-2 w-3/5 max-w-[120px] rounded-full bg-muted/70" />
          </div>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm backdrop-blur-sm">
          <div className="mb-3 flex gap-2">
            <div className="h-2 flex-1 rounded-full bg-primary/20" />
            <div className="h-2 flex-1 rounded-full bg-muted/80" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-16 flex-col justify-end rounded-lg bg-primary/8 p-2">
                <div className="h-6 w-full rounded bg-primary/15" />
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-2 w-full rounded bg-muted/60" />
            <div className="h-2 w-[88%] rounded bg-muted/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NutricionistasLanding() {
  const navigate = useNavigate();

  const goSignup = () => {
    setPendingSignup({ role: "nutritionist" });
    navigate("/auth?role=nutritionist&openRegister=true", { state: { openRegister: true } });
  };

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        className="flex items-center justify-between border-b border-border/50 px-6 py-4"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="flex cursor-pointer items-center gap-2"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && navigate("/")}
        >
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-display text-xl font-bold">
            Nutr<span className="text-brand-animated">IAprova</span>
          </span>
          <span className="badge-live text-xs min-h-[1em]" aria-hidden />
        </div>
        <Button variant="outline" onClick={() => navigate("/auth")}>
          Entrar
        </Button>
      </motion.header>

      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
        <motion.section
          className="mb-16 md:mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
            <div className="space-y-6 text-center lg:text-left">
              <motion.div variants={staggerItem} className="flex justify-center lg:justify-start">
                <Badge className="emerald-gradient text-primary-foreground">Para Nutricionistas</Badge>
              </motion.div>
              <motion.h1
                variants={staggerItem}
                className="font-display text-3xl font-bold md:text-5xl lg:text-6xl"
              >
                Ganhe <span className="text-gradient-emerald">R$ 15,00</span> por validação
              </motion.h1>
              <motion.p
                variants={staggerItem}
                className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg lg:mx-0"
              >
                O cliente paga R$ 39,90 por um plano alimentar validado. Você recebe R$ 15,00 líquidos por cada
                validação usando seu CRN. Aceitar um job custa apenas 1 Moeda.
              </motion.p>
              <motion.div variants={staggerItem} className="flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Button size="lg" className="emerald-gradient px-8 text-primary-foreground" onClick={goSignup}>
                  Criar Minha Conta como Nutricionista <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="border-primary/30" onClick={() => navigate("/planos")}>
                  Ver planos
                </Button>
              </motion.div>
            </div>
            <motion.div
              variants={staggerItem}
              className="flex justify-center lg:justify-end"
              whileHover={{ scale: 1.02, transition: { type: "spring", stiffness: 280, damping: 22 } }}
            >
              <HeroDashboardMockup />
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          className="mb-16"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={sectionReveal}
        >
          <Card className="glass-card mx-auto max-w-2xl border-primary/20 transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="p-6">
              <h3 className="mb-4 text-center font-display font-bold">Como funciona o Split Financeiro</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-accent/50 p-4 transition-transform duration-300 hover:-translate-y-0.5">
                  <p className="font-display text-2xl font-bold">R$ 39,90</p>
                  <p className="text-xs text-muted-foreground">Cliente paga</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-4 transition-transform duration-300 hover:-translate-y-0.5">
                  <p className="font-display text-2xl font-bold text-primary">R$ 15,00</p>
                  <p className="text-xs text-muted-foreground">Você recebe</p>
                </div>
                <div className="rounded-lg bg-muted p-4 transition-transform duration-300 hover:-translate-y-0.5">
                  <p className="font-display text-2xl font-bold text-muted-foreground">1 Moeda</p>
                  <p className="text-xs text-muted-foreground">Custo por job</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        <motion.section
          className="mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <motion.div
                key={b.title}
                variants={staggerItem}
                whileHover={{
                  y: -6,
                  scale: 1.02,
                  transition: { type: "spring", stiffness: 400, damping: 24 },
                }}
                className="h-full"
              >
                <Card className="glass-card h-full cursor-default border-border/60 transition-shadow duration-300 hover:shadow-md hover:shadow-primary/10">
                  <CardContent className="pt-6">
                    <b.icon className="mb-3 h-8 w-8 text-primary" />
                    <h3 className="mb-1 font-display font-semibold">{b.title}</h3>
                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mb-20"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          <motion.h2
            variants={staggerItem}
            className="mb-2 text-center font-display text-3xl font-bold"
          >
            Nossos Nutricionistas
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground"
          >
            Profissionais que validam planos com segurança, registro no CRN e o apoio da IA — com a mesma experiência que você pode ter na plataforma.
          </motion.p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SHOWCASE_NUTRITIONISTS.map((n) => (
              <motion.div
                key={n.crn}
                variants={staggerItem}
                whileHover={{ y: -4, transition: { type: "spring", stiffness: 320, damping: 22 } }}
                className="h-full"
              >
                <Card className="glass-card h-full border-border/60 transition-shadow duration-300 hover:shadow-md hover:shadow-primary/10">
                  <CardContent className="flex flex-col gap-4 pt-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary">
                        {initialsFromName(n.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-semibold leading-tight">{n.name}</p>
                        <p className="text-[11px] text-muted-foreground">{n.crn}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.focus}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          className="mt-20 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
        >
          <motion.h2 variants={staggerItem} className="mb-10 font-display text-3xl font-bold">
            Como Funciona
          </motion.h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { step: "1", title: "Cadastre-se com CRN", desc: "Informe seu registro profissional e crie sua conta." },
              { step: "2", title: "Escolha seu plano", desc: "Abra a página de planos para comparar assinaturas ou comece pelo Freemium, sem cartão." },
              { step: "3", title: "Valide e Ganhe R$ 15,00", desc: "Aceite jobs, revise o plano IA e aprove. Cada validação rende R$ 15,00 líquidos." },
            ].map((s) => (
              <motion.div
                key={s.step}
                variants={staggerItem}
                className="flex flex-col items-center"
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full emerald-gradient font-display text-lg font-bold text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mb-1 font-display font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div variants={staggerItem} className="mt-10">
            <Button size="lg" className="emerald-gradient px-8 text-primary-foreground" onClick={goSignup}>
              Criar Minha Conta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </motion.section>
      </main>

      <footer className="relative overflow-hidden border-t border-primary/10 bg-gradient-to-br from-primary/[0.09] via-cyan-500/[0.04] to-background pb-12 pt-14 md:pt-16">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={sectionReveal}
            className={cn(
              "rounded-3xl border border-primary/12 bg-card/85 p-8 shadow-xl shadow-primary/[0.07] backdrop-blur-md",
              "md:p-10",
            )}
          >
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-14 lg:items-center">
              <div>
                <Badge className="mb-4 emerald-gradient text-primary-foreground shadow-sm shadow-primary/20">
                  Sobre nós
                </Badge>
                <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
                  Um ecossistema para unir IA, nutrição e performance
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  Conectamos clientes, nutricionistas e personal trainers em um fluxo único: planos com IA, validação
                  profissional com CRN e acompanhamento que gera resultado — com transparência e foco em performance.
                </p>
                <p className="mt-6 text-xs font-medium uppercase tracking-wider text-primary/90">Conecte-se conosco</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {FOOTER_SOCIAL.map(({ href, icon: Icon, label, variant }) => (
                    <motion.a
                      key={label}
                      href={href}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 24 }}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
                        variant === "primary"
                          ? "emerald-gradient text-primary-foreground shadow-md shadow-primary/25"
                          : "border border-border/80 bg-background/60 text-foreground hover:border-primary/35 hover:bg-primary/[0.06]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          variant === "primary" ? "text-primary-foreground" : "text-primary",
                        )}
                        strokeWidth={2}
                      />
                      {label}
                    </motion.a>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
                {FOOTER_STATS.map((s) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={viewportOnce}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "flex flex-col justify-center rounded-2xl border border-primary/10 bg-background/70 px-4 py-5 text-center shadow-sm",
                      "backdrop-blur-sm",
                    )}
                  >
                    <p className="font-display text-2xl font-bold text-primary md:text-3xl tabular-nums">{s.value}</p>
                    <p className="mt-1 text-[11px] font-medium leading-snug text-muted-foreground sm:text-xs">{s.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            © 2026 nutrIAprova — Dados protegidos conforme LGPD
          </p>
        </div>
      </footer>
    </div>
  );
}
