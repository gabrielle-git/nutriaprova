import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Shield,
  Sparkles,
  Star,
  Apple,
  Moon,
  Dumbbell,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";
import type { CSSProperties, MouseEvent } from "react";

const CLIENT_AUTH_PATH = "/auth?role=client";

const BIOTIPO_CARDS = [
  { title: "Ectomorfo", desc: "Metabolismo acelerado, dificuldade em ganhar massa. Foco em superávit e densidade calórica.", icon: Moon },
  { title: "Mesomorfo", desc: "Ponto equilibrado — boa resposta a treino e dieta, facilidade para recomposição.", icon: Dumbbell },
  { title: "Endomorfo", desc: "Tendência a reservar gordura. Estratégia em déficit calórico e saciedade controlada.", icon: Apple },
] as const;

const scrollCardEase = [0.16, 1, 0.3, 1] as const;
const scrollViewport = { once: false as const, amount: 0.18 as const, margin: "0px 0px -72px 0px" as const };

function BioTiltCard({
  b,
  index,
}: {
  b: (typeof BIOTIPO_CARDS)[number];
  index: number;
}) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const Icon = b.icon;

  return (
    <motion.div
      className="card-clinical card-scan overflow-hidden p-5 text-left"
      style={
        {
          "--scan-delay": `${index * 1.3}s`,
          rotateX: tilt.x,
          rotateY: tilt.y,
          transformStyle: "preserve-3d",
          transformPerspective: 1000,
        } as CSSProperties
      }
      initial={{ opacity: 0, y: 56, scale: 0.92, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={scrollViewport}
      transition={{
        delay: index * 0.16,
        duration: 0.78,
        ease: scrollCardEase,
        rotateX: { type: "spring", stiffness: 320, damping: 22 },
        rotateY: { type: "spring", stiffness: 320, damping: 22 },
      }}
      whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.22, ease: "easeOut" } }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientY - rect.top) / rect.height - 0.5) * -16;
        const y = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
        setTilt({ x, y });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--surface-2))]">
        <Icon className="icon-glow h-5 w-5 text-primary" />
      </div>
      <h3 className="mb-1.5 font-display text-sm font-semibold text-[hsl(var(--ink-1))]">{b.title}</h3>
      <p className="text-xs leading-relaxed text-[hsl(var(--ink-2))]">{b.desc}</p>
    </motion.div>
  );
}

function spotlightMouseMove(e: MouseEvent<HTMLElement>) {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
}

/** Conteúdo abaixo da dobra: biótipos, depoimentos, features, CTA e rodapé (lazy-load no Index). */
export function LandingHomeContinued() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <>
      <section className="relative overflow-hidden border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-4 py-16 md:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-40 w-[min(700px,100%)] -translate-x-1/2 rounded-full bg-primary/5 blur-[50px] md:h-48" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl">
          <motion.div
            className="mb-10 text-center md:mb-12"
            initial={{ opacity: 0, y: 36, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={scrollViewport}
            transition={{ duration: 0.7, ease: scrollCardEase }}
          >
            <h2 className="mb-3 font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl">
              Simule seu <span className="text-gradient-emerald">biótipo</span>
            </h2>
            <p className="text-[0.95rem] leading-relaxed text-[hsl(var(--ink-2))] md:text-base">
              Descubra seu perfil metabólico antes mesmo de começar — cada corpo reage de um jeito, e o nutrIAprova ajusta por perfil, não por fórmula genérica.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BIOTIPO_CARDS.map((b, i) => (
              <BioTiltCard key={b.title} b={b} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <motion.h2
            className="mb-10 font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl"
            initial={{ opacity: 0, y: 32, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={scrollViewport}
            transition={{ duration: 0.65, ease: scrollCardEase }}
          >
            Quem já usa o <span className="text-gradient-emerald">nutrIAprova</span>
          </motion.h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {[
              { name: "Mariana S.", text: "Perdi 8 kg em 3 meses. O nutricionista ajustou tudo para minha rotina real!", role: "Paciente" },
              { name: "Dr. Carlos N.", text: "Aumento de 40% na minha receita mensal validando planos. A IA economiza horas.", role: "Nutricionista CRN-3" },
              { name: "Felipe A.", text: "Já indiquei 12 alunos e recebi R$ 120 de comissão. Produto fácil de vender!", role: "Personal Trainer" },
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 72, scale: 0.88, rotateX: -12, filter: "blur(10px)" }}
                whileInView={{ opacity: 1, y: 0, scale: 1, rotateX: 0, filter: "blur(0px)" }}
                viewport={scrollViewport}
                transition={{ delay: i * 0.15, duration: 0.82, ease: scrollCardEase }}
                whileHover={{ y: -12, scale: 1.03, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
                className="card-clinical hover-glow p-6 text-left"
                style={{ transformPerspective: 1000 }}
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
          <motion.h2
            className="mb-10 text-center font-display text-2xl font-bold text-[hsl(var(--ink-1))] md:text-3xl"
            initial={{ opacity: 0, y: 32, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={scrollViewport}
            transition={{ duration: 0.65, ease: scrollCardEase }}
          >
            Por que o <span className="text-gradient-emerald">nutrIAprova</span>?
          </motion.h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            {[
              { icon: Sparkles, title: "IA de ponta", desc: "Planos alimentares gerados por modelos treinados em milhares de protocolos nutricionais." },
              { icon: Shield, title: "Validação profissional", desc: "Cada dieta é revisada e assinada por um nutricionista registrado no CRN antes de chegar até você." },
              { icon: Dumbbell, title: "Rede de Personals", desc: "Personal trainers cadastrados indicam clientes e acompanham a evolução dos seus alunos." },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 64, scale: 0.9, filter: "blur(10px)" }}
                  whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  viewport={scrollViewport}
                  transition={{ delay: i * 0.14, duration: 0.8, ease: scrollCardEase }}
                  whileHover={{ y: -10, scale: 1.02, transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] } }}
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

      <section
        className="spotlight relative overflow-hidden px-4 py-20 text-center md:px-6"
        onMouseMove={spotlightMouseMove}
      >
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute left-1/2 top-1/2 h-[min(400px,80vw)] w-[min(700px,95vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[100px]"
            style={{ backgroundColor: isDark ? "rgba(52,211,153,0.14)" : "rgba(16,185,129,0.22)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          viewport={scrollViewport}
          transition={{ duration: 0.75, ease: scrollCardEase }}
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
