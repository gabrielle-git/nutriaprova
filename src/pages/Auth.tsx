import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AnimatePresence, motion } from "framer-motion";
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

const BRAND_TITLE_WORDS = ["NutrI", "Aprova"] as const;

function BrandingPanel() {
  const bullets = [
    "Plano alimentar gerado por IA em segundos",
    "Acompanhamento real com seu nutricionista",
    "Resultados comprovados por +2.000 usuários",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="bg-aurora bg-grid relative hidden min-h-screen w-[45%] flex-col overflow-hidden p-10 text-[hsl(var(--ink-1))] md:flex"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(158 72% 32% / 0.22) 0%, transparent 65%)" }}
          animate={{ scale: [1, 1.12, 1], x: [0, 24, 0], y: [0, -16, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-24 top-1/3 h-[320px] w-[320px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(172 60% 38% / 0.16) 0%, transparent 65%)" }}
          animate={{ scale: [1, 1.08, 1], x: [0, -18, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-20 left-1/4 h-[280px] w-[280px] rounded-full"
          style={{ background: "radial-gradient(circle, hsl(142 55% 28% / 0.12) 0%, transparent 68%)" }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-end">
      <div className="relative z-10">
        <div className="flex items-center gap-2.5">
          <Leaf className="h-9 w-9 shrink-0 text-primary" strokeWidth={1.75} />
          <h1 className="font-display text-[2.5rem] font-extrabold leading-tight">
            {BRAND_TITLE_WORDS.map((word, i) => (
              <span key={word} className="inline-block overflow-hidden align-bottom">
                <motion.span
                  className={
                    word === "Aprova"
                      ? "inline-block text-brand-animated"
                      : "inline-block text-[hsl(var(--ink-1))]"
                  }
                  initial={{ y: "110%", opacity: 0, skewY: 3 }}
                  animate={{ y: "0%", opacity: 1, skewY: 0 }}
                  transition={{ duration: 0.65, delay: 0.06 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </h1>
        </div>
        <p className="mt-2 max-w-sm font-sans text-base font-normal text-[hsl(var(--ink-2))]">
          Nutrição clínica com inteligência artificial e validação humana.
        </p>
        <div className="my-8 h-px w-full max-w-sm bg-[hsl(var(--surface-3))]" />
        <ul className="max-w-sm space-y-3">
          {bullets.map((line, index) => (
            <motion.li
              key={line}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              whileHover={{ x: 4 }}
              className="flex gap-2.5 font-sans text-sm font-normal text-[hsl(var(--ink-2))]"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
              <span>{line}</span>
            </motion.li>
          ))}
        </ul>
      </div>

      <motion.figure
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="relative z-10 mt-8 rounded-[var(--radius)] border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))]/60 p-4 pt-8 backdrop-blur-sm"
      >
        <span
          className="pointer-events-none absolute left-2 top-0 font-serif text-[4.5rem] leading-none text-[hsl(var(--primary)_/_0.1)]"
          aria-hidden
        >
          &ldquo;
        </span>
        <blockquote className="relative z-[1] font-sans text-sm leading-relaxed text-[hsl(var(--ink-2))]">
          {BRAND_TESTIMONIAL.quote}
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
            <p className="font-sans text-sm font-semibold text-[hsl(var(--ink-1))]">{BRAND_TESTIMONIAL.name}</p>
            <p className="font-sans text-xs text-[hsl(var(--ink-3))]">{BRAND_TESTIMONIAL.role}</p>
          </div>
        </figcaption>
      </motion.figure>
      </div>
    </motion.div>
  );
}

function FormParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <motion.span
          key={i}
          className={cn(
            "absolute rounded-full",
            i % 2 === 0 ? "h-2 w-2" : "h-1 w-1",
          )}
          style={{
            left: `${(i * 17 + 7) % 92}%`,
            bottom: `${8 + (i * 11) % 35}%`,
            backgroundColor: "hsl(var(--primary-glow) / 0.15)",
          }}
          animate={{
            y: [0, -200],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 6 + (i % 7),
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.35,
          }}
        />
      ))}
    </div>
  );
}

type AuthAnimatedFieldProps = {
  id: string;
  label: string;
  value: string;
  children: (fieldProps: { onFocus: () => void; onBlur: () => void; className: string }) => React.ReactNode;
};

function AuthAnimatedField({ id, label, value, children }: AuthAnimatedFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasValue = value.trim().length > 0;

  const fieldClass = cn(authInputClassName, "relative z-[1] bg-transparent pt-5");

  return (
    <div className="relative">
      <motion.div
        animate={focused ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.15 }}
        className="relative rounded-[var(--radius-sm)] border border-[hsl(var(--surface-3))] bg-background shadow-sm"
      >
        <motion.label
          htmlFor={id}
          className="pointer-events-none absolute left-3 top-[13px] z-[2] block origin-left font-sans text-[13px] font-medium"
          animate={
            focused || hasValue
              ? { y: -4, scale: 0.85, color: "hsl(var(--primary))" }
              : { y: 0, scale: 1, color: "hsl(var(--ink-2))" }
          }
          transition={{ duration: 0.15 }}
        >
          {label}
        </motion.label>
        {children({
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          className: cn(fieldClass, "border-0 shadow-none focus-visible:ring-0"),
        })}
        <motion.div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 z-[2] rounded-full"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: focused ? 1 : 0 }}
          style={{
            transformOrigin: "left",
            height: "2px",
            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)))",
          }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>
    </div>
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
  const [submitPulse, setSubmitPulse] = useState<null | "success" | "error">(null);
  const formSubmitLockRef = useRef(false);
  const googleClickLockRef = useRef(false);

  useEffect(() => {
    if (!submitPulse) return;
    const t = window.setTimeout(() => setSubmitPulse(null), 1400);
    return () => window.clearTimeout(t);
  }, [submitPulse]);

  useEffect(() => {
    setSubmitPulse(null);
  }, [isLogin, role]);

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
      setSubmitPulse("error");
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
      setSubmitPulse("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Código inválido ou expirado.";
      toast.error(msg);
      setSubmitPulse("error");
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
      setSubmitPulse("success");
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
      setSubmitPulse("error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitPulse(null);
    if (googleLoading) return;
    if (formSubmitLockRef.current) return;
    formSubmitLockRef.current = true;
    try {
      if (isLogin) {
        if (authMethod === "email" && password) {
          setLoading(true);
          try {
            await signIn(email, password);
            setSubmitPulse("success");
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
            setSubmitPulse("error");
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
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="relative flex min-h-screen w-full flex-1 items-center justify-center p-4 md:w-[55%]"
        >
          <FormParticles />
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
            className="relative z-10 mx-auto w-full max-w-sm"
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
        </motion.div>
      </div>
    );
  }

  // ── Formulário principal ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <BrandingPanel />

      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="relative flex w-full min-h-screen flex-1 flex-col md:w-[55%]"
      >
        <FormParticles />
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
          className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-start px-8 pb-12 pt-24 md:pt-28"
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
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${role}${isLogin ? "login" : "signup"}`}
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  {!isLogin && (
                    <>
                      <AuthAnimatedField id="auth-fullname" label="Nome completo" value={fullName}>
                        {({ onFocus, onBlur, className }) => (
                          <Input
                            id="auth-fullname"
                            className={className}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            onFocus={onFocus}
                            onBlur={onBlur}
                            placeholder=""
                            autoComplete="name"
                            required
                          />
                        )}
                      </AuthAnimatedField>

                      <div>
                        <span className={authLabelClass}>Perfil</span>
                        <div className="relative mt-1 flex w-full gap-0.5 rounded-full bg-[hsl(var(--surface-2))] p-1">
                          {[
                            { v: "client" as const, l: "Cliente", i: User },
                            { v: "nutritionist" as const, l: "Nutri", i: Stethoscope },
                            { v: "personal_trainer" as const, l: "Personal", i: Dumbbell },
                          ].map((p) => {
                            const RIcon = p.i;
                            return (
                              <button
                                key={p.v}
                                type="button"
                                onClick={() => setRole(p.v)}
                                className={cn(
                                  "relative z-0 flex flex-1 items-center justify-center gap-1 rounded-full py-2 font-sans text-[13px] font-medium transition-shadow",
                                  role === p.v
                                    ? "text-slate-900 dark:text-slate-900"
                                    : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
                                )}
                              >
                                {role === p.v && (
                                  <motion.div
                                    layoutId="role-tab-bg"
                                    className="absolute inset-0 z-0 rounded-full bg-white shadow-sm dark:bg-white"
                                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                  />
                                )}
                                <span className="relative z-10 flex items-center justify-center gap-1">
                                  <RIcon
                                    className={cn(
                                      "h-3.5 w-3.5 shrink-0",
                                      role === p.v && "text-slate-900 dark:text-slate-900",
                                    )}
                                  />
                                  {p.l}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {role === "nutritionist" && (
                        <AuthAnimatedField id="auth-crn" label="Registro CRN" value={crnNumber}>
                          {({ onFocus, onBlur, className }) => (
                            <Input
                              id="auth-crn"
                              className={className}
                              value={crnNumber}
                              onChange={(e) => setCrnNumber(maskCRN(e.target.value))}
                              onFocus={onFocus}
                              onBlur={onBlur}
                              placeholder=""
                              required
                            />
                          )}
                        </AuthAnimatedField>
                      )}
                    </>
                  )}

                  {authMethod === "email" ? (
                    <AuthAnimatedField id="auth-email" label="Seu e-mail" value={email}>
                      {({ onFocus, onBlur, className }) => (
                        <Input
                          id="auth-email"
                          className={className}
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onFocus={onFocus}
                          onBlur={onBlur}
                          placeholder=""
                          autoComplete="email"
                          required
                        />
                      )}
                    </AuthAnimatedField>
                  ) : (
                    <AuthAnimatedField id="auth-phone" label="Seu telefone" value={phone}>
                      {({ onFocus, onBlur, className }) => (
                        <Input
                          id="auth-phone"
                          className={className}
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(maskPhone(e.target.value))}
                          onFocus={onFocus}
                          onBlur={onBlur}
                          placeholder=""
                          autoComplete="tel"
                          required
                        />
                      )}
                    </AuthAnimatedField>
                  )}

                  {isLogin && authMethod === "email" && (
                    <div>
                      <p className="mb-1.5 font-sans text-xs text-[hsl(var(--ink-3))]">
                        Deixe em branco para receber um código de verificação.
                      </p>
                      <AuthAnimatedField id="auth-pass-login" label="Senha" value={password}>
                        {({ onFocus, onBlur, className }) => (
                          <Input
                            id="auth-pass-login"
                            className={className}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={onFocus}
                            onBlur={onBlur}
                            placeholder=""
                            autoComplete="current-password"
                            minLength={0}
                          />
                        )}
                      </AuthAnimatedField>
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
                    <AuthAnimatedField id="auth-pass-signup" label="Senha" value={password}>
                      {({ onFocus, onBlur, className }) => (
                        <Input
                          id="auth-pass-signup"
                          className={className}
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={onFocus}
                          onBlur={onBlur}
                          placeholder=""
                          autoComplete="new-password"
                          required
                          minLength={6}
                        />
                      )}
                    </AuthAnimatedField>
                  )}

                  <motion.div
                    className="w-full"
                    whileHover={{ scale: loading || googleLoading ? 1 : 1.02 }}
                    whileTap={{ scale: loading || googleLoading ? 1 : 0.97 }}
                  >
                    <Button
                      type="submit"
                      aria-busy={loading}
                      disabled={loading || googleLoading}
                      className={cn(
                        "btn-primary relative h-11 w-full overflow-hidden text-base font-semibold",
                        (loading || googleLoading) && "pointer-events-none cursor-wait opacity-80",
                      )}
                    >
                      <span className="flex min-h-[1.25rem] w-full items-center justify-center gap-2">
                        <AnimatePresence mode="wait">
                          {loading ? (
                            <motion.div
                              key="loading"
                              className="flex items-center justify-center"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <motion.svg
                                className="h-5 w-5 shrink-0 text-primary-foreground"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                aria-hidden
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              >
                                <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                                <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                              </motion.svg>
                              <span className="sr-only">{isLogin ? "Entrando…" : "Criando…"}</span>
                            </motion.div>
                          ) : submitPulse === "success" ? (
                            <motion.div
                              key="success"
                              className="flex items-center justify-center"
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{ type: "spring", stiffness: 400, damping: 12 }}
                            >
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 14 }}
                              >
                                <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
                              </motion.span>
                              <span className="sr-only">Concluído</span>
                            </motion.div>
                          ) : submitPulse === "error" ? (
                            <motion.span key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              {isLogin ? "Tentar entrar de novo" : "Corrigir e criar conta"}
                            </motion.span>
                          ) : (
                            <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              {isLogin ? "Entrar" : "Criar minha conta"}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </Button>
                  </motion.div>
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
      </motion.div>
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