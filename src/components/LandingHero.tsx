import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Leaf, ArrowRight, Shield, Sparkles, Star,
  HeartPulse, Apple, Moon, Sun, Dumbbell, BookOpen, LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import BiotipoSimulator from "./BiotipoSimulator";
import { useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Contador animado
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const variants: Variants = {
    hidden:  { filter: "blur(6px)", opacity: 0 },
    visible: { filter: "blur(0px)", opacity: 1 },
  };
  return (
    <motion.span
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={variants}
      transition={{ duration: 0.9 }}
    >
      {target.toLocaleString("pt-BR")}
      {suffix}
    </motion.span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Partículas flutuantes
// ─────────────────────────────────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id:       i,
  size:     6 + (i % 4) * 4,
  x:        3 + (i * 31 + 7) % 94,
  delay:    (i * 0.28) % 3.5,
  duration: 3 + (i % 4) * 1,
  drift:    -10 + (i % 7) * 3,
}));

function Particles({ isDark }: { isDark: boolean }) {
  const peakOpacity                      = isDark ? 0.50 : 0.60;
  const opacity: [number, number, number] = [0, peakOpacity, 0];
  const color = isDark ? "rgb(52, 211, 153)" : "rgb(5, 150, 105)";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full border border-emerald-400/25"
          style={{
            width:           p.size,
            height:          p.size,
            left:            `${p.x}%`,
            bottom:          "-24px",
            backgroundColor: color,
          }}
          animate={{
            y:       [0, -(340 + p.id * 14)],
            x:       [0, p.drift, -p.drift, 0],
            opacity,
            scale:   [0.5, 1.1, 0.7],
          }}
          transition={{
            duration: p.duration,
            delay:    p.delay,
            repeat:   Infinity,
            ease:     "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Blobs radiais de fundo
// ─────────────────────────────────────────────────────────────────────────────
function RadialBlobs({ isDark }: { isDark: boolean }) {
  const left   = isDark ? "rgba(52, 211, 153, 0.20)"  : "rgba(16, 185, 129, 0.30)";
  const right  = isDark ? "rgba(20, 184, 166, 0.16)"  : "rgba(5, 150, 105, 0.25)";
  const center = isDark ? "rgba(110, 231, 183, 0.14)" : "rgba(52, 211, 153, 0.30)";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-40 top-10 h-[520px] w-[520px] rounded-full blur-[90px]"
        style={{ backgroundColor: left }}
        animate={{ scale: [1, 1.15, 1], x: [0, 24, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-40 top-32 h-[440px] w-[440px] rounded-full blur-[100px]"
        style={{ backgroundColor: right }}
        animate={{ scale: [1, 1.2, 1], x: [0, -20, 0], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2
                   h-[300px] w-[600px] rounded-full blur-[80px]"
        style={{ backgroundColor: center }}
        animate={{ scaleX: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
    </div>
  );
}

// Destinos do hero — fluxo manual e previsível.
// A Home NUNCA grava nada em localStorage. Quem decide o que fazer é o /auth
// (lendo ?role=) ou as landings dedicadas (/para-nutricionistas, /personal-trainer).
const CLIENT_AUTH_PATH      = "/auth?role=client";
const NUTRI_LANDING_PATH    = "/para-nutricionistas";
const PERSONAL_LANDING_PATH = "/personal-trainer";

/** Conteúdo abaixo do dobra: simulador, depoimentos, features, CTA e rodapé (usado em Index). */
export function LandingHomeContinued() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <>
      <section className="relative px-6 py-16 bg-muted/30 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-0 -translate-x-1/2 h-48 w-[700px]
                       rounded-full bg-primary/5 blur-[60px]"
          />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-display font-bold mb-3">
              Simule seu <span className="text-gradient-emerald">biótipo</span>
            </h2>
            <p className="text-muted-foreground">Descubra seu perfil metabólico antes mesmo de começar</p>
          </div>
          <BiotipoSimulator />
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-display font-bold mb-10">
            Quem já usa o <span className="text-gradient-emerald">nutrIAprova</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Mariana S.",    text: "Perdi 8 kg em 3 meses. O nutricionista ajustou tudo para minha rotina real!", role: "Paciente" },
              { name: "Dr. Carlos N.", text: "Aumento de 40% na minha receita mensal validando planos. A IA economiza horas.", role: "Nutricionista CRN-3" },
              { name: "Felipe A.",     text: "Já indiquei 12 alunos e recebi R$ 120 de comissão. Produto fácil de vender!", role: "Personal Trainer" },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-border bg-card p-6 text-left"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-center mb-10">
            Por que o <span className="text-gradient-emerald">nutrIAprova</span>?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Sparkles, title: "IA de ponta", desc: "Planos alimentares gerados por modelos treinados em milhares de protocolos nutricionais." },
              { icon: Shield,   title: "Validação profissional", desc: "Cada dieta é revisada e assinada por um nutricionista registrado no CRN antes de chegar até você." },
              { icon: Dumbbell, title: "Rede de Personals", desc: "Personal trainers cadastrados indicam clientes e acompanham a evolução dos seus alunos." },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center"
                >
                  <div className="w-12 h-12 rounded-xl emerald-gradient flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="font-display font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative px-6 py-20 text-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                       h-[400px] w-[700px] rounded-full blur-[100px]"
            style={{ backgroundColor: isDark ? "rgba(52,211,153,0.14)" : "rgba(16,185,129,0.22)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-2xl mx-auto"
        >
          <h2 className="text-4xl font-display font-bold mb-4">
            Comece hoje por <span className="text-gradient-emerald">R$ 39,90</span>
          </h2>
          <p className="text-muted-foreground mb-8">
            Dieta personalizada + validação de nutricionista + suporte 24h. Cancele quando quiser.
          </p>
          <Button
            size="lg"
            className="emerald-gradient text-primary-foreground px-10 h-14 text-lg"
            onClick={() => navigate(CLIENT_AUTH_PATH)}
          >
            Quero Minha Dieta Agora
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground border-t border-border/50">
        © {new Date().getFullYear()} nutrIAprova — Dados protegidos conforme LGPD
      </footer>
    </>
  );
}

/** Cabeçalho + hero (sem min-h-screen na raiz — rolagem liberada no Index). */
export default function LandingHero() {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 20 },
    visible: (delay: number) => ({ opacity: 1, y: 0, transition: { delay, duration: 0.5 } }),
  };

  return (
    <>
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45 }}
        className="flex items-center justify-between px-6 py-4 border-b border-border/50
                   backdrop-blur-sm sticky top-0 z-50 bg-background/80"
      >
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => navigate("/")}
        >
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-display font-bold text-xl">
            nutr<span className="text-primary">IA</span>prova
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Blog — sempre visível, independente de login */}
          <Button
            variant="ghost"
            className="gap-1.5 hidden sm:inline-flex"
            onClick={() => navigate("/blog")}
          >
            <BookOpen className="h-4 w-4" />
            Blog
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Blog"
            className="sm:hidden"
            onClick={() => navigate("/blog")}
          >
            <BookOpen className="h-4 w-4" />
          </Button>

          {user ? (
            // Logada → oferece um botão de Sair bem explícito para trocar de conta.
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          ) : (
            <Button variant="outline" onClick={() => navigate("/auth")}>Entrar</Button>
          )}

          <Button className="emerald-gradient text-primary-foreground" onClick={() => navigate(CLIENT_AUTH_PATH)}>
            Começar
          </Button>
        </div>
      </motion.header>

      <section
        ref={heroRef}
        className="relative flex items-center justify-center px-6 py-20 md:py-24 overflow-hidden min-h-[min(88dvh,900px)]"
      >
        <RadialBlobs isDark={isDark} />
        <Particles isDark={isDark} />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0.05}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6
                       border border-primary/30 bg-primary/8 text-primary text-sm font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            IA + Validação por Nutricionistas
          </motion.div>

          <motion.h1
            variants={fadeUp} initial="hidden" animate="visible" custom={0.1}
            className="text-5xl md:text-7xl font-display font-bold leading-tight mb-6"
          >
            Dietas{" "}
            <span className="text-gradient-emerald">personalizadas</span>
            <br />
            por IA, validadas por{" "}
            <span className="text-gradient-emerald">profissionais</span>
          </motion.h1>

          <motion.p
            variants={fadeUp} initial="hidden" animate="visible" custom={0.2}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Receba um plano alimentar criado por inteligência artificial e validado
            por nutricionistas registrados no CRN — em menos de 24 horas.
          </motion.p>

          {/* Três CTAs (sem duplicar o CTA verde do header) */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0.3}
            className="flex flex-wrap lg:flex-nowrap justify-center gap-3 mb-16 w-full max-w-4xl mx-auto"
          >
            <Button
              size="lg" variant="outline"
              className="gap-2 h-12 shrink-0 lg:flex-1 lg:min-w-0 border-rose-300 text-rose-600
                         hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400
                         dark:hover:bg-rose-950/30"
              onClick={() => navigate(CLIENT_AUTH_PATH)}
            >
              <HeartPulse className="h-4 w-4" />
              Sou Paciente
            </Button>

            <Button
              size="lg" variant="outline"
              className="gap-2 h-12 shrink-0 lg:flex-1 lg:min-w-0 border-emerald-500 text-emerald-700
                         hover:bg-emerald-500/10 dark:border-emerald-400 dark:text-emerald-300
                         dark:hover:bg-emerald-950/40"
              onClick={() => navigate(NUTRI_LANDING_PATH)}
            >
              <Apple className="h-4 w-4" />
              Sou Nutricionista
            </Button>

            <Button
              size="lg" variant="outline"
              className="gap-2 h-12 shrink-0 lg:flex-1 lg:min-w-0 border-amber-400 text-amber-700
                         hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400
                         dark:hover:bg-amber-950/30"
              onClick={() => navigate(PERSONAL_LANDING_PATH)}
            >
              <Dumbbell className="h-4 w-4" />
              Sou Personal
            </Button>
          </motion.div>

          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0.45}
            className="flex items-center justify-center"
          >
            <div className="flex-none text-center px-8">
              <p className="text-4xl font-display font-bold text-primary">
                <Counter target={98} suffix="%" />
              </p>
              <p className="text-sm text-muted-foreground mt-1">Satisfação</p>
            </div>
            <div className="w-px h-12 bg-border flex-shrink-0" />
            <div className="flex-none text-center px-8">
              <p className="text-4xl font-display font-bold text-primary">
                <Counter target={24} suffix="h" />
              </p>
              <p className="text-sm text-muted-foreground mt-1">SLA garantido</p>
            </div>
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}
