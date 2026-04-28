import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  BookOpen,
  Shield,
  CreditCard,
  UtensilsCrossed,
  ClipboardList,
  Crown,
  Sparkles,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { isCRNValid } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { getTimeGreeting } from "@/lib/timeGreeting";
import { supabase } from "@/integrations/supabase/client";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

const fade = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function HubHeroShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[hsl(var(--surface-3))] bg-gradient-to-br from-[hsl(var(--surface-1))] via-[hsl(var(--surface-0))] to-[hsl(var(--primary))]/6 p-6 shadow-md md:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-[hsl(var(--primary))]/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-[hsl(172,55%,38%)]/10 blur-3xl" />
      {children}
    </div>
  );
}

function BentoCard({
  title,
  description,
  icon: Icon,
  onClick,
  className,
  iconClassName,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "hover-lift group flex h-full min-h-[140px] flex-col rounded-2xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))]/90 p-5 text-left shadow-sm backdrop-blur-sm transition-shadow hover:border-[hsl(var(--primary)/0.35)] hover:shadow-md md:min-h-[160px] md:p-6",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--surface-2))] text-[hsl(var(--primary))] transition-colors group-hover:bg-[hsl(var(--primary)/0.12)]",
          iconClassName,
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={2} />
      </div>
      <p className="font-display text-base font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-lg">{title}</p>
      <p className="mt-1.5 text-sm leading-snug text-[hsl(var(--ink-2))]">{description}</p>
    </motion.button>
  );
}

export default function InicioPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [clientHasActivePlan, setClientHasActivePlan] = useState<boolean | null>(null);
  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const role = profile?.role;
  const crnOk = isCRNValid((profile?.crn_number ?? "").trim());
  const nameOk = !!profile?.full_name?.trim();
  const first = profile?.full_name?.split(" ")[0] || "Olá";
  const greeting = getTimeGreeting();

  useEffect(() => {
    if (role !== "client" || !user?.id) {
      setClientHasActivePlan(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("diet_requests")
        .select("id")
        .eq("client_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        if (error) {
          console.warn("[InicioPage] diet_requests:", error.message);
          setClientHasActivePlan(false);
        } else {
          setClientHasActivePlan(!!data);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, user?.id]);

  const nutriOnboarding = role === "nutritionist" && !isSupreme && (!crnOk || !nameOk);

  if (nutriOnboarding) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-2xl px-4 py-10 md:py-16">
          <motion.div {...fade} transition={{ duration: 0.35 }} className="text-center">
            <HubHeroShell>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-3xl">Complete seu perfil</h1>
              <p className="mt-2 text-sm text-[hsl(var(--ink-2))]">Para acessar o painel clínico, precisamos do seu CRN e nome completo.</p>
              <Button className="btn-primary mt-6 gap-2" onClick={() => navigate("/onboarding")}>
                Continuar cadastro
              </Button>
            </HubHeroShell>
          </motion.div>
        </main>
      </div>
    );
  }

  if (role === "nutritionist" || isSupreme) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 md:max-w-5xl md:py-12">
          <motion.div {...fade} transition={{ duration: 0.4 }} className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8">
            <Avatar className="h-28 w-28 border-4 border-[hsl(var(--surface-3))] shadow-xl ring-4 ring-[hsl(var(--primary)/0.12)] md:h-32 md:w-32">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" className="object-cover" /> : null}
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 font-display text-3xl font-bold text-primary-foreground">
                {(profile?.full_name || user?.email || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--primary))]">
                {isSupreme ? "Acesso master · nutrição clínica" : "Nutrição clínica"}
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">
                {greeting}, {first}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-[hsl(var(--ink-2))] md:text-base">
                Seu hub central — acesse o painel, a comunidade e o blog em um layout limpo.
              </p>
            </div>
          </motion.div>

          <motion.div
            {...fade}
            transition={{ delay: 0.06, duration: 0.4 }}
            className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2"
          >
            <BentoCard
              className="md:col-span-2 md:row-span-2 md:min-h-[220px]"
              title="Acessar meu painel"
              description="Validações, fila de dietas, moedas e IA — tudo no painel clínico."
              icon={LayoutDashboard}
              onClick={() => navigate("/nutri-dashboard")}
            />
            <BentoCard
              title="Comunidade"
              description="Publicações, curtidas e rede de colegas."
              icon={Users}
              onClick={() => navigate("/comunidade")}
            />
            <BentoCard
              title="Blog"
              description="Leia e compartilhe conteúdo da plataforma."
              icon={BookOpen}
              onClick={() => navigate("/blog")}
            />
          </motion.div>

          <motion.div {...fade} transition={{ delay: 0.12, duration: 0.35 }} className="mt-6 grid gap-4 sm:grid-cols-2">
            <BentoCard
              title="Planos e assinatura"
              description="Upgrade, cobrança e vitrine de planos."
              icon={CreditCard}
              iconClassName="text-[hsl(var(--coin-gold))]"
              onClick={() => navigate("/configuracoes?tab=plano")}
            />
            <BentoCard
              title="Ver vitrine pública"
              description="Página de planos para nutricionistas."
              icon={Sparkles}
              onClick={() => navigate("/planos")}
            />
          </motion.div>

          {isSupreme && (
            <motion.div
              {...fade}
              transition={{ delay: 0.16, duration: 0.35 }}
              className="mt-8 rounded-2xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))]/80 p-5 backdrop-blur-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Administração</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => navigate("/admin-supremo")}>
                  <Crown className="h-3.5 w-3.5" /> Admin Supremo
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => navigate("/admin")}>
                  Painel admin
                </Button>
              </div>
            </motion.div>
          )}
        </main>
      </div>
    );
  }

  if (role === "personal_trainer") {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 md:max-w-5xl md:py-12">
          <motion.div {...fade} transition={{ duration: 0.4 }} className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8">
            <Avatar className="h-28 w-28 border-4 border-[hsl(var(--surface-3))] shadow-xl ring-4 ring-orange-500/15 md:h-32 md:w-32">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" className="object-cover" /> : null}
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-amber-600 font-display text-3xl font-bold text-white">
                {(profile?.full_name || user?.email || "PT").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Parcerias</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">
                {greeting}, {first}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-[hsl(var(--ink-2))] md:text-base">
                Indicações, comissões e conteúdo — organize tudo a partir deste hub.
              </p>
            </div>
          </motion.div>

          <motion.div
            {...fade}
            transition={{ delay: 0.06, duration: 0.4 }}
            className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2"
          >
            <BentoCard
              className="md:col-span-2 md:row-span-2 md:min-h-[220px]"
              title="Acessar meu painel"
              description="Link de afiliado, leads, comissões e saques."
              icon={Dumbbell}
              iconClassName="text-orange-500"
              onClick={() => navigate("/personal-dashboard")}
            />
            <BentoCard
              title="Comunidade"
              description="Conecte-se com nutris e outros parceiros."
              icon={Users}
              onClick={() => navigate("/comunidade")}
            />
            <BentoCard
              title="Blog"
              description="Conteúdo e artigos da plataforma."
              icon={BookOpen}
              onClick={() => navigate("/blog")}
            />
          </motion.div>
        </main>
      </div>
    );
  }

  if (role === "admin" && !isSupreme) {
    return (
      <div className="min-h-screen bg-[hsl(var(--surface-0))]">
        <AppHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 md:max-w-5xl md:py-12">
          <motion.div {...fade} transition={{ duration: 0.4 }} className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8">
            <Avatar className="h-28 w-28 border-4 border-amber-500/30 shadow-xl md:h-32 md:w-32">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" className="object-cover" /> : null}
              <AvatarFallback className="bg-gradient-to-br from-amber-600 to-amber-800 font-display text-3xl font-bold text-white">
                {(profile?.full_name || user?.email || "AD").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Administração</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">
                {greeting}, {first}
              </h1>
              <p className="mt-2 text-sm text-[hsl(var(--ink-2))] md:text-base">Central de controle e atalhos rápidos.</p>
            </div>
          </motion.div>
          <motion.div
            {...fade}
            transition={{ delay: 0.06, duration: 0.4 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <BentoCard
              className="md:col-span-2 md:min-h-[160px]"
              title="Painel admin"
              description="Ferramentas administrativas da plataforma."
              icon={Shield}
              onClick={() => navigate("/admin")}
            />
            <BentoCard title="Comunidade" description="Acesse a comunidade." icon={Users} onClick={() => navigate("/comunidade")} />
            <BentoCard
              className="md:col-span-3"
              title="Blog"
              description="Conteúdo público e artigos."
              icon={BookOpen}
              onClick={() => navigate("/blog")}
            />
          </motion.div>
        </main>
      </div>
    );
  }

  const showCardapioCta = clientHasActivePlan === true;
  const primaryCtaLoading = clientHasActivePlan === null;

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-0))]">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 md:max-w-5xl md:py-12">
        <motion.div {...fade} transition={{ duration: 0.4 }} className="mb-8 flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-8">
          <Avatar className="h-28 w-28 border-4 border-[hsl(var(--surface-3))] shadow-xl ring-4 ring-[hsl(var(--primary)/0.12)] md:h-32 md:w-32">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" className="object-cover" /> : null}
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 font-display text-3xl font-bold text-primary-foreground">
              {(profile?.full_name || user?.email || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-center md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--primary))]">Sua jornada</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[hsl(var(--ink-1))] md:text-4xl">
              {greeting}, {first}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-[hsl(var(--ink-2))] md:text-base">
              {showCardapioCta
                ? "Cardápio, comunidade e blog — tudo por aqui."
                : "Comece pelo questionário; depois explore comunidade e blog nos atalhos abaixo."}
            </p>
          </div>
        </motion.div>

        <motion.div
          {...fade}
          transition={{ delay: 0.06, duration: 0.4 }}
          className="grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-2"
        >
          <motion.button
            type="button"
            disabled={primaryCtaLoading}
            whileHover={primaryCtaLoading ? undefined : { scale: 1.02 }}
            whileTap={primaryCtaLoading ? undefined : { scale: 0.99 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={() => (showCardapioCta ? navigate("/dashboard") : navigate("/questionnaire"))}
            className={cn(
              "hover-lift flex min-h-[180px] flex-col justify-between rounded-2xl border-2 border-[hsl(var(--primary)/0.4)] bg-gradient-to-br from-[hsl(var(--primary)/0.12)] to-[hsl(var(--surface-1))] p-6 text-left shadow-md md:col-span-2 md:row-span-2 md:min-h-[220px]",
              primaryCtaLoading && "cursor-wait opacity-80",
            )}
          >
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.2)] text-[hsl(var(--primary))]">
                {primaryCtaLoading ? (
                  <span className="text-sm font-medium">…</span>
                ) : showCardapioCta ? (
                  <UtensilsCrossed className="h-6 w-6" />
                ) : (
                  <ClipboardList className="h-6 w-6" />
                )}
              </div>
              <p className="font-display text-xl font-bold text-[hsl(var(--ink-1))] md:text-2xl">
                {primaryCtaLoading ? "Carregando…" : showCardapioCta ? "Acessar meu cardápio" : "Responder questionário"}
              </p>
              <p className="mt-2 text-sm text-[hsl(var(--ink-2))]">
                {showCardapioCta ? "Abra seu painel com o plano e acompanhamento." : "Monte seu plano com IA e validação CRN."}
              </p>
            </div>
            <span className="mt-4 text-sm font-semibold text-[hsl(var(--primary))]">Toque para continuar →</span>
          </motion.button>

          <BentoCard
            title="Comunidade"
            description="Receitas, dicas e interação."
            icon={Users}
            onClick={() => navigate("/comunidade")}
          />
          <BentoCard title="Blog" description="Artigos e novidades." icon={BookOpen} onClick={() => navigate("/blog")} />
        </motion.div>
      </main>
    </div>
  );
}
