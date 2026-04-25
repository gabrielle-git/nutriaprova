import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import PremiumDietPlanView from "./PremiumDietPlanView";
import ClientFeedbackForm from "./ClientFeedbackForm";
import type { DietPlan } from "@/services/n8nService";


type DietRequest = any;

export default function ClientCompletedDiet() {
  const { user } = useAuth();
  const [completedDiets, setCompletedDiets] = useState<DietRequest[]>([]);
  const [selectedDiet, setSelectedDiet] = useState<DietRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const [existingFeedback, setExistingFeedback] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    const fetchCompleted = async () => {
      const { data } = await supabase
        .from("diet_requests")
        .select("*")
        .eq("client_id", user.id)
        .eq("status", "completed")
        .order("updated_at", { ascending: false });
      if (data) setCompletedDiets(data);

      // Check existing feedback
      const { data: feedbacks } = await supabase
        .from("client_feedback")
        .select("diet_request_id")
        .eq("client_id", user.id);
      if (feedbacks) {
        const map: Record<string, boolean> = {};
        feedbacks.forEach((f) => { map[f.diet_request_id] = true; });
        setExistingFeedback(map);
      }
    };
    fetchCompleted();
  }, [user]);

  if (completedDiets.length === 0) return null;

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h2 className="font-display font-bold text-lg">Seus Planos Validados</h2>
        </div>

        {completedDiets.map((diet) => {
          const plan = diet.ai_draft as unknown as DietPlan | null;
          const hasFeedback = existingFeedback[diet.id] || feedbackSubmitted[diet.id];
          return (
            <Card key={diet.id} className="glass-card">
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      Plano #{diet.id.slice(0, 8)}
                      {plan && <span className="text-muted-foreground ml-2">• {plan.totalCalories} kcal/dia</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Validado em {new Date(diet.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Validado
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedDiet(diet); setSheetOpen(true); }}>
                    <FileText className="h-4 w-4 mr-1" /> Ver Plano
                  </Button>
                </div>
              </CardContent>
              {/* Feedback inline if not already submitted */}
              {!hasFeedback && (
                <div className="px-4 pb-4">
                  <ClientFeedbackForm
                    dietRequestId={diet.id}
                    onSubmitted={() => setFeedbackSubmitted(prev => ({ ...prev, [diet.id]: true }))}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Full PDF View */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Seu Plano Alimentar Completo</SheetTitle>
          </SheetHeader>
          {selectedDiet?.ai_draft && (
            <div className="mt-6">
              <PremiumDietPlanView
                plan={selectedDiet.ai_draft as unknown as DietPlan}
                isCompleted={true}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
