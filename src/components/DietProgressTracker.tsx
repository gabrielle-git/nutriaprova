// Visual 4-step progress tracker for active client diet requests.
// Maps diet_requests.status → step (Pagamento → IA → Análise Nutri → Liberada).
import { useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Search, Lock, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DietRequest = any;

const STEPS = [
  { key: "paid", label: "Pagamento Confirmado", Icon: CheckCircle2 },
  { key: "ai", label: "Processando IA", Icon: Loader2 },
  { key: "review", label: "Validação Nutricionista (CRN)", Icon: Search },
  { key: "done", label: "Download Liberado", Icon: Lock },
];

function statusToStep(status: string): number {
  // 0 = paid, 1 = AI processing, 2 = nutri review, 3 = done
  if (status === "completed") return 3;
  if (status === "in_review" || status === "pending" || status === "awaiting_validation") return 2;
  if (status === "processing") return 1;
  // Antes do pagamento não exibimos tracker pós-pagamento.
  return -1;
}

export default function DietProgressTracker() {
  const { user } = useAuth();
  const [activeRequests, setActiveRequests] = useState<DietRequest[]>([]);
  // Identificador estável por instância — evita colisão de nome de canal
  // caso o componente seja montado em mais de um lugar simultaneamente.
  const instanceId = useId();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetchActive = async () => {
      const { data } = await supabase
        .from("diet_requests")
        .select("*")
        .eq("client_id", user.id)
        .in("status", ["processing", "pending", "in_review", "awaiting_validation", "completed"])
        .order("created_at", { ascending: false });
      if (!cancelled && data) setActiveRequests(data);
    };
    fetchActive();

    // 1) Cria o canal com nome único (user + instância + timestamp) para
    //    evitar reuso de canal já subscrito pelo client Supabase.
    const channelName = `client-diet-tracker:${user.id}:${instanceId}:${Date.now()}`;
    const channel = supabase.channel(channelName);

    // 2) Anexa TODOS os listeners ANTES de chamar subscribe().
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "diet_requests",
        filter: `client_id=eq.${user.id}`,
      },
      () => {
        if (!cancelled) fetchActive();
      },
    );

    // 3) Somente após todos os .on() serem registrados, fazemos o subscribe.
    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, instanceId]);

  const visibleRequests = activeRequests.filter((req) => statusToStep(req.status) >= 0);
  if (visibleRequests.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-0">
      {visibleRequests.map((req) => {
        const currentStep = statusToStep(req.status);
        return (
          <Card key={req.id} className="card-clinical border-primary/25">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Acompanhe seu Plano #{req.id.slice(0, 8)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Você não precisa fazer nada — sua dieta está em produção segura. Não saia da plataforma!
              </p>
            </CardHeader>
            <CardContent>
              {/* Desktop horizontal / Mobile vertical */}
              <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-2">
                {STEPS.map((step, idx) => {
                  const Icon = step.Icon;
                  const isDone = idx < currentStep;
                  const isActive = idx === currentStep;
                  const isLast = idx === STEPS.length - 1;
                  return (
                    <div key={step.key} className="flex md:flex-col md:items-center md:flex-1 gap-3 md:gap-2">
                      <div className="flex md:flex-col md:items-center gap-3 md:gap-2 md:flex-1">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                            isDone && "bg-primary text-primary-foreground",
                            isActive && "bg-primary text-primary-foreground pulse-emerald ring-4 ring-primary/20",
                            !isDone && !isActive && "bg-muted text-muted-foreground"
                          )}
                        >
                          <Icon className={cn("h-5 w-5", isActive && step.key === "ai" && "animate-spin")} />
                        </div>
                        <div className="md:text-center">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              (isDone || isActive) ? "text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {step.label}
                          </p>
                          {isActive && (
                            <p className="text-[10px] text-primary font-semibold mt-0.5">EM ANDAMENTO</p>
                          )}
                          {isDone && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Concluído</p>
                          )}
                        </div>
                      </div>
                      {/* Connector line (desktop only) */}
                      {!isLast && (
                        <div
                          className={cn(
                            "hidden md:block h-0.5 flex-1 mt-5 self-start",
                            idx < currentStep ? "bg-primary" : "bg-border"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reassurance text */}
              <div className="mt-5 rounded-lg border border-primary/20 bg-accent/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  ⏱ Tempo estimado: até <strong className="text-foreground">24 horas</strong>. Você receberá uma notificação assim que sua dieta for liberada.
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
