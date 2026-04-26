import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Leaf, ArrowLeft, User, Sun, Moon, Monitor, Bell,
  Shield, Save, CreditCard, Lock, Wallet, ExternalLink, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ClinicLogoUpload from "@/components/ClinicLogoUpload";
import PlansModal from "@/components/PlansModal";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

// ── Label do plano atual ─────────────────────────────────────────
const TIER_LABELS: Record<string, string> = {
  freemium: "Freemium",
  basic:    "Basic",
  premium:  "Premium",
  clinic:   "Clínica",
};

export default function Configuracoes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();

  const [fullName, setFullName]   = useState(profile?.full_name || "");
  const [birthDate, setBirthDate] = useState<string>(
    // birth_date é opcional e só foi adicionado recentemente à tabela `profiles`
    // (migration 20260423120000). Lemos via `as any` para não travar o build
    // antes do supabase-types ser regenerado.
    (profile as any)?.birth_date ?? "",
  );
  // Bloqueio de idade: uma vez preenchida no onboarding, a Data de Nascimento
  // vira somente leitura (integridade dos cálculos nutricionais). Snapshot
  // feito no momento em que o profile chega do banco — edições locais não
  // contam como "preenchido no banco".
  const birthDateLocked = !!((profile as any)?.birth_date);
  const [saving, setSaving]       = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [plansOpen, setPlansOpen] = useState(
    // Abre direto na aba de planos se vier de ?tab=plano
    searchParams.get("tab") === "plano",
  );

  // Notification prefs (local state)
  const [notifEmail, setNotifEmail]         = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(true);

  // Push real — Service Worker + permissão do navegador
  const {
    supported: pushSupported,
    permission: pushPermission,
    enabled: notifPush,
    enable: enablePush,
    disable: disablePush,
  } = usePushNotifications();

  const handleTogglePush = async (checked: boolean) => {
    if (!pushSupported) {
      toast.error("Navegador não suporta notificações push", {
        description:
          "Tente usar o Chrome, Edge ou Firefox em desktop/Android. iOS só suporta quando o app é adicionado à tela inicial.",
      });
      return;
    }

    if (checked) {
      const ok = await enablePush();
      if (ok) {
        toast.success("Notificações push ativadas!", {
          description: "Você deve ter recebido uma notificação de teste agora.",
        });
      } else if (pushPermission === "denied" || Notification.permission === "denied") {
        toast.error("Permissão bloqueada no navegador", {
          description:
            "Abra o cadeado na barra de endereço → Notificações → Permitir, e tente novamente.",
        });
      } else {
        toast.warning("Não foi possível ativar as notificações.", {
          description: "Verifique se você concedeu permissão ao navegador.",
        });
      }
    } else {
      disablePush();
      toast.info("Notificações push desativadas.");
    }
  };

  const isNutri = profile?.role === "nutritionist";
  const tier    = (profile as any)?.plan_tier as string | undefined;
  const SUPREME_EMAIL = "helena.gaby31@gmail.com";
  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  // Logo da clínica é feature exclusiva do plano Clínica (white-label).
  // Esconder por completo para quem não é Clínica para não poluir Basic/Premium.
  const canSeeClinicLogo =
    (profile?.role === "nutritionist" || profile?.role === "admin") &&
    (tier === "clinic" || isSupreme);

  // ── Salvar dados da conta (nome + data de nascimento) ───────
  const handleSaveAccount = async () => {
    if (!user || !fullName.trim()) return;
    setSaving(true);

    // `birth_date` é coluna DATE no Postgres — mandamos string vazia como NULL
    // para limpar um valor antigo e evitar "invalid input syntax for type date".
    const payload: Record<string, unknown> = {
      full_name: fullName.trim(),
      birth_date: birthDate ? birthDate : null,
    };

    const { error } = await (supabase as any)
      .from("profiles")
      .update(payload)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao salvar dados da conta.", {
        description: error.message,
      });
    } else {
      await refreshProfile();
      toast.success("Dados da conta atualizados com sucesso!");
    }
    setSaving(false);
  };

  const getInitialsForAvatar = (name: string, email: string) => {
    const n = name.trim();
    if (n) {
      const p = n.split(/\s+/).filter(Boolean);
      if (p.length >= 2) return `${p[0][0] ?? ""}${p[p.length - 1][0] ?? ""}`.toUpperCase();
      return n.slice(0, 2).toUpperCase();
    }
    return (email || "?").slice(0, 2).toUpperCase();
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }
    setAvatarUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setAvatarUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user.id);
    if (updateError) {
      toast.error("Erro ao salvar a foto: " + updateError.message);
    } else {
      await refreshProfile();
      toast.success("Foto de perfil atualizada!");
    }
    setAvatarUploading(false);
  };

  const themeOptions: { value: "light" | "dark" | "system"; label: string; icon: typeof Sun }[] = [
    { value: "light",  label: "Claro",   icon: Sun     },
    { value: "dark",   label: "Escuro",  icon: Moon    },
    { value: "system", label: "Sistema", icon: Monitor },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/inicio")}>
          <Leaf className="h-5 w-5 text-primary" />
          <span className="font-display font-bold">
            Nutr<span className="text-primary">IA</span>prova
          </span>
        </div>
        <span className="text-sm text-muted-foreground ml-2">/ Configurações</span>
      </header>

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-display font-bold">Configurações</h1>

        <Tabs defaultValue="conta" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conta" className="gap-1.5 text-xs sm:text-sm">
              <User className="h-4 w-4" /> Conta
            </TabsTrigger>
            <TabsTrigger value="aparencia" className="gap-1.5 text-xs sm:text-sm">
              <Sun className="h-4 w-4" /> Aparência
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="gap-1.5 text-xs sm:text-sm">
              <Bell className="h-4 w-4" /> Notificações
            </TabsTrigger>
          </TabsList>

          {/* ── ABA: CONTA ─────────────────────────────────────── */}
          <TabsContent value="conta" className="space-y-4">
            {/* Dados pessoais */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">Dados da Conta</CardTitle>
                <CardDescription>Gerencie suas informações pessoais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarFile}
                  />
                  <Avatar className="h-20 w-20 border border-border/60 shadow-sm">
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt="Foto de perfil" className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                      {getInitialsForAvatar(fullName || profile?.full_name || "", user?.email || "")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-sm font-medium">Foto de perfil</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 2MB. Aparece no app e na comunidade.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 mt-1"
                      disabled={avatarUploading}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4" />
                      {avatarUploading ? "Enviando..." : "Alterar foto"}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Nome (editável) */}
                <div className="space-y-2">
                  <Label htmlFor="full-name">Nome Completo</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                {/* Data de Nascimento — bloqueada quando já preenchida no banco. */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="birth-date">Data de Nascimento</Label>
                    {birthDateLocked && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 flex items-center gap-1"
                      >
                        <Lock className="h-2.5 w-2.5" />
                        Somente leitura
                      </Badge>
                    )}
                  </div>
                  <Input
                    id="birth-date"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    disabled={birthDateLocked}
                    className={`max-w-xs ${birthDateLocked ? "opacity-70 cursor-not-allowed bg-muted/40" : ""}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {birthDateLocked
                      ? "A data de nascimento é bloqueada após o onboarding para preservar a integridade dos cálculos nutricionais. Em caso de erro, entre em contato com o suporte."
                      : "Usada para personalizar recomendações nutricionais por faixa etária."}
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveAccount}
                    disabled={saving}
                    className="gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                </div>

                <Separator />

                {/* E-mail (somente leitura) */}
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={user?.email || ""} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado por aqui.</p>
                </div>

                {/* Telefone (somente leitura, se houver) */}
                {user?.phone && (
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={user.phone} disabled className="opacity-60" />
                  </div>
                )}

                {/* ── CRN — SOMENTE LEITURA PARA NUTRICIONISTAS ── */}
                {isNutri && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>CRN (Registro Profissional)</Label>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 flex items-center gap-1"
                      >
                        <Lock className="h-2.5 w-2.5" />
                        Somente leitura
                      </Badge>
                    </div>
                    <Input
                      value={profile?.crn_number ? `CRN-${profile.crn_number}` : "—"}
                      readOnly
                      disabled
                      className="opacity-70 cursor-not-allowed bg-muted/40"
                    />
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Lock className="h-3 w-3 flex-shrink-0 mt-0.5 text-amber-600" />
                      O CRN é bloqueado após o cadastro para garantir a integridade das validações.
                      Em caso de erro, entre em contato com o suporte.
                    </p>
                  </div>
                )}

                {/* CRN para não-nutricionistas (se existir por algum motivo) */}
                {!isNutri && profile?.crn_number && (
                  <div className="space-y-2">
                    <Label>CRN</Label>
                    <Input value={`CRN-${profile.crn_number}`} disabled className="opacity-60" />
                  </div>
                )}

                <Separator />

                {/* Role e plano atual */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>
                    Perfil:{" "}
                    <strong className="text-foreground capitalize">{profile?.role || "—"}</strong>
                  </span>
                  {tier && (
                    <>
                      <span>•</span>
                      <span>
                        Plano:{" "}
                        <strong className="text-foreground">
                          {TIER_LABELS[tier] ?? tier}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Planos e assinaturas — OCULTO para clientes.
                Clientes compram cardápios avulsos (R$ 39,90), não assinam planos.
                A badge "Perfil: Client | Plano: Basic" acima continua visível. */}
            {profile?.role !== "client" && (
              <Card className="glass-card border-primary/30">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-display font-semibold text-sm">Planos e Assinaturas</p>
                      <p className="text-xs text-muted-foreground">
                        Plano atual:{" "}
                        <strong className="capitalize">
                          {TIER_LABELS[tier ?? "freemium"] ?? "Freemium"}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => navigate("/planos")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver Planos
                    </Button>
                    <Button
                      onClick={() => setPlansOpen(true)}
                      className="emerald-gradient text-primary-foreground gap-1.5"
                      size="sm"
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Fazer Upgrade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Chave PIX — somente nutricionistas */}
            {isNutri && (
              <Card className="glass-card">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-display font-semibold text-sm">Chave PIX para Saques</p>
                      <p className="text-xs text-muted-foreground">
                        {(profile as any)?.pix_key
                          ? `Chave cadastrada: ${(profile as any).pix_key.type?.toUpperCase()}`
                          : "Nenhuma chave cadastrada ainda"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate("/cadastro-pix")}
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    {(profile as any)?.pix_key ? "Editar Chave" : "Cadastrar Chave"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Logo da clínica — exclusivo do Plano Clínica (white-label) */}
            {canSeeClinicLogo && (
              <div className="mt-4">
                <ClinicLogoUpload />
              </div>
            )}
          </TabsContent>

          {/* ── ABA: APARÊNCIA ─────────────────────────────────── */}
          <TabsContent value="aparencia">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">Tema Visual</CardTitle>
                <CardDescription>Escolha como o nutrIAprova aparece para você</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {themeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                        <span className="text-sm font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ABA: NOTIFICAÇÕES ──────────────────────────────── */}
          <TabsContent value="notificacoes">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display text-lg">Preferências de Notificação</CardTitle>
                <CardDescription>Controle como e quando receber avisos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Notificações por E-mail</p>
                    <p className="text-xs text-muted-foreground">Receba atualizações sobre suas dietas</p>
                  </div>
                  <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="pr-3">
                    <p className="text-sm font-medium">Notificações Push</p>
                    <p className="text-xs text-muted-foreground">
                      Alertas instantâneos no navegador — validações, pagamentos e novos leads.
                    </p>
                    {!pushSupported && (
                      <p className="text-[11px] text-destructive mt-1">
                        Seu navegador não suporta push nativo.
                      </p>
                    )}
                    {pushSupported && pushPermission === "denied" && (
                      <p className="text-[11px] text-destructive mt-1">
                        Permissão bloqueada — libere nas configurações do navegador (cadeado da URL).
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={notifPush}
                    onCheckedChange={handleTogglePush}
                    disabled={!pushSupported || pushPermission === "denied"}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">E-mails de Marketing</p>
                    <p className="text-xs text-muted-foreground">Promoções e novidades da plataforma</p>
                  </div>
                  <Switch checked={notifMarketing} onCheckedChange={setNotifMarketing} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <PlansModal
        open={plansOpen}
        onOpenChange={setPlansOpen}
        currentTier={tier ?? "freemium"}
      />
    </div>
  );
}