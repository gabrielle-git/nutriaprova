import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Leaf, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function hasCompleteName(name: string): boolean {
  const normalized = name.trim().replace(/\s+/g, " ");
  return normalized.length >= 3 && normalized.includes(" ");
}

function normalizeRole(role: string | null | undefined): "client" | "nutritionist" | "personal_trainer" | "admin" {
  if (role === "nutritionist") return "nutritionist";
  if (role === "personal_trainer") return "personal_trainer";
  if (role === "admin") return "admin";
  return "client";
}

export default function ConfirmarNomeCompleto() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, refreshProfile, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  const nextRoute = useMemo(() => searchParams.get("next") || "/inicio", [searchParams]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    const currentName = (profile?.full_name ?? "").trim();
    if (currentName && hasCompleteName(currentName)) {
      navigate(nextRoute, { replace: true });
      return;
    }

    const metaName = (user.user_metadata?.full_name ?? user.user_metadata?.name ?? "") as string;
    setFullName(currentName || metaName || "");
  }, [loading, user, profile?.full_name, navigate, nextRoute]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const normalized = fullName.trim().replace(/\s+/g, " ");
    if (!hasCompleteName(normalized)) {
      toast.error("Informe nome e sobrenome para emissão de documentos.");
      return;
    }

    setSaving(true);
    try {
      const roleFromProfile = normalizeRole(profile?.role ?? (user.user_metadata?.role as string | undefined) ?? "client");
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            role: roleFromProfile,
            full_name: normalized,
            crn_number: profile?.crn_number ?? null,
          },
          { onConflict: "user_id" },
        );
      if (upsertErr) throw upsertErr;

      const { error: metaErr } = await supabase.auth.updateUser({
        data: { full_name: normalized },
      });
      if (metaErr) throw metaErr;

      await refreshProfile();
      toast.success("Nome completo confirmado com sucesso!");
      navigate(nextRoute, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Não foi possível salvar seu nome.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="glass-card w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="font-display font-bold text-lg">
              Nutr<span className="text-brand-animated">IAprova</span>
            </span>
          </div>
          <CardTitle className="font-display text-xl">Confirme seu nome completo</CardTitle>
          <CardDescription>
            Por favor, confirme seu nome completo para a emissão dos seus documentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name-confirm">Nome completo</Label>
              <Input
                id="full-name-confirm"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex.: Maria da Silva Souza"
                autoComplete="name"
                required
              />
              <p className="text-xs text-muted-foreground">
                Informe nome e sobrenome. Esse dado é usado nos documentos emitidos pela plataforma.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full emerald-gradient text-primary-foreground gap-2"
              disabled={saving}
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
