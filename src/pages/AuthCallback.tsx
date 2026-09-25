import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingSignup, getPendingSignup } from "@/lib/pendingSignup";
import { isCRNValid } from "@/lib/masks";
import {
  requestOwnRoleTransition,
  sanitizePublicRole,
  waitForOwnProfile,
  type PublicRole,
} from "@/services/profileSecurityService";

type ProfileRow = {
  role: string | null;
  full_name: string | null;
  crn_number: string | null;
  referred_by?: string | null;
};

function hasCompleteName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim().replace(/\s+/g, " ");
  return normalized.length >= 3 && normalized.includes(" ");
}

function normalizeRole(role: string | null | undefined): "client" | "nutritionist" | "personal_trainer" | "admin" {
  if (role === "nutritionist") return "nutritionist";
  if (role === "personal_trainer") return "personal_trainer";
  if (role === "admin") return "admin";
  return "client";
}

/**
 * Decide a rota pós-login de forma literal e previsível.
 *
 * Regras:
 *  - Se EXISTE perfil no banco, manda pelo papel do perfil (Nutri sem CRN
 *    completo cai em /onboarding; com CRN completo, /nutri-dashboard).
 *  - Se NÃO existe perfil, usa o role escolhido em /auth (gravado em
 *    user.user_metadata.role) para decidir o próximo passo.
 *  - Sem informação alguma: vai para /dashboard (paciente é o caminho padrão).
 */
function decideRoute(profile: ProfileRow | null, user: User): string {
  if (profile?.role) {
    if (profile.role === "nutritionist") {
      const ok =
        !!profile.full_name?.trim() &&
        isCRNValid((profile.crn_number ?? "").trim());
      return ok ? "/inicio" : "/onboarding";
    }
    if (profile.role === "personal_trainer") return "/inicio";
    if (profile.role === "admin")            return "/inicio";
    return "/inicio";
  }

  // Sem perfil → respeita o que o usuário escolheu em /auth.
  const metaRole = (user.user_metadata?.role ?? "") as string;
  if (metaRole === "nutritionist")     return "/onboarding";
  if (metaRole === "personal_trainer") return "/inicio";
  if (metaRole === "client")           return "/inicio";

  return "/inicio";
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        // 1) Troca ?code= por sessão (OAuth/PKCE / confirmação de e-mail).
        const code = new URL(window.location.href).searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);

        // 2) Pega a sessão. Sem sessão → volta para /auth.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          clearPendingSignup();
          navigate("/auth", { replace: true });
          return;
        }
        const user = session.user;

        // 3) Aguarda profile criado pelo trigger (INSERT client-side revogado).
        const pending = getPendingSignup();
        let profile = await waitForOwnProfile(user.id);

        if (!profile) {
          console.error("[AuthCallback] profile não criado pelo trigger");
          clearPendingSignup();
          navigate("/auth", { replace: true });
          return;
        }

        const metaFullName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? null) as string | null;
        const safeMetaReferrer = (user.user_metadata?.referred_by ?? null) as string | null;
        const fallbackName =
          pending?.fullName?.trim() ||
          profile.full_name?.trim() ||
          metaFullName?.trim() ||
          null;
        const fallbackReferrer =
          pending?.refCode?.trim() || profile.referred_by || safeMetaReferrer || null;

        // Intenção de papel: pendingSignup / metadata = UX apenas.
        // Nunca promove admin. Authority = profiles.role.
        const desiredPublic: PublicRole = sanitizePublicRole(
          pending?.role ?? (user.user_metadata?.role as string | undefined),
        );

        // Transição legítima quando o trigger criou client e o usuário
        // escolheu nutri/PT (fluxo OAuth/pendingSignup).
        if (
          profile.role === "client" &&
          (desiredPublic === "nutritionist" || desiredPublic === "personal_trainer")
        ) {
          try {
            const crn =
              desiredPublic === "nutritionist"
                ? pending?.crnNumber ?? profile.crn_number ?? null
                : null;
            const updated = await requestOwnRoleTransition(desiredPublic, crn);
            if (updated && typeof updated === "object") {
              profile = {
                ...profile,
                role: (updated as { role?: string }).role ?? desiredPublic,
                crn_number:
                  (updated as { crn_number?: string | null }).crn_number ??
                  profile.crn_number,
                approved: false,
              };
            }
          } catch (rpcErr) {
            console.warn("[AuthCallback] role transition:", rpcErr);
          }
        }

        // UPDATE apenas de campos comuns (não role/approved/credits/plan_tier).
        const commonPatch: Record<string, string | null> = {};
        if (fallbackName && (!profile.full_name || !profile.full_name.trim())) {
          commonPatch.full_name = fallbackName;
        }
        if (fallbackReferrer && !profile.referred_by) {
          commonPatch.referred_by = fallbackReferrer;
        }
        if (Object.keys(commonPatch).length > 0) {
          const { error: upErr } = await supabase
            .from("profiles")
            .update(commonPatch)
            .eq("user_id", user.id);
          if (upErr) console.warn("[AuthCallback] update profile:", upErr.message);
        }

        // Espelho UX em metadata — nunca autoridade.
        if (pending?.role) {
          const mirror = sanitizePublicRole(pending.role);
          await supabase.auth.updateUser({ data: { role: mirror } });
        }
        clearPendingSignup();

        // 4) Lê o perfil final e valida nome completo obrigatório.
        const { data: finalProfile } = await supabase
          .from("profiles")
          .select("role, full_name, crn_number, referred_by")
          .eq("user_id", user.id)
          .maybeSingle();

        const nextRoute = decideRoute(finalProfile as ProfileRow | null, user);
        if (!hasCompleteName(finalProfile?.full_name)) {
          navigate(`/confirmar-nome-completo?next=${encodeURIComponent(nextRoute)}`, { replace: true });
          return;
        }

        navigate(nextRoute, { replace: true });
      } catch (err) {
        console.error("[AuthCallback] erro:", err);
        clearPendingSignup();
        navigate("/auth", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 bg-background px-4">
      <div className="w-7 h-7 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-sm text-muted-foreground">Conectando com sua conta…</p>
    </div>
  );
}
