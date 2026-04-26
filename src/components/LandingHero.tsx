import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Leaf, ArrowRight, Shield, Sparkles, Star,
  HeartPulse, Apple, Sun, Moon, Dumbbell, BookOpen, LogOut,
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

const SOCIAL_PROOF_BADGES = [
  "IA Nutricional",
  "Planos Personalizados",
  "Acompanhamento Real",
] as const;

const BIOTIPO_CARDS = [
  { title: "Ectomorfo", desc: "Metabolismo acelerado, dificuldade em ganhar massa. Foco em superávit e densidade calórica.", icon: Moon },
  { title: "Mesomorfo", desc: "Ponto equilibrado — boa resposta a treino e dieta, facilidade para recomposição.", icon: Dumbbell },
  { title: "Endomorfo", desc: "Tendência a reservar gordura. Estratégia em déficit calórico e saciedade controlada.", icon: Apple },
] as const;

/** Conteúdo abaixo do dobra: biótipos, depoimentos, features, CTA e rodapé (usado em Index). */
export function LandingHomeContinued() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <>
      <section className="relative overflow-hidden border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-4 py-16 md:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-0 h-40 w-[min(700px,100%)] -translate-x-1/2 rounded-full bg-primary/5 blur-[50px] md:h-48"
          />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="mb-10 text-center md:mb-12">
            <h2 className="mb-3 font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl">
              Simule seu <span className="text-gradient-emerald">biótipo</span>
            </h2>
            <p className="text-[0.95rem] leading-relaxed text-[hsl(var(--ink-2))] md:text-base">
              Descubra seu perfil metabólico antes mesmo de começar — cada corpo reage de um jeito, e o nutrIAprova ajusta por perfil, não por fórmula genérica.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BIOTIPO_CARDS.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="card-clinical p-5 text-left">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--surface-2))]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-1.5 font-display text-sm font-semibold text-[hsl(var(--ink-1))]">{b.title}</h3>
                  <p className="text-xs leading-relaxed text-[hsl(var(--ink-2))]">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-10 font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl">
            Quem já usa o <span className="text-gradient-emerald">nutrIAprova</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
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
                className="card-clinical p-6 text-left"
              >
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mb-4 text-sm text-[hsl(var(--ink-2))]">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold text-[hsl(var(--ink-1))]">{t.name}</p>
                  <p className="text-xs text-[hsl(var(--ink-3))]">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-4 py-16 md:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl">
            Por que o <span className="text-gradient-emerald">nutrIAprova</span>?
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
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
                  className="card-clinical flex flex-col items-center p-6 text-center"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--surface-2))]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-sans text-base font-semibold text-[hsl(var(--ink-1))]">{f.title}</h3>
                  <p className="text-sm font-normal leading-relaxed text-[hsl(var(--ink-2))]">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-20 text-center md:px-6">
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute left-1/2 top-1/2 h-[min(400px,80vw)] w-[min(700px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
            style={{ backgroundColor: isDark ? "rgba(52,211,153,0.14)" : "rgba(16,185,129,0.22)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 mx-auto max-w-2xl"
        >
          <h2 className="mb-4 font-display text-3xl font-bold text-[hsl(var(--ink-1))] md:text-4xl">
            Comece hoje por <span className="text-gradient-emerald">R$ 39,90</span>
          </h2>
          <p className="mb-8 text-[hsl(var(--ink-2))]">
            Dieta personalizada + validação de nutricionista + suporte 24h. Cancele quando quiser.
          </p>
          <Button
            size="lg"
            className="btn-primary h-14 gap-2 px-10 text-lg"
            onClick={() => navigate(CLIENT_AUTH_PATH)}
          >
            Quero Minha Dieta Agora
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      <footer className="border-t border-[hsl(var(--surface-3))] px-4 py-6 text-center text-xs text-[hsl(var(--ink-3))] md:px-6">
        © {new Date().getFullYear()} nutrIAprova — Dados protegidos conforme LGPD
      </footer>
    </>
  );
}

/** Cabeçalho + hero (rota Index — duas colunas no desktop, simulador no hero). */
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
        className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[hsl(var(--surface-3)/0.8)] bg-[hsl(var(--surface-0)/0.92)] px-4 shadow-[0_1px_0_hsl(var(--primary)/0.06),0_4px_24px_hsl(var(--ink-1)/0.04)] backdrop-blur-xl backdrop-saturate-150 md:px-6"
      >
        <div
          className="flex cursor-pointer select-none items-center gap-2"
          onClick={() => navigate("/")}
        >
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold tracking-[-0.02em] md:text-xl">
            nutr<span className="text-primary">IA</span>prova
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-[hsl(var(--surface-3))] hover:bg-[hsl(var(--surface-2))]" onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            className="hidden h-9 gap-1.5 rounded-full sm:inline-flex"
            onClick={() => navigate("/blog")}
          >
            <BookOpen className="h-4 w-4" />
            Blog
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Blog"
            className="h-9 w-9 rounded-full border border-[hsl(var(--surface-3))] sm:hidden"
            onClick={() => navigate("/blog")}
          >
            <BookOpen className="h-4 w-4" />
          </Button>

          {user ? (
            <Button
              variant="outline"
              className="h-9 gap-1.5 rounded-lg border-[hsl(var(--surface-3))]"
              onClick={async () => {
                await signOut();
                navigate("/", { replace: true });
              }}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          ) : (
            <Button variant="outline" className="h-9 rounded-lg border-[hsl(var(--surface-3))]" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
          )}

          <Button className="btn-primary h-9 px-4" onClick={() => navigate(CLIENT_AUTH_PATH)}>
            Começar
          </Button>
        </div>
      </motion.header>

      <section
        ref={heroRef}
        className="noise relative min-h-[100svh] overflow-hidden bg-hero px-4 py-10 md:px-6 md:py-14"
      >
        <RadialBlobs isDark={isDark} />
        <Particles isDark={isDark} />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-stretch justify-center gap-10 lg:min-h-0 lg:flex-row lg:items-center lg:gap-12 xl:gap-16"
        >
          <div className="max-w-2xl flex-1 text-center max-lg:mx-auto lg:max-w-none lg:px-0 lg:text-left">
            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={0.05}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] px-3 py-1.5 text-sm font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              IA + validação nutricionista
            </motion.div>

            <motion.h1
              variants={fadeUp} initial="hidden" animate="visible" custom={0.1}
              className="font-display font-extrabold leading-[1.1] tracking-[-0.03em] text-[hsl(var(--ink-1))]"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              <span className="mb-1 block w-fit text-[clamp(0.9rem,2vw,1.05rem)] font-bold tracking-[-0.02em] max-lg:mx-auto lg:mb-0">
                <span className="title-underline text-[hsl(var(--ink-1))]">
                  nutrI<span className="text-brand">Aprova</span>
                </span>
              </span>
              Sua nutrição
              <br />
              <span className="text-brand">personalizada</span>
              <br />
              com Inteligência Artificial
            </motion.h1>

            <p className="mb-0 mt-6 max-w-[520px] text-[1.125rem] font-normal leading-[1.7] text-[hsl(var(--ink-2))] max-lg:mx-auto">
              Receba um plano alimentar criado por inteligência artificial e validado por nutricionistas
              registrados no CRN — em menos de 24 horas.
            </p>

            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={0.16}
              className="mb-0 mt-6 flex flex-wrap justify-center gap-2 max-lg:max-w-md max-lg:mx-auto lg:justify-start"
            >
              {SOCIAL_PROOF_BADGES.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-1 text-xs text-[hsl(var(--ink-2))]"
                >
                  <span className="text-primary">✓</span> {label}
                </span>
              ))}
            </motion.div>

            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={0.3}
              className="mb-0 mt-8 flex w-full max-w-4xl flex-col gap-3 max-lg:mx-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start"
            >
              <motion.button
                type="button"
                onClick={() => navigate(CLIENT_AUTH_PATH)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary group flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-7 text-base font-semibold min-[480px]:min-w-[200px] sm:min-w-0 sm:flex-initial"
              >
                <HeartPulse className="h-4 w-4 shrink-0" />
                Sou paciente
                <ArrowRight className="ml-0.5 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
              </motion.button>

              <Button
                size="lg"
                variant="ghost"
                className="h-12 border border-[hsl(var(--surface-3))] bg-transparent px-7 text-base text-[hsl(var(--ink-1))] hover:border-primary hover:bg-transparent hover:text-primary"
                onClick={() => navigate(NUTRI_LANDING_PATH)}
              >
                <Apple className="h-4 w-4" />
                Sou nutricionista
              </Button>

              <Button
                size="lg"
                variant="ghost"
                className="h-12 border border-[hsl(var(--surface-3))] bg-transparent px-7 text-base text-[hsl(var(--ink-1))] hover:border-primary hover:bg-transparent hover:text-primary"
                onClick={() => navigate(PERSONAL_LANDING_PATH)}
              >
                <Dumbbell className="h-4 w-4" />
                Sou personal
              </Button>
            </motion.div>

            <motion.div
              variants={fadeUp} initial="hidden" animate="visible" custom={0.45}
              className="mt-10 grid w-full max-w-2xl grid-cols-3 gap-2 max-lg:mx-auto max-md:max-w-md md:flex md:max-w-none md:items-stretch md:gap-0 md:divide-x md:divide-[hsl(var(--surface-3))] lg:max-w-none"
            >
              {[
                { target: 98, suffix: "%", label: "Satisfação" },
                { target: 24, suffix: "h", label: "SLA garantido" },
                { target: 3, suffix: "", label: "Biótipos" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex min-w-0 flex-col items-center justify-center border-b border-[hsl(var(--surface-3))] py-3 text-center last:border-b-0 max-md:px-1 md:min-w-[7rem] md:border-b-0 md:px-6 md:py-2"
                >
                  <p className="font-display text-xl font-bold text-[hsl(var(--primary))] md:text-2xl lg:text-3xl">
                    <Counter target={row.target} suffix={row.suffix} />
                  </p>
                  <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">{row.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0.25}
            className="w-full min-w-0 max-w-2xl flex-1 max-lg:mx-auto lg:max-w-none"
          >
            <div className="card-clinical p-3 shadow-xl sm:p-4">
              <BiotipoSimulator />
            </div>
          </motion.div>
        </motion.div>
      </section>
    </>
  );
}
