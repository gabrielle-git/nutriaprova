import { useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import LandingHero, { LandingHomeContinued } from "@/components/LandingHero";
import { clearPendingSignup } from "@/lib/pendingSignup";
import { useAuth } from "@/hooks/useAuth";
import { isCRNValid } from "@/lib/masks";

// Decide para onde jogar uma sessão ativa que caiu na Home. A lógica espelha o
// `decideRoute` do AuthCallback — fonte única é o `profile.role`, com fallback
// para `user.user_metadata.role` enquanto o trigger/perfil ainda não existe.
function dashboardPathFor(
  profile: { role?: string | null; full_name?: string | null; crn_number?: string | null } | null,
  metaRole: string | undefined,
): string | null {
  const role = profile?.role ?? metaRole ?? null;
  if (!role) return null;
  if (role === "nutritionist") {
    const crnOk = isCRNValid((profile?.crn_number ?? "").trim());
    const nameOk = !!profile?.full_name?.trim();
    return crnOk && nameOk ? "/nutri-dashboard" : "/onboarding";
  }
  if (role === "personal_trainer") return "/personal-dashboard";
  if (role === "admin") return "/admin";
  if (role === "client") return "/dashboard";
  return null;
}

export default function Index() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  // Sempre que a Home for carregada, deletamos a intenção de cadastro pendente
  // ANTES da primeira pintura. Isso garante que nenhum "fantasma" de teste
  // anterior (Nutri / Personal / Paciente) influencie o próximo clique.
  useLayoutEffect(() => {
    clearPendingSignup();
  }, []);

  // Redirecionamento inteligente: se a usuária já está logada no Supabase
  // (sessão REAL — nada a ver com localStorage), mandamos direto para o
  // dashboard do papel. Usamos `replace: true` para não deixar a Home no
  // histórico — isso também neutraliza o "OAuth loop" no botão Voltar.
  useEffect(() => {
    if (loading || !user) return;
    const metaRole = (user.user_metadata?.role ?? undefined) as string | undefined;
    const target = dashboardPathFor(profile, metaRole);
    if (target) navigate(target, { replace: true });
  }, [loading, user, profile, navigate]);

  // Enquanto a sessão é resolvida, não pintamos a landing para evitar flash —
  // a listagem de conteúdo público permanece acessível a quem não está logado.
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-background overflow-x-hidden">
      <LandingHero />
      <LandingHomeContinued />
    </div>
  );
}
