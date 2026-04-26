import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Check, Dumbbell, Leaf, Stethoscope, User, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { maskPhone, unmaskPhone, maskCRN, isCRNValid } from "@/lib/masks";
import { setPendingSignup, clearPendingSignup } from "@/lib/pendingSignup";
import { trackInviteEvent } from "@/services/inviteAnalytics";

type AuthMethod = "email" | "phone";
type AuthStep   = "form" | "otp";

const authInputClassName = cn(
  "h-11 w-full rounded-[var(--radius-sm)] border border-[hsl(var(--surface-3))] bg-background px-3 py-0 text-sm text-[hsl(var(--ink-1))] shadow-sm transition-colors",
  "font-sans placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-[hsl(var(--ink-3))]",
  "hover:border-[hsl(var(--surface-2))]",
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const authLabelClass = "text-[13px] font-medium leading-none text-[hsl(var(--ink-2))] font-sans mb-1 block";

const BRAND_TESTIMONIAL = {
  name: "Marina Costa",
  role: "Clienta há 8 meses",
  quote: "Nunca pensei que seguir um plano pudesse ser tão simples. A IA acelera e meu nutri valida tudo.",
  avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
} as const;

function BrandingPanel() {
  return (
    <aside className="bg-hero text-[hsl(var(--ink-1))] relative hidden w-[45%] min-h-screen flex-col justify-between p-10 md:flex">
      <div>
        <div className="flex items-center gap-2.5">
          <Leaf className="h-9 w-9 shrink-0 text-primary" strokeWidth={1.75} />
          <span className="font-display text-[2.5rem] font-extrabold leading-tight text-brand">
            NutrIAprova
          </span>
        </div>
        <p className="mt-2 max-w-sm font-sans text-base font-normal text-[hsl(var(--ink-2))]">
          Nutrição clínica com inteligência artificial e validação humana.
        </p>
        <div className="my-8 h-px w-full max-w-sm bg-[hsl(var(--surface-3))]" />
        <ul className="max-w-sm space-y-3">
          {[
            "Plano alimentar gerado por IA em segundos",
            "Acompanhamento real com seu nutricionista",
            "Resultados comprovados por +2.000 usuários",
          ].map((line) => (
            <li key={line} className="flex gap-2.5 font-sans text-sm font-normal text-[hsl(var(--ink-2))]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
      <figure className="mt-8 rounded-[var(--radius)] border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))]/60 p-4 backdrop-blur-sm">
        <blockquote className="font-sans text-sm leading-relaxed text-[hsl(var(--ink-2))]">
          “{BRAND_TESTIMONIAL.quote}”
        </blockquote>
        <figcaption className="mt-3 flex items-center gap-3">
          <img
            src={BRAND_TESTIMONIAL.avatarUrl}
            alt=""
            className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/15"
            width={44}
            height={44}
          />
          <div>
            <p className="font-sans text-sm font-semibold text-[hsl(var(--ink-1))]">
              {BRAND_TESTIMONIAL.name}
            </p>
            <p className="font-sans text-xs text-[hsl(var(--ink-3))]">
              {BRAND_TESTIMONIAL.role}
            </p>
          </div>
        </figcaption>
      </figure>
    </aside>
  );
}

function GoogleSeparator() {
  return (
    <div className="relative my-6 flex items-center py-0.5">
      <div className="h-px flex-1 bg-[hsl(var(--surface-3))]" />
      <span className="px-3 font-sans text-sm text-[hsl(var(--ink-3))]">ou</span>
      <div className="h-px flex-1 bg-[hsl(var(--surface-3))]" />
    </div>
  );
}

export default function Auth() {
  const location       = useLocation();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, user, profile, loading: authLoading } = useAuth();

  // Captura o código de afiliado da URL (?ref=XYZ)
  const refCode = searchParams.get("ref") ?? "";

  // Registra um clique único (deduplicado por sessão no banco) assim que a
  // tela de Auth abre com `?ref=`. Não bloqueia render nem o fluxo de login.
  useEffect(() => {
    if (!refCode) return;
    void trackInviteEvent({ code: refCode, eventType: "click" });
  }, [refCode]);

  // Lê o parâmetro ?role= da URL para pré-selecionar o perfil
  const roleParam = searchParams.get("role");

  // Cadastro fica visível (com as 3 opções de papel) sempre que a URL trouxer
  // um ?role= ou um openRegister=true. Caso contrário, a tela inicia em login.
  const [isLogin, setIsLogin] = useState(() => {
    const state = location.state as { openRegister?: boolean } | null;
    const fromState = state?.openRegister === true;
    const fromQuery = searchParams.get("openRegister") === "true";
    const hasRoleParam = !!searchParams.get("role");
    return !(fromState || fromQuery || hasRoleParam);
  });

  const [authMethod, setAuthMethod]     = useState<AuthMethod>("email");
  const [step, setStep]                 = useState<AuthStep>("form");

  // Campos do formulário
  const [email, setEmail]               = useState("");
  const [phone, setPhone]               = useState("");
  const [password, setPassword]         = useState("");
  const [fullName, setFullName]         = useState("");

  // Pré-seleciona o role vindo da URL (?role=nutritionist | ?role=personal_trainer)
  const [role, setRole] = useState<"client" | "nutritionist" | "personal_trainer">(() => {
    if (roleParam === "nutritionist")    return "nutritionist";
    if (roleParam === "personal_trainer") return "personal_trainer";
    return "client";
  });

  const [crnNumber, setCrnNumber]       = useState("");
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailServiceNotice, setEmailServiceNotice] = useState(false);
  const formSubmitLockRef = useRef(false);
  const googleClickLockRef = useRef(false);

  // OTP
  const [otpCode, setOtpCode]           = useState("");
  const [otpSentTo, setOtpSentTo]       = useState("");
  const [otpMethod, setOtpMethod]       = useState<AuthMethod>("email");
  const [otpIsSignup, setOtpIsSignup]   = useState(false);

  // Sessão ativa → redireciona imediatamente (sem segurar o usuário nesta página)
  // EXCEÇÃO: se a URL traz intenção explícita (?role= ou ?openRegister=true),
  // a usuária está deliberadamente aqui — vinda de uma landing ou querendo
  // trocar de papel. NÃO redirecionar; manter o formulário visível.
  useEffect(() => {
    if (authLoading || !user) return;
    if (location.pathname === "/onboarding") return;

    const hasUrlIntent =
      !!searchParams.get("role") ||
      searchParams.get("openRegister") === "true";
    if (hasUrlIntent) return;

    // Com perfil: roteia por role
    if (profile) {
      if (profile.role === "nutritionist") {
        const crnOk = profile.crn_number && isCRNValid(profile.crn_number.trim());
        navigate(crnOk ? "/inicio" : "/onboarding", { replace: true });
        return;
      }
      if (profile.role === "personal_trainer") {
        navigate("/inicio", { replace: true });
        return;
      }
      if (profile.role === "admin") {
        navigate("/inicio", { replace: true });
        return;
      }
      navigate("/inicio", { replace: true });
      return;
    }

    // Sem perfil (trigger ainda não rodou): usa role do metadata do Supabase
    const metaRole = (user.user_metadata?.role ?? undefined) as string | undefined;
    if (metaRole === "nutritionist") navigate("/onboarding", { replace: true });
    else if (metaRole === "personal_trainer") navigate("/inicio", { replace: true });
    else navigate("/inicio", { replace: true });
  }, [user, profile, navigate, authLoading, location.pathname, searchParams]);

  // Abre cadastro quando a URL traz ?openRegister=true OU ?role=...
  // Nunca esconde as outras opções nem pula essa tela.
  useEffect(() => {
    const openRegister = searchParams.get("openRegister") === "true";
    const hasRole = !!searchParams.get("role");
    if (openRegister || hasRole) setIsLogin(false);
  }, [searchParams]);

  // Mantém o seletor de perfil alinhado ao ?role= da URL (landing / links externos)
  // e já registra a intenção de cadastro — assim sobrevive ao redirect do Google OAuth.
  useEffect(() => {
    const r = searchParams.get("role");
    const openRegister = searchParams.get("openRegister") === "true";
    if (r === "nutritionist") {
      setRole("nutritionist");
      if (openRegister) setPendingSignup({ role: "nutritionist" });
    } else if (r === "personal_trainer") {
      setRole("personal_trainer");
      if (openRegister) setPendingSignup({ role: "personal_trainer" });
    } else if (r === "client") {
      setRole("client");
      if (openRegister) setPendingSignup({ role: "client" });
    }
  }, [searchParams]);

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;
    if (googleClickLockRef.current) return;
    googleClickLockRef.current = true;
    setGoogleLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;

      // `signInWithOAuth` ignora `options.data`; persistimos a intenção para o callback reconciliar.
      if (!isLogin) {
        setPendingSignup({
          role,
          fullName: fullName.trim() || undefined,
          crnNumber: role === "nutritionist" ? (crnNumber.trim() || null) : null,
          refCode: refCode || null,
        });
      } else {
        clearPendingSignup();
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      // Redirecionamento para Google; não desligar googleLoading aqui.
    } catch {
      clearPendingSignup();
      toast.error("Erro ao entrar com Google");
      setGoogleLoading(false);
    } finally {
      googleClickLockRef.current = false;
    }
  };

  // ── Envia OTP (e-mail ou telefone) ────────────────────────────────────────
  const sendOtp = async () => {
    if (googleLoading) return;

    setLoading(true);
    try {
      const identifier = authMethod === "email" ? email.trim() : unmaskPhone(phone);
      if (!identifier) throw new Error("Preencha o campo corretamente.");

      const signupMeta = !isLogin
        ? {
            full_name: fullName.trim(),
            role: role,
            crn_number: role === "nutritionist" ? crnNumber : null,
            referred_by: refCode || null,
          }
        : undefined;

      if (authMethod === "email") {
        const { error } = await supabase.auth.signInWithOtp({
          email: identifier,
          options: signupMeta ? { data: signupMeta } : undefined,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          phone: identifier,
          options: signupMeta ? { data: signupMeta } : undefined,
        });
        if (error) throw error;
      }

      setOtpSentTo(identifier);
      setOtpMethod(authMethod);
      setOtpIsSignup(!isLogin);
      setStep("otp");
      toast.success("Código de verificação enviado!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar código";
      const low = msg.toLowerCase();
      const looksLikeEmailDown =
        low.includes("magic link") ||
        low.includes("error sending") ||
        low.includes("smtp") ||
        (low.includes("mail") && low.includes("send")) ||
        low.includes("email rate") ||
        low.includes("535");
      if (looksLikeEmailDown && authMethod === "email") {
        setEmailServiceNotice(true);
        toast.error("E-mail temporariamente indisponível", {
          description: "Use Entrar com Google enquanto o serviço de e-mail está em manutenção.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Verifica OTP ──────────────────────────────────────────────────────────
  const verifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      toast.error("Digite o código completo recebido.");
      return;
    }
    setLoading(true);
    try {
      let error: { message: string } | null = null;

      if (otpMethod === "email") {
        const res = await supabase.auth.verifyOtp({
          email: otpSentTo,
          token: otpCode,
          type: otpIsSignup ? "signup" : "email",
        });
        error = res.error;
      } else {
        const res = await supabase.auth.verifyOtp({
          phone: otpSentTo,
          token: otpCode,
          type: "sms",
        });
        error = res.error;
      }

      if (error) throw new Error(error.message);
      toast.success("Verificação realizada com sucesso!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Código inválido ou expirado.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Cadastro tradicional e-mail + senha ───────────────────────────────────
  const handleSignUp = async () => {
    if (googleLoading) return;

    if (role === "nutritionist" && !isCRNValid(crnNumber)) {
      toast.error("Por favor, informe um CRN válido.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName.trim(),
            role: role,
            crn_number: role === "nutritionist" ? crnNumber : null,
            referred_by: refCode || null,
          },
        },
      });
      if (error) throw error;

      // Com "Confirm email" DESATIVADO no Supabase, o signUp já devolve uma
      // sessão ativa — não precisamos passar pela tela de OTP. Se por qualquer
      // motivo a sessão não vier (ex.: Confirm email reativado no painel),
      // tenta autenticar com a senha recém-cadastrada para garantir o login
      // automático. Em ambos os casos, encaminha direto para /auth/callback,
      // que decide a rota correta por papel.
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      clearPendingSignup();
      toast.success("Conta criada com sucesso!");
      navigate("/auth/callback", { replace: true });
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro no cadastro";
      const low = msg.toLowerCase();
      if (
        low.includes("magic link") ||
        low.includes("error sending") ||
        low.includes("smtp") ||
        low.includes("mail")
      ) {
        setEmailServiceNotice(true);
        toast.error("E-mail temporariamente indisponível", {
          description: "Use Entrar com Google enquanto o serviço de e-mail está em manutenção.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (googleLoading) return;
    if (formSubmitLockRef.current) return;
    formSubmitLockRef.current = true;
    try {
      if (isLogin) {
        if (authMethod === "email" && password) {
          setLoading(true);
          try {
            await signIn(email, password);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Erro ao entrar";
            const low = msg.toLowerCase();

            // Supabase agrupa "usuária não existe" e "senha errada" no mesmo erro
            // por questão de segurança (enumeration attack). Exibimos uma mensagem
            // clara cobrindo ambos os cenários para a Gabs saber o que fazer.
            if (low.includes("invalid login") || low.includes("invalid credentials")) {
              toast.error("E-mail ou senha incorretos", {
                description:
                  "Confira seus dados. Se ainda não tem conta, clique em 'Cadastre-se grátis'. Se esqueceu a senha, use 'Recuperar senha'.",
              });
            } else if (low.includes("email not confirmed") || low.includes("confirm")) {
              toast.error("E-mail ainda não confirmado", {
                description:
                  "Você recebeu um link por e-mail para confirmar a conta. Verifique a caixa de entrada e o spam.",
              });
            } else if (low.includes("too many") || low.includes("rate limit")) {
              toast.error("Muitas tentativas seguidas", {
                description: "Aguarde 1 minuto antes de tentar novamente.",
              });
            } else if (low.includes("user not found")) {
              // Raro, mas caso o Supabase retorne esse erro explicitamente.
              toast.error("Usuária não encontrada", {
                description:
                  "Este e-mail ainda não tem conta. Clique em 'Cadastre-se grátis' para criar uma.",
              });
            } else if (
              low.includes("network") ||
              low.includes("failed to fetch") ||
              low.includes("timeout")
            ) {
              toast.error("Falha de conexão", {
                description: "Verifique sua internet e tente novamente.",
              });
            } else {
              toast.error("Não foi possível entrar", { description: msg });
            }
          } finally {
            setLoading(false);
          }
        } else {
          await sendOtp();
        }
      } else {
        if (authMethod === "phone") await sendOtp();
        else await handleSignUp();
      }
    } finally {
      formSubmitLockRef.current = false;
    }
  };

  // Sessão já confirmada → não renderiza formulário; o useEffect acima redireciona.
  // EXCEÇÃO: quando a URL traz ?role= ou ?openRegister=true, a usuária quer
  // permanecer aqui (ex.: trocar de papel vindo de uma landing). Mantemos o
  // formulário visível com as 3 opções.
  const hasUrlIntent =
    !!searchParams.get("role") ||
    searchParams.get("openRegister") === "true";
  if (!authLoading && user && !hasUrlIntent) return null;

  // ── Tela OTP ──────────────────────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className="flex min-h-screen flex-col bg-background md:flex-row">
        <BrandingPanel />
        <div className="flex min-h-screen w-full flex-1 items-center justify-center p-4 md:w-[55%]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="fixed left-4 top-4 z-50 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--ink-3))] transition-colors hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--ink-1))]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
          <motion.div
            className="mx-auto w-full max-w-sm"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-8 text-center">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex cursor-pointer items-center justify-center gap-2"
              >
                <Leaf className="h-8 w-8 text-primary" />
                <span className="font-display text-2xl font-extrabold text-[hsl(var(--ink-1))]">
                  nutr<span className="text-primary">IA</span>prova
                </span>
              </button>
            </div>
            <div className="rounded-[var(--radius)] border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-6 shadow-sm">
              <h2 className="text-center font-display text-xl font-bold text-[hsl(var(--ink-1))]">
                Verifique seu {otpMethod === "email" ? "E-mail" : "Celular"}
              </h2>
              <p className="mt-1 text-center font-sans text-[0.9rem] text-[hsl(var(--ink-3))]">
                Digite o código de 8 dígitos enviado para{" "}
                <span className="font-medium text-[hsl(var(--ink-2))]">{otpSentTo}</span>
              </p>
              <div className="mt-6 space-y-4">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="00000000"
                  className={cn(
                    authInputClassName,
                    "h-16 text-center text-3xl font-bold tracking-[8px]",
                  )}
                  autoFocus
                />

                <Button
                  onClick={verifyOtp}
                  disabled={loading || googleLoading || otpCode.length < 6}
                  className={cn(
                    "btn-primary h-11 w-full gap-2",
                    "disabled:cursor-wait disabled:opacity-80",
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Confirmar Código"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={sendOtp}
                  disabled={loading || googleLoading}
                  className="w-full font-sans text-sm text-[hsl(var(--ink-3))] disabled:opacity-60"
                >
                  Reenviar código
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setOtpCode("");
                  }}
                  className="w-full text-center font-sans text-sm text-[hsl(var(--ink-3))] hover:underline"
                >
                  Voltar e corrigir dados
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Formulário principal ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <BrandingPanel />

      <div className="relative flex w-full min-h-screen flex-1 flex-col md:w-[55%]">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="fixed left-4 top-4 z-50 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--ink-3))] transition-colors hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--ink-1))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <motion.div
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-8 py-12"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-8 text-center md:hidden">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center justify-center gap-2"
            >
              <Leaf className="h-7 w-7 text-primary" />
              <span className="font-display text-2xl font-extrabold text-brand">NutrIAprova</span>
            </button>
            <p className="mt-2 font-sans text-sm text-[hsl(var(--ink-2))]">Saúde com inteligência e validação real</p>
            {refCode && (
              <p className="mt-1 text-xs font-medium text-primary">
                🔗 Indicado por um Personal Trainer
              </p>
            )}
          </div>

          <div className="md:mb-2 md:mt-0">
            {refCode && (
              <p className="mb-2 hidden text-center text-xs font-medium text-primary md:block">
                🔗 Indicado por um Personal Trainer
              </p>
            )}
            {emailServiceNotice && (
              <Alert className="mb-6">
                <AlertTitle>E-mail em manutenção</AlertTitle>
                <AlertDescription>
                  O envio de links e códigos por e-mail pode falhar ocasionalmente (fila, limites ou spam). Prefira{" "}
                  <strong>Entrar com Google</strong> abaixo — esse fluxo não depende de e-mail.
                </AlertDescription>
              </Alert>
            )}

            <h1 className="font-display text-[1.75rem] font-bold leading-tight text-[hsl(var(--ink-1))]">
              {isLogin ? "Entrar" : "Criar conta"}
            </h1>
            <p className="mt-1 font-sans text-[0.9rem] text-[hsl(var(--ink-3))]">
              {isLogin
                ? "Acesse sua conta para continuar o acompanhamento."
                : "Crie seu perfil e comece em poucos minutos."}
            </p>

            <div className="mb-4 mt-6 flex items-center gap-2">
              {(["email", "phone"] as AuthMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAuthMethod(m)}
                  className={cn(
                    "flex-1 rounded-[var(--radius-sm)] border py-2.5 text-sm font-medium transition-all font-sans",
                    authMethod === m
                      ? "border-primary bg-[hsl(var(--accent))] text-[hsl(var(--ink-1))]"
                      : "border-[hsl(var(--surface-3))] bg-background text-[hsl(var(--ink-3))] hover:border-[hsl(var(--surface-2))]",
                  )}
                >
                  {m === "email" ? "E-mail" : "Telefone"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait" custom={isLogin}>
                <motion.div
                  key={isLogin ? "login" : "signup"}
                  custom={isLogin}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  variants={{
                    initial: (isL: boolean) => ({
                      opacity: 0,
                      x: isL ? 28 : -28,
                    }),
                    animate: { opacity: 1, x: 0 },
                    exit: (isL: boolean) => ({
                      opacity: 0,
                      x: isL ? -28 : 28,
                    }),
                  }}
                  className="space-y-4"
                >
                  {!isLogin && (
                    <>
                      <div>
                        <Label className={authLabelClass} htmlFor="auth-fullname">
                          Nome completo
                        </Label>
                        <Input
                          id="auth-fullname"
                          className={authInputClassName}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Como deseja ser chamado?"
                          required
                        />
                      </div>

                      <div>
                        <span className={authLabelClass}>Perfil</span>
                        <div className="mt-1 flex w-full gap-0.5 rounded-full bg-[hsl(var(--surface-2))] p-1">
                          {[
                            { v: "client" as const, l: "Cliente", i: User },
                            { v: "nutritionist" as const, l: "Nutri", i: Stethoscope },
                            { v: "personal_trainer" as const, l: "Personal", i: Dumbbell },
                          ].map((p) => (
                            <button
                              key={p.v}
                              type="button"
                              onClick={() => setRole(p.v)}
                              className={cn(
                                "flex flex-1 items-center justify-center gap-1 rounded-full py-2 font-sans text-[13px] font-medium transition-shadow",
                                role === p.v
                                  ? "bg-[hsl(var(--surface-0))] text-[hsl(var(--ink-1))] shadow-sm dark:bg-[hsl(var(--surface-1))] dark:shadow-sm"
                                  : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
                              )}
                            >
                              <p.i className="h-3.5 w-3.5 shrink-0" />
                              {p.l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {role === "nutritionist" && (
                        <div>
                          <Label className={authLabelClass} htmlFor="auth-crn">
                            Registro CRN
                          </Label>
                          <Input
                            id="auth-crn"
                            className={authInputClassName}
                            value={crnNumber}
                            onChange={(e) => setCrnNumber(maskCRN(e.target.value))}
                            placeholder="CRN-3 12345"
                            required
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <Label className={authLabelClass} htmlFor={authMethod === "email" ? "auth-email" : "auth-phone"}>
                      {authMethod === "email" ? "Seu e-mail" : "Seu telefone"}
                    </Label>
                    {authMethod === "email" ? (
                      <Input
                        id="auth-email"
                        className={authInputClassName}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                      />
                    ) : (
                      <Input
                        id="auth-phone"
                        className={authInputClassName}
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(maskPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        required
                      />
                    )}
                  </div>

                  {isLogin && authMethod === "email" && (
                    <div>
                      <Label className={authLabelClass} htmlFor="auth-pass-login">
                        Senha
                      </Label>
                      <p className="mb-1.5 font-sans text-xs text-[hsl(var(--ink-3))]">
                        Deixe em branco para receber um código de verificação.
                      </p>
                      <Input
                        id="auth-pass-login"
                        className={authInputClassName}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Vazio → recebe código OTP"
                        minLength={0}
                      />
                      <div className="mt-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => navigate("/recuperar-senha")}
                          className="font-sans text-sm text-primary hover:underline"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                    </div>
                  )}

                  {!isLogin && authMethod === "email" && (
                    <div>
                      <Label className={authLabelClass} htmlFor="auth-pass-signup">
                        Senha
                      </Label>
                      <Input
                        id="auth-pass-signup"
                        className={authInputClassName}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        minLength={6}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    aria-busy={loading}
                    className={cn(
                      "btn-primary h-11 w-full gap-2 text-base font-semibold",
                      (loading || googleLoading) && "pointer-events-none cursor-wait opacity-80",
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        {isLogin ? "Entrando..." : "Criando..."}
                      </>
                    ) : isLogin ? (
                      "Entrar"
                    ) : (
                      "Criar minha conta"
                    )}
                  </Button>
                </motion.div>
              </AnimatePresence>
            </form>

            <GoogleSeparator />

            <div className="mt-0">
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                aria-busy={googleLoading}
                className={cn(
                  "h-11 w-full gap-3 rounded-[var(--radius-sm)] border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] font-sans text-sm font-medium text-[hsl(var(--ink-1))] shadow-sm transition-all",
                  "hover:border-[hsl(var(--surface-2))] hover:bg-[hsl(var(--surface-1))]",
                  (googleLoading || loading) && "pointer-events-none cursor-wait opacity-80",
                )}
              >
                {googleLoading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <GoogleIcon />}
                {googleLoading ? "Conectando..." : "Entrar com Google"}
              </Button>
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-sans text-sm text-[hsl(var(--ink-3))] transition-colors hover:text-primary"
              >
                {isLogin
                  ? "Não tem conta? Cadastre-se grátis"
                  : "Já tem conta? Fazer login"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}