import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Upload, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";

const SUPREME_EMAIL = "helena.gaby31@gmail.com";

export default function ClinicLogoUpload() {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isSupreme = user?.email?.toLowerCase() === SUPREME_EMAIL.toLowerCase();
  const planTier = (profile as any)?.plan_tier || "basic";
  const hasAccess = planTier === "clinic" || isSupreme;
  const logoUrl = (profile as any)?.clinic_logo_url as string | undefined;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("clinic-logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("clinic-logos").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ clinic_logo_url: publicUrl } as any)
      .eq("user_id", user.id);

    if (updateError) {
      toast.error("Erro ao salvar: " + updateError.message);
    } else {
      await refreshProfile();
      toast.success("Logotipo da clínica atualizado!");
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ clinic_logo_url: null } as any).eq("user_id", user.id);
    await refreshProfile();
    toast.success("Logotipo removido.");
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Logotipo da Clínica
          {!hasAccess && (
            <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Plano Clínica
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {hasAccess
            ? "Sua marca aparecerá em todos os PDFs de dieta enviados aos clientes (white-label)."
            : "Disponível exclusivamente para assinantes do Plano Clínica."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAccess ? (
          <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Lock className="h-6 w-6 mx-auto mb-2 opacity-50" />
            Faça upgrade para o Plano Clínica para personalizar seus PDFs com a marca da sua clínica.
          </div>
        ) : (
          <>
            {logoUrl ? (
              <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-muted/30">
                <img
                  src={logoUrl}
                  alt="Logo da clínica"
                  className="w-20 h-20 object-contain rounded bg-background border border-border"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Logo ativo</p>
                  <p className="text-xs text-muted-foreground">Será exibido em todos os PDFs gerados.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemove} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-primary/30 p-6 text-center">
                <Building2 className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum logotipo enviado ainda.</p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full gap-2"
              variant={logoUrl ? "outline" : "default"}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Enviando..." : logoUrl ? "Substituir Logotipo" : "Upload de Logotipo da Clínica"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG ou SVG. Máximo 2MB. Recomendado: 400x400px.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
