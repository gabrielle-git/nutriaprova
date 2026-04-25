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
      return ok ? "/nutri-dashboard" : "/onboarding";
    }
    if (profile.role === "personal_trainer") return "/personal-dashboard";
    if (profile.role === "admin")            return "/admin";
    return "/dashboard"; // client / qualquer outro role salvo
  }

  // Sem perfil → respeita o que o usuário escolheu em /auth.
  const metaRole = (user.user_metadata?.role ?? "") as string;
  if (metaRole === "nutritionist")     return "/onboarding";
  if (metaRole === "personal_trainer") return "/personal-dashboard";
  if (metaRole === "client")           return "/dashboard";

  return "/dashboard";
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

        // 3) Se a tela /auth gravou intenção de cadastro (Google OAuth perde
        //    options.data), aplica UMA vez no profile + metadata. Isso só
        //    "carimba" o role correto; a decisão de rota usa o profile real.
        const pending = getPendingSignup();
        if (pending?.role) {
          const payload = {
            user_id: user.id,
            role: pending.role,
            full_name: pending.fullName ?? user.user_metadata?.full_name ?? null,
            crn_number:
              pending.role === "nutritionist" ? (pending.crnNumber ?? null) : null,
          };
          const { error: upErr } = await supabase
            .from("profiles")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert(payload as any, { onConflict: "user_id" });
          if (upErr) console.warn("[AuthCallback] upsert profile:", upErr.message);

          await supabase.auth.updateUser({ data: { role: pending.role } });
        }
        clearPendingSignup();

        // 4) Lê o perfil e roteia.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name, crn_number")
          .eq("user_id", user.id)
          .maybeSingle();

        navigate(decideRoute(profile as ProfileRow | null, user), { replace: true });
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
