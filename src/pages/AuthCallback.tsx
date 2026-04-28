import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearPendingSignup, getPendingSignup } from "@/lib/pendingSignup";
import { isCRNValid } from "@/lib/masks";

type ProfileRow = {
  role: string | null;
  full_name: string | null;
  crn_number: string | null;
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

        // 3) Lê o perfil e reconcilia fallback de nome/role.
        const pending = getPendingSignup();
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("role, full_name, crn_number")
          .eq("user_id", user.id)
          .maybeSingle();

        const metaFullName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? null) as string | null;
        const safeMetaRole = user.user_metadata?.role as string | undefined;
        const fallbackRole = normalizeRole(pending?.role ?? existingProfile?.role ?? safeMetaRole ?? "client");
        const fallbackName = pending?.fullName?.trim() || existingProfile?.full_name?.trim() || metaFullName?.trim() || null;

        const needsProfileUpsert =
          !existingProfile ||
          !existingProfile.full_name ||
          existingProfile.full_name.trim().length === 0 ||
          !!pending?.role;

        if (needsProfileUpsert) {
          const payload = {
            user_id: user.id,
            role: fallbackRole,
            full_name: fallbackName,
            crn_number:
              fallbackRole === "nutritionist"
                ? (pending?.crnNumber ?? existingProfile?.crn_number ?? null)
                : null,
          };
          const { error: upErr } = await supabase
            .from("profiles")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert(payload as any, { onConflict: "user_id" });
          if (upErr) console.warn("[AuthCallback] upsert profile:", upErr.message);

          if (pending?.role) {
            await supabase.auth.updateUser({ data: { role: pending.role } });
          }
        }
        clearPendingSignup();

        // 4) Lê o perfil final e valida nome completo obrigatório.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, crn_number")
          .eq("user_id", user.id)
          .maybeSingle();

        const nextRoute = decideRoute(profile as ProfileRow | null, user);
        if (!hasCompleteName(profile?.full_name)) {
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
