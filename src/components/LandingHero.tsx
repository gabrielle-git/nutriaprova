import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useSpring,
  animate,
  type Variants,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Leaf,
  ArrowRight,
  Sparkles,
  HeartPulse,
  Apple,
  Sun,
  Moon,
  Dumbbell,
  BookOpen,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useState, lazy, Suspense } from "react";

const BiotipoSimulatorLazy = lazy(() => import("./BiotipoSimulator"));

// ─────────────────────────────────────────────────────────────────────────────
// Contador animado
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.5 });
  const [display, setDisplay] = useState(0);
  const [springDone, setSpringDone] = useState(false);

  useEffect(() => {
    if (!isInView) return;
    setSpringDone(false);
    const ctrl = animate(0, target, {
      type: "spring",
      stiffness: 120,
      damping: 22,
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => setSpringDone(true),
    });
    return () => ctrl.stop();
  }, [isInView, target]);

  const text = `${display.toLocaleString("pt-BR")}${suffix}`;

  return (
    <motion.div
      ref={ref}
      className="inline-flex"
      initial={{ scale: 0.8, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.5 }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!springDone ? (
          <motion.span key="count" className="inline-block" exit={{ opacity: 0 }}>
            {text}
          </motion.span>
        ) : (
          <motion.span key="digits" className="inline-flex" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {text.split("").map((char, index) => (
              <span key={`${index}-${char}`} className="inline-block overflow-hidden align-bottom">
                <motion.span
                  className="inline-block"
                  initial={{ y: "100%", opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: index * 0.15, duration: 0.5 }}
                >
                  {char}
                </motion.span>
              </span>
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Partículas flutuantes
// ─────────────────────────────────────────────────────────────────────────────
const PARTICLES = Array.from({ length: 4 }, (_, i) => ({
  id: i,
  size: 6 + (i % 3) * 3,
  x: 3 + ((i * 31 + 7) % 94),
  delay: ((i * 0.45) % 4),
  duration: 6 + (i % 3) * 2.5,
  drift: -10 + (i % 7) * 3,
}));

const GHOST_PARTICLES = Array.from({ length: 2 }, (_, i) => ({
  id: `ghost-${i}`,
  size: 16 + (i % 3) * 4,
  left: `${5 + ((i * 13) % 88)}%`,
  top: `${8 + ((i * 19) % 72)}%`,
  duration: 22 + (i % 5) * 3,
  delay: i * 1.2,
  driftX: -55 + (i % 5) * 28,
  driftY: -40 + (i % 4) * 22,
  peak: 0.08 + (i % 3) * 0.02,
}));

function Particles({ isDark }: { isDark: boolean }) {
  const peakOpacity = isDark ? 0.5 : 0.6;
  const opacity: [number, number, number] = [0, peakOpacity, 0];
  const color = isDark ? "rgb(52, 211, 153)" : "rgb(5, 150, 105)";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 z-0">
        {GHOST_PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              top: p.top,
              backgroundColor: color,
            }}
            animate={{
              y: [0, p.driftY, -p.driftY * 0.6, 0],
              x: [0, p.driftX, -p.driftX * 0.5, 0],
              opacity: [p.peak * 0.4, p.peak, p.peak * 0.5, p.peak * 0.4],
              scale: [0.85, 1.05, 0.95, 0.85],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 z-[1]">
        {PARTICLES.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full border border-emerald-400/25"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              bottom: "-24px",
              backgroundColor: color,
            }}
            animate={{
              y: [0, -(340 + p.id * 14)],
              x: [0, p.drift, -p.drift, 0],
              opacity,
              scale: [0.5, 1.1, 0.7],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Blobs radiais de fundo
// ─────────────────────────────────────────────────────────────────────────────
function RadialBlobs({ isDark }: { isDark: boolean }) {
  const left = isDark ? "rgba(52, 211, 153, 0.20)" : "rgba(16, 185, 129, 0.30)";
  const right = isDark ? "rgba(20, 184, 166, 0.16)" : "rgba(5, 150, 105, 0.25)";
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
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
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
const CLIENT_AUTH_PATH = "/auth?role=client";
const NUTRI_LANDING_PATH = "/para-nutricionistas";
const PERSONAL_LANDING_PATH = "/personal-trainer";

const SOCIAL_PROOF_BADGES = [
  "IA Nutricional",
  "Planos Personalizados",
  "Acompanhamento Real",
] as const;

const titleWords = "Sua nutrição personalizada com IA".split(" ");

const subtitleLines = [
  "Receba um plano alimentar criado por inteligência artificial e validado por nutricionistas registrados no CRN",
  "— em menos de 24 horas.",
];

/** Cabeçalho + hero (rota Index — duas colunas no desktop, simulador no hero). */
export default function LandingHero() {
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroParallaxProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const { scrollYProgress: pageScrollProgress } = useScroll();
  const pageScrollBar = useSpring(pageScrollProgress, { stiffness: 320, damping: 42 });
  const heroY = useTransform(heroParallaxProgress, [0, 1], ["0%", "28%"]);
  const heroOpacity = useTransform(heroParallaxProgress, [0, 0.85], [1, 0]);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  /** Atrasa blobs/partículas para depois do 1º frame — menos trabalho na abertura. */
  const [heroFxReady, setHeroFxReady] = useState(false);
  useEffect(() => {
    let id2 = 0;
    const id = window.requestAnimationFrame(() => {
      id2 = window.requestAnimationFrame(() => setHeroFxReady(true));
    });
    return () => {
      window.cancelAnimationFrame(id);
      window.cancelAnimationFrame(id2);
    };
  }, []);

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (delay: number) => ({ opacity: 1, y: 0, transition: { delay, duration: 0.5 } }),
  };

  return (
    <>
      <motion.div
        style={{
          scaleX: pageScrollBar,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: "linear-gradient(90deg, hsl(158 72% 32%), hsl(158 80% 55%), hsl(158 90% 70%))",
          transformOrigin: "left",
          zIndex: 100,
        }}
      />

      <motion.section
        ref={heroRef}
        initial={{ opacity: 0, scale: 0.92, filter: "blur(16px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
        className="noise relative min-h-[100svh] overflow-hidden bg-hero px-4 pb-10 pt-0 md:px-6 md:pb-14"
      >
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        {heroFxReady ? (
          <>
            <motion.div
              className="pointer-events-none absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full"
              style={{ background: "radial-gradient(circle, hsl(158 72% 32% / 0.20) 0%, transparent 65%)" }}
              animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full"
              style={{ background: "radial-gradient(circle, hsl(172 60% 38% / 0.15) 0%, transparent 65%)" }}
              animate={{ scale: [1, 1.15, 1], x: [0, -20, 0] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            />
            <RadialBlobs isDark={isDark} />
            <Particles isDark={isDark} />
          </>
        ) : null}

        <motion.header
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="sticky top-0 z-50 flex h-16 items-center justify-between bg-transparent px-0 md:px-0"
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

            <Button variant="ghost" className="hidden h-9 gap-1.5 rounded-full sm:inline-flex" onClick={() => navigate("/blog")}>
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

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-stretch justify-center gap-10 pt-6 md:pt-10 lg:min-h-0 lg:flex-row lg:items-center lg:gap-12 xl:gap-16"
        >
          <div className="max-w-2xl flex-1 text-center max-lg:mx-auto lg:max-w-none lg:px-0 lg:text-left">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.05}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] px-3 py-1.5 text-sm font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" />
              IA + validação nutricionista
            </motion.div>

            <div className="mb-3 max-lg:mx-auto lg:mb-2">
              <span className="mb-1 block w-fit text-[clamp(0.9rem,2vw,1.05rem)] font-bold tracking-[-0.02em] max-lg:mx-auto lg:mb-0">
                <span className="title-underline text-[hsl(var(--ink-1))]">
                  nutrI<span className="text-brand">Aprova</span>
                </span>
              </span>
            </div>

            <h1
              className="font-display font-extrabold leading-[1.1] tracking-[-0.03em] text-[hsl(var(--ink-1))]"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              {titleWords.map((word, i) => {
                const isBrandWord = word === "personalizada" || word === "IA";
                return (
                  <span
                    key={i}
                    className="inline-block overflow-hidden align-bottom"
                    style={{ marginRight: "0.3em" }}
                  >
                    <motion.span
                      className={`inline-block ${isBrandWord ? "text-brand-animated" : ""}`}
                      initial={{ y: "110%", opacity: 0, skewY: 4 }}
                      animate={{ y: "0%", opacity: 1, skewY: 0 }}
                      transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {word}
                    </motion.span>
                  </span>
                );
              })}
            </h1>

            <div className="mb-0 mt-6 max-w-[520px] space-y-1 max-lg:mx-auto">
              {subtitleLines.map((line, index) => (
                <motion.p
                  key={index}
                  className="text-[1.125rem] font-normal leading-[1.7] text-[hsl(var(--ink-2))]"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  {line}
                </motion.p>
              ))}
            </div>

            <div className="mb-0 mt-6 flex flex-wrap justify-center gap-2 max-lg:max-w-md max-lg:mx-auto lg:justify-start">
              {SOCIAL_PROOF_BADGES.map((label, index) => (
                <motion.span
                  key={label}
                  initial={{ opacity: 0, x: -16, scale: 0.8 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ delay: 1.0 + index * 0.08, type: "spring", stiffness: 300 }}
                  className="badge-live inline-flex items-center gap-1 rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-1 text-xs text-[hsl(var(--ink-2))]"
                >
                  {label}
                </motion.span>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.85, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
              className="mb-0 mt-8 flex w-full max-w-4xl flex-col gap-3 max-lg:mx-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start"
            >
              <motion.button
                type="button"
                onClick={() => navigate(CLIENT_AUTH_PATH)}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.97 }}
                className="btn-breathe btn-primary group flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-7 text-base font-semibold min-[480px]:min-w-[200px] sm:min-w-0 sm:flex-initial"
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
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.45}
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
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.25}
            className="w-full min-w-0 max-w-2xl flex-1 max-lg:mx-auto lg:max-w-none"
          >
            <div className="card-clinical p-3 shadow-xl sm:p-4">
              <Suspense
                fallback={
                  <div
                    className="flex min-h-[420px] w-full items-center justify-center rounded-xl border border-dashed border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))/0.35]"
                    aria-busy
                    aria-label="Carregando simulador"
                  >
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  </div>
                }
              >
                <BiotipoSimulatorLazy />
              </Suspense>
            </div>
          </motion.div>
        </motion.div>
      </motion.section>
    </>
  );
}
