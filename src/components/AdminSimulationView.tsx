import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle2, Sparkles, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { adjustDietWithAI, type DietPlan } from "@/services/n8nService";
import { supabase } from "@/integrations/supabase/client";
import PremiumDietPlanView from "./PremiumDietPlanView";


type DietRequest = any;

interface Props {
  request: DietRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export default function AdminSimulationView({ request, open, onOpenChange, onComplete }: Props) {
  const [expertComment, setExpertComment] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [viewMode, setViewMode] = useState<"review" | "pdf">("review");
  const [currentDraft, setCurrentDraft] = useState<DietPlan | null>(request.ai_draft as unknown as DietPlan);

  const clientData = request.client_data as any;
  const draft = currentDraft;

  const handleSimulateApprove = async () => {
    await supabase.from("diet_requests").update({
      status: "completed",
      notes: expertComment || "Validado via Modo Teste Admin",
    }).eq("id", request.id);
    toast.success("✅ Validação simulada com sucesso!");
    onComplete();
    onOpenChange(false);
  };

  const handleAIAdjust = async () => {
    if (!draft || !aiInstruction.trim()) return;
    setAdjusting(true);
    try {
      const newDraft = await adjustDietWithAI(draft, aiInstruction);
      setCurrentDraft(newDraft);
      await supabase.from("diet_requests").update({ ai_draft: newDraft as any }).eq("id", request.id);
      setAiInstruction("");
      toast.success("Plano ajustado pela IA!");
    } catch {
      toast.error("Erro ao ajustar plano");
    } finally {
      setAdjusting(false);
    }
  };

  if (!draft) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            {viewMode === "pdf" ? "Preview PDF Final (Visão do Cliente)" : "Simulação de Validação"}
          </SheetTitle>
          <Badge variant="outline" className="w-fit border-destructive text-destructive">
            🧪 MODO TESTE — CRN Bypass Ativo
          </Badge>
        </SheetHeader>

        <div className="flex gap-2 mt-4">
          <Button size="sm" variant={viewMode === "review" ? "default" : "outline"} onClick={() => setViewMode("review")}>
            Revisão
          </Button>
          <Button size="sm" variant={viewMode === "pdf" ? "default" : "outline"} onClick={() => setViewMode("pdf")}>
            <FileText className="h-4 w-4 mr-1" /> PDF (Visão Cliente)
          </Button>
        </div>

        {viewMode === "pdf" ? (
          <div className="mt-6">
            <PremiumDietPlanView
              plan={draft}
              nutritionistName="Admin Supremo"
              crnNumber="CRN-TESTE (Dev Mode)"
              isCompleted={true}
            />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Client data */}
            {clientData && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Dados do Cliente</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>
                    {clientData.birthDate
                      ? `Nasc: ${new Date(clientData.birthDate).toLocaleDateString("pt-BR")} (${clientData.age} anos)`
                      : `Idade: ${clientData.age} anos`
                    } • Peso: {clientData.weight}kg • Altura: {clientData.height}cm
                  </p>
                  <p>Objetivo: {clientData.goal} • Atividade: {clientData.activityLevel}</p>
                  {clientData.allergies?.length > 0 && <p>Alergias: {clientData.allergies.join(", ")}</p>}
                  {clientData.additionalNotes && (
                    <p className="mt-2 p-2 bg-accent/50 rounded text-xs italic">📝 {clientData.additionalNotes}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Inline premium preview */}
            <PremiumDietPlanView
              plan={draft}
              nutritionistName="Admin Supremo"
              crnNumber="CRN-TESTE"
              isCompleted={false}
            />

            {/* Expert comment */}
            <div>
              <Label htmlFor="simExpertComment" className="font-display text-sm font-semibold">Comentário do Especialista</Label>
              <Textarea
                id="simExpertComment"
                placeholder="Adicione observações profissionais..."
                value={expertComment}
                onChange={(e) => setExpertComment(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* AI Adjust */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Sugerir Alterações com IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Ex: Trocar salmão por tilápia..."
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={handleAIAdjust} disabled={adjusting || !aiInstruction.trim()}>
                  {adjusting ? "Ajustando..." : "Aplicar Sugestão IA"}
                </Button>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setViewMode("pdf")}>
                <FileText className="h-4 w-4 mr-2" /> Ver PDF Cliente
              </Button>
              <Button className="flex-1 emerald-gradient text-primary-foreground" onClick={handleSimulateApprove}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Simular Validação
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
