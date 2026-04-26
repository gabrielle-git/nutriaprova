import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, Dumbbell, BookOpen, Sparkles, Heart, ArrowRight, Shield, CreditCard,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isCRNValid } from "@/lib/masks";
import { cn } from "@/lib/utils";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function HeroShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[hsl(var(--surface-3))] bg-gradient-to-br from-[hsl(var(--surface-0))] via-[hsl(var(--surface-1))] to-[hsl(var(--primary))]/5 p-6 shadow-lg md:p-10",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[hsl(var(--primary))]/10 blur-3xl" />
      {children}
    </div>
  );
}

export default function InicioPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const role = profile?.role;
  const crnOk = isCRNValid((profile?.crn_number ?? "").trim());
  const nameOk = !!profile?.full_name?.trim();
  // Supremo usa o ecossistema nutri sem bloquear no onboarding forçado (acesso master).
  const nutriOnboarding =
    role === "nutritionist" && !isSupreme && (!crnOk || !nameOk);

  if (nutriOnboarding) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
          <motion.div {...fade} transition={{ duration: 0.35 }} className="text-center">
            <HeroShell>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-3xl">Complete seu perfil</h1>
              <p className="mt-2 text-sm text-[hsl(var(--ink-2))]">Para acessar o painel clínico, precisamos do seu CRN e nome completo.</p>
              <Button className="btn-primary mt-6 gap-2" onClick={() => navigate("/onboarding")}>
                Continuar cadastro <ArrowRight className="h-4 w-4" />
              </Button>
            </HeroShell>
          </motion.div>
        </main>
      </div>
    );
  }

  if (role === "nutritionist" || isSupreme) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:max-w-5xl md:py-12">
          <motion.div {...fade} transition={{ duration: 0.35 }}>
            <HeroShell>
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">
                {isSupreme ? "Nutrição clínica · acesso master" : "Nutrição clínica"}
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">
                Olá, {profile?.full_name?.split(" ")[0] || "especialista"}.
              </h1>
              <p className="mt-2 max-w-lg text-sm text-[hsl(var(--ink-2))]">
                {isSupreme
                  ? "Mesmo painel, planos e moedas dos nutricionistas — com atalhos extras de administração."
                  : "Seu início: validações, comunidade, planos e conteúdo — tudo alinhado às moedas."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="btn-primary gap-2 pulse-brand" onClick={() => navigate("/nutri-dashboard")}>
                  <LayoutDashboard className="h-4 w-4" /> Ir ao painel clínico
                </Button>
                <Button
                  variant="outline"
                  className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] gap-2"
                  onClick={() => navigate("/configuracoes?tab=plano")}
                >
                  <CreditCard className="h-4 w-4" /> Planos e assinatura
                </Button>
                <Button variant="outline" className="border-border/80" onClick={() => navigate("/planos")}>
                  Ver vitrine de planos
                </Button>
                <Button variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))]" onClick={() => navigate("/comunidade")}>
                  <Users className="h-4 w-4" /> Comunidade
                </Button>
                <Button variant="ghost" className="bg-[hsl(var(--surface-2))]" onClick={() => navigate("/blog")}>
                  <BookOpen className="h-4 w-4" /> Blog
                </Button>
              </div>
              {isSupreme && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-[hsl(var(--surface-3))] pt-5">
                  <p className="w-full text-[11px] font-medium uppercase tracking-wider text-[hsl(var(--ink-3))]">
                    Administração
                  </p>
                  <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => navigate("/admin-supremo")}>
                    <Shield className="h-3.5 w-3.5" /> Admin Supremo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => navigate("/admin")}>
                    Painel admin
                  </Button>
                </div>
              )}
            </HeroShell>
          </motion.div>
          <motion.div
            {...fade}
            transition={{ delay: 0.08, duration: 0.35 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="card-clinical p-4">
              <Sparkles className="mb-2 h-5 w-5 text-[hsl(var(--primary))]" />
              <p className="font-display font-semibold text-[hsl(var(--ink-1))]">Validações com IA</p>
              <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">Feed em tempo real de solicitações. Acesse o painel para aceitar e revisar.</p>
            </div>
            <div className="card-clinical p-4">
              <Heart className="mb-2 h-5 w-5 text-[hsl(var(--primary))]" />
              <p className="font-display font-semibold text-[hsl(var(--ink-1))]">Curtidas na comunidade</p>
              <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">A cada 10 curtidas nas suas publicações, você recebe 1 moeda bônus (automático).</p>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  if (role === "personal_trainer") {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:max-w-5xl md:py-12">
          <motion.div {...fade} transition={{ duration: 0.35 }}>
            <HeroShell>
              <p className="text-xs font-semibold uppercase tracking-widest text-orange-500">Parcerias</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">
                {profile?.full_name?.split(" ")[0] || "Parceiro"}, vamos crescer juntos
              </h1>
              <p className="mt-2 max-w-lg text-sm text-[hsl(var(--ink-2))]">
                Indique alunos, acompanhe comissões e participe do blog e da comunidade.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="btn-primary gap-2" onClick={() => navigate("/personal-dashboard")}>
                  <Dumbbell className="h-4 w-4" /> Painel de afiliado
                </Button>
                <Button variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))]" onClick={() => navigate("/comunidade")}>
                  <Users className="h-4 w-4" /> Comunidade
                </Button>
                <Button variant="ghost" className="bg-[hsl(var(--surface-2))]" onClick={() => navigate("/blog")}>
                  <BookOpen className="h-4 w-4" /> Blog
                </Button>
              </div>
            </HeroShell>
          </motion.div>
        </main>
      </div>
    );
  }

  if (role === "admin" && !isSupreme) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:max-w-5xl md:py-12">
          <motion.div {...fade} transition={{ duration: 0.35 }}>
            <HeroShell>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Administração</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">Central de controle</h1>
              <p className="mt-2 text-sm text-[hsl(var(--ink-2))]">Acesse o painel administrativo ou a área pública do produto.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="btn-primary gap-2" onClick={() => navigate("/admin")}>
                  <Shield className="h-4 w-4" /> Painel admin
                </Button>
                <Button variant="ghost" className="bg-[hsl(var(--surface-2))]" onClick={() => navigate("/comunidade")}>
                  <Users className="h-4 w-4" /> Comunidade
                </Button>
              </div>
            </HeroShell>
          </motion.div>
        </main>
      </div>
    );
  }

  // client
  return (
    <div className="min-h-screen bg-[hsl(var(--surface-0))]">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:max-w-5xl md:py-12">
        <motion.div {...fade} transition={{ duration: 0.35 }}>
          <HeroShell>
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">Sua jornada</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">
              {profile?.full_name?.split(" ")[0] || "Olá"}, o que vamos fazer hoje?
            </h1>
            <p className="mt-2 max-w-lg text-sm text-[hsl(var(--ink-2))]">
              Plano, questionário, comunidade e acompanhamento — em um só lugar.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="btn-primary gap-2 pulse-brand" onClick={() => navigate("/dashboard")}>
                <LayoutDashboard className="h-4 w-4" /> Meu painel
              </Button>
              <Button variant="outline" className="border-[hsl(var(--primary))] text-[hsl(var(--primary))]" onClick={() => navigate("/comunidade")}>
                <Users className="h-4 w-4" /> Comunidade
              </Button>
              <Button variant="ghost" className="bg-[hsl(var(--surface-2))]" onClick={() => navigate("/blog")}>
                <BookOpen className="h-4 w-4" /> Blog
              </Button>
            </div>
          </HeroShell>
        </motion.div>
        <motion.div
          {...fade}
          transition={{ delay: 0.06, duration: 0.35 }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="card-clinical p-4">
            <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Receita aprovada</p>
            <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">Após a validação do seu plano, você pode publicar receitas e dicas na comunidade.</p>
          </div>
          <div className="card-clinical p-4">
            <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">Configurações</p>
            <p className="mt-1 text-xs text-[hsl(var(--ink-3))]">Atualize nome e foto de perfil quando quiser.</p>
            <Button variant="link" className="h-auto p-0 text-[hsl(var(--primary))]" onClick={() => navigate("/configuracoes")}>
              Abrir configurações <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
