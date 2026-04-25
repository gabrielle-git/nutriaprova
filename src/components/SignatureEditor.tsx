import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Pen, Save, Eye } from "lucide-react";
import { toast } from "sonner";

interface SignatureData {
  fullName: string;
  crnNumber: string;
  specialty: string;
  signatureStyle: "classic" | "modern" | "minimal";
}

const SPECIALTIES = [
  "Nutrição Clínica",
  "Nutrição Esportiva",
  "Nutrição Funcional",
  "Nutrição Materno-Infantil",
  "Nutrição Hospitalar",
  "Nutrição Comportamental",
  "Fitoterapia",
  "Outro",
];

export default function SignatureEditor() {
  const { profile, user, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signature, setSignature] = useState<SignatureData>({
    fullName: profile?.full_name || "",
    crnNumber: profile?.crn_number || "",
    specialty: "Nutrição Clínica",
    signatureStyle: "modern",
  });

  useEffect(() => {
    if (profile) {
      setSignature((s) => ({
        ...s,
        fullName: profile.full_name || s.fullName,
        crnNumber: profile.crn_number || s.crnNumber,
      }));
    }
  }, [profile]);

  const handleSave = async () => {
    if (!signature.fullName.trim() || !signature.crnNumber.trim()) {
      toast.error("Nome completo e CRN são obrigatórios na assinatura.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: signature.fullName, crn_number: signature.crnNumber })
        .eq("user_id", user!.id);
      if (error) throw error;
      await refreshProfile();
      setEditing(false);
      toast.success("Assinatura atualizada com sucesso!");
    } catch {
      toast.error("Erro ao salvar assinatura");
    } finally {
      setSaving(false);
    }
  };

  const renderSignaturePreview = () => {
    const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    if (signature.signatureStyle === "classic") {
      return (
        <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-accent/40 to-card p-6 text-center">
          <div className="w-16 h-0.5 bg-primary mx-auto mb-4" />
          <p className="font-serif text-lg font-bold text-foreground italic">{signature.fullName}</p>
          <p className="text-sm text-primary font-semibold mt-1">Nutricionista — {signature.crnNumber}</p>
          {signature.specialty && <p className="text-xs text-muted-foreground mt-0.5">{signature.specialty}</p>}
          <p className="text-xs text-muted-foreground mt-2">{date}</p>
          <div className="w-16 h-0.5 bg-primary mx-auto mt-4" />
        </div>
      );
    }

    if (signature.signatureStyle === "minimal") {
      return (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-foreground">{signature.fullName}</p>
              <p className="text-xs text-muted-foreground">{signature.crnNumber} • {signature.specialty}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-right">{date}</p>
        </div>
      );
    }

    // Modern (default)
    return (
      <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-accent/30 to-primary/5 p-6 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 emerald-gradient" />
        <CheckCircle2 className="h-8 w-8 text-primary mx-auto mb-3" />
        <p className="font-display font-bold text-lg text-foreground">{signature.fullName}</p>
        <p className="text-sm text-primary font-semibold mt-1">
          Nutricionista — {signature.crnNumber}
        </p>
        {signature.specialty && (
          <p className="text-xs text-muted-foreground mt-1">Especialidade: {signature.specialty}</p>
        )}
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          Validado digitalmente em {date}
        </p>
        <div className="absolute bottom-0 left-0 w-full h-1 emerald-gradient" />
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-sm flex items-center gap-2">
            <Pen className="h-4 w-4 text-primary" />
            Assinatura Digital
          </CardTitle>
          <Button
            size="sm"
            variant={editing ? "default" : "outline"}
            onClick={() => setEditing(!editing)}
          >
            {editing ? <Eye className="h-4 w-4 mr-1" /> : <Pen className="h-4 w-4 mr-1" />}
            {editing ? "Pré-visualizar" : "Editar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <div>
              <Label htmlFor="sigName">Nome Completo *</Label>
              <Input
                id="sigName"
                value={signature.fullName}
                onChange={(e) => setSignature({ ...signature, fullName: e.target.value })}
                placeholder="Dr(a). Nome Completo"
              />
            </div>
            <div>
              <Label htmlFor="sigCrn">Registro CRN *</Label>
              <Input
                id="sigCrn"
                value={signature.crnNumber}
                onChange={(e) => setSignature({ ...signature, crnNumber: e.target.value })}
                placeholder="CRN-0 00000"
              />
            </div>
            <div>
              <Label>Especialidade</Label>
              <Select value={signature.specialty} onValueChange={(v) => setSignature({ ...signature, specialty: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estilo da Assinatura</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(["modern", "classic", "minimal"] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setSignature({ ...signature, signatureStyle: style })}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-center ${
                      signature.signatureStyle === style
                        ? "border-primary bg-accent text-foreground"
                        : "border-border hover:border-primary/50 text-muted-foreground"
                    }`}
                  >
                    {style === "modern" ? "Moderno" : style === "classic" ? "Clássico" : "Minimalista"}
                  </button>
                ))}
              </div>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground font-medium">Pré-visualização:</p>
            {renderSignaturePreview()}
            <Button onClick={handleSave} disabled={saving} className="w-full emerald-gradient text-primary-foreground">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Assinatura"}
            </Button>
          </>
        ) : (
          renderSignaturePreview()
        )}
      </CardContent>
    </Card>
  );
}
