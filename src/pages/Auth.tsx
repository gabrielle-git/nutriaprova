import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Leaf, Stethoscope, User, Dumbbell, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { maskPhone, unmaskPhone, maskCRN, isCRNValid } from "@/lib/masks";
import { setPendingSignup, clearPendingSignup } from "@/lib/pendingSignup";
import { trackInviteEvent } from "@/services/inviteAnalytics";

type AuthMethod = "email" | "phone";
type AuthStep   = "form" | "otp";

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
        navigate(crnOk ? "/nutri-dashboard" : "/onboarding", { replace: true });
        return;
      }
      if (profile.role === "personal_trainer") {
        navigate("/personal-dashboard", { replace: true });
        return;
      }
      if (profile.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
      return;
    }

    // Sem perfil (trigger ainda não rodou): usa role do metadata do Supabase
    const metaRole = (user.user_metadata?.role ?? undefined) as string | undefined;
    if (metaRole === "nutritionist") navigate("/onboarding", { replace: true });
    else if (metaRole === "personal_trainer") navigate("/personal-dashboard", { replace: true });
    else navigate("/dashboard", { replace: true });
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
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-lg
                     px-3 py-2 text-sm font-medium text-muted-foreground
                     hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center gap-2 mb-4 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <Leaf className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold font-display">
                nutr<span className="text-primary">IA</span>prova
              </h1>
            </div>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="font-display text-center">
                Verifique seu {otpMethod === "email" ? "E-mail" : "Celular"}
              </CardTitle>
              <CardDescription className="text-center">
                Digite o código de 8 dígitos enviado para{" "}
                <strong>{otpSentTo}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="00000000"
                className="text-center text-3xl tracking-[8px] font-bold h-16"
                autoFocus
              />

              <Button
                onClick={verifyOtp}
                disabled={loading || googleLoading || otpCode.length < 6}
                className="w-full emerald-gradient text-primary-foreground h-12"
              >
                {loading ? "Verificando..." : "Confirmar Código"}
              </Button>

              <Button
                variant="ghost"
                onClick={sendOtp}
                disabled={loading || googleLoading}
                className="w-full text-sm text-muted-foreground"
              >
                Reenviar código
              </Button>

              <button
                onClick={() => { setStep("form"); setOtpCode(""); }}
                className="text-sm text-muted-foreground hover:underline w-full text-center"
              >
                Voltar e corrigir dados
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Formulário principal ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">

      {/* ── Botão Voltar ─────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Voltar"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-lg
                   px-3 py-2 text-sm font-medium text-muted-foreground
                   hover:bg-accent hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-2 mb-4 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Leaf className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold font-display">
              nutr<span className="text-primary">IA</span>prova
            </h1>
          </div>
          <p className="text-muted-foreground">Saúde com inteligência e validação real</p>
          {refCode && (
            <p className="text-xs text-primary mt-1 font-medium">
              🔗 Indicado por um Personal Trainer
            </p>
          )}
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display">
              {isLogin ? "Entrar" : "Criar Conta"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {emailServiceNotice && (
              <Alert>
                <AlertTitle>E-mail em manutenção</AlertTitle>
                <AlertDescription>
                  O envio de links e códigos por e-mail pode falhar ocasionalmente (fila, limites ou spam).
                  Prefira <strong>Entrar com Google</strong> abaixo — esse fluxo não depende de e-mail.
                </AlertDescription>
              </Alert>
            )}

            {/* Google — fluxo principal recomendado */}
            <div className="space-y-1">
              <p className="text-xs text-center text-muted-foreground">Recomendado</p>
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full gap-3 h-12 bg-card border-2 border-primary text-foreground hover:bg-accent"
              >
                <GoogleIcon />
                {googleLoading ? "Conectando..." : "Entrar com Google"}
              </Button>
            </div>

            {/* Método */}
            <div className="flex items-center gap-2">
              {(["email", "phone"] as AuthMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAuthMethod(m)}
                  className={`flex-1 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                    authMethod === m
                      ? "border-primary bg-accent"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {m === "email" ? "E-mail" : "Telefone"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campos de cadastro */}
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Como deseja ser chamado?"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: "client",           l: "Cliente",   i: User },
                        { v: "nutritionist",     l: "Nutri",     i: Stethoscope },
                        { v: "personal_trainer", l: "Personal",  i: Dumbbell },
                      ].map((p) => (
                        <button
                          key={p.v}
                          type="button"
                          onClick={() => setRole(p.v as typeof role)}
                          className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all ${
                            role === p.v
                              ? "border-primary bg-accent"
                              : "border-border opacity-60"
                          }`}
                        >
                          <p.i className="h-4 w-4 mb-1" />
                          <span className="text-[10px] font-bold">{p.l}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {role === "nutritionist" && (
                    <div className="space-y-2">
                      <Label>Registro CRN</Label>
                      <Input
                        value={crnNumber}
                        onChange={(e) => setCrnNumber(maskCRN(e.target.value))}
                        placeholder="CRN-3 12345"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              {/* E-mail ou telefone */}
              <div className="space-y-2">
                <Label>{authMethod === "email" ? "Seu E-mail" : "Seu Telefone"}</Label>
                {authMethod === "email" ? (
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />
                ) : (
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    required
                  />
                )}
              </div>

              {/* Senha apenas no login por e-mail */}
              {isLogin && authMethod === "email" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Senha (deixe em branco para receber código)</Label>
                    <button
                      type="button"
                      onClick={() => navigate("/recuperar-senha")}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Vazio → recebe código OTP"
                    minLength={0}
                  />
                </div>
              )}

              {!isLogin && authMethod === "email" && (
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
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
                disabled={loading || googleLoading}
                className="w-full emerald-gradient text-primary-foreground h-12 text-base font-bold shadow-lg"
              >
                {loading
                  ? "Processando..."
                  : isLogin
                  ? "Entrar"
                  : "Criar Minha Conta"}
              </Button>
            </form>

            <div className="text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin
                  ? "Não tem conta? Cadastre-se grátis"
                  : "Já tem conta? Fazer login"}
              </button>
            </div>
          </CardContent>
        </Card>
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