import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { maskPhone, unmaskPhone, maskCRN, isCRNValid } from "@/lib/masks";

const CRN_INVALID_MSG = "CRN inválido, por favor digite novamente seu CRN";

/** Validação simulada do CRN — padrão CRN-X 12345 (mesma regra usada no app). */
export function isNutriCrnSimulated(value: string): boolean {
  return isCRNValid(value.trim());
}

/** Extrai a mensagem de erro preservando detalhes do PostgrestError (code/hint). */
function extractErrorMessage(err: unknown, fallback = "Erro ao salvar"): string {
  if (!err) return fallback;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean) as string[];
    if (parts.length) return parts.join(" — ");
    if (e.code) return `Erro ${e.code}`;
  }
  return fallback;
}

export default function OnboardingNutri() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [crnNumber, setCrnNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [crnError, setCrnError] = useState(false);

  const isGoogle = Boolean(
    user?.app_metadata?.provider === "google" ||
      user?.identities?.some((i) => i.provider === "google"),
  );
  const emailLocked = isGoogle && Boolean(user?.email);

  // Sem sessão → manda para a tela de auth
  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  // Pré-preenche com o que já existe (perfil ou metadata do auth)
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as {
      full_name?: string;
      crn_number?: string;
      phone?: string;
    };
    setFullName((curr) => curr || profile?.full_name || meta.full_name || "");
    setCrnNumber((curr) => curr || profile?.crn_number || meta.crn_number || "");
    setPhone((curr) => curr || (meta.phone ? maskPhone(meta.phone) : ""));
  }, [user, profile]);

  // Nutricionista que já completou o cadastro não precisa repetir o onboarding
  useEffect(() => {
    if (loading || !profile) return;
    if (profile.role === "nutritionist" && isCRNValid((profile.crn_number ?? "").trim())) {
      navigate("/nutri-dashboard", { replace: true });
    }
  }, [loading, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCrnError(false);
    if (!user) return;

    if (!fullName.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!isNutriCrnSimulated(crnNumber)) {
      setCrnError(true);
      return;
    }

    setSaving(true);
    try {
      // `phone` agora vive na própria tabela profiles (migration
      // 20260423140000_add_phone_to_profiles). Mantemos também no user_metadata
      // para compatibilidade com integrações que leem do auth.
      const row = {
        user_id: user.id,
        full_name: fullName.trim(),
        role: "nutritionist" as const,
        crn_number: crnNumber.trim(),
        phone: unmaskPhone(phone) || null,
        credits: profile?.credits ?? 3,
        plan_tier:
          (profile as { plan_tier?: string } | null)?.plan_tier ?? "basic",
        approved: profile?.approved ?? false,
        updated_at: new Date().toISOString(),
      };

      const { error: upErr } = await supabase
        .from("profiles")
        .upsert(row as never, { onConflict: "user_id" });
      if (upErr) throw upErr;

      await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          role: "nutritionist",
          crn_number: crnNumber.trim(),
          phone: unmaskPhone(phone) || null,
        },
      });

      await refreshProfile();
      toast.success("Cadastro concluído!");
      navigate("/nutri-dashboard", { replace: true });
    } catch (err: unknown) {
      // PostgrestError NÃO herda de Error em algumas versões do supabase-js, o
      // que antes fazia o toast cair no fallback genérico "Erro ao salvar" e
      // escondia a causa real (ex.: coluna ausente ou RLS). Extraímos de forma
      // defensiva qualquer campo `message` disponível e logamos o payload bruto.
      console.error("[OnboardingNutri] upsert error:", err);
      const msg = extractErrorMessage(err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToPatient = async () => {
    if (!user) return;
    setSwitching(true);
    setCrnError(false);
    try {
      const row = {
        user_id: user.id,
        full_name: fullName.trim() || profile?.full_name || "",
        role: "client" as const,
        crn_number: null,
        phone: unmaskPhone(phone) || null,
        credits: profile?.credits ?? 0,
        plan_tier:
          (profile as { plan_tier?: string } | null)?.plan_tier ?? "basic",
        approved: profile?.approved ?? false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(row as never, { onConflict: "user_id" });
      if (error) throw error;

      await supabase.auth.updateUser({ data: { role: "client" } });
      await refreshProfile();
      toast.success("Perfil alterado para paciente.");
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      console.error("[OnboardingNutri] switch-to-patient error:", err);
      const msg = extractErrorMessage(err, "Não foi possível alterar o perfil");
      toast.error(msg);
    } finally {
      setSwitching(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2">
        <Leaf className="h-8 w-8 text-primary" />
        <span className="font-display font-bold text-2xl">
          nutr<span className="text-primary">IA</span>prova
        </span>
      </div>

      <Card className="w-full max-w-md glass-card">
        <CardHeader>
          <CardTitle className="font-display">
            Complete seu cadastro — Nutricionista
          </CardTitle>
          <CardDescription>
            Confirme seus dados e informe o CRN para acessar o painel.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome como no CRN"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={user.email ?? ""}
                disabled={emailLocked}
                readOnly={emailLocked}
                className={emailLocked ? "opacity-80" : ""}
              />
              {emailLocked && (
                <p className="text-xs text-muted-foreground">
                  E-mail vinculado ao Google e não pode ser alterado aqui.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label>CRN</Label>
              <Input
                value={crnNumber}
                onChange={(e) => {
                  setCrnNumber(maskCRN(e.target.value));
                  setCrnError(false);
                }}
                placeholder="CRN-3 12345"
                className={crnError ? "border-destructive" : ""}
                required
              />
              <p className="text-xs text-muted-foreground">
                Formato: CRN-X XXXXX (ex.: CRN-3 12345)
              </p>
            </div>

            {crnError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-3">
                <p className="text-sm font-medium text-destructive">
                  {CRN_INVALID_MSG}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={switching}
                  onClick={handleSwitchToPatient}
                >
                  {switching ? "Alterando…" : "Me cadastrar como paciente"}
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full emerald-gradient text-primary-foreground"
              disabled={saving || switching}
            >
              {saving ? "Salvando…" : "Continuar para o painel"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
