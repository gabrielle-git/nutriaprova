// Re-engagement card shown after a client has at least one completed diet.
// "Próximos Passos" with locked monthly adjustment CTA (30-day cooldown).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, CalendarClock, TrendingUp, Sparkles } from "lucide-react";

export default function RecompraCard() {
  const { user } = useAuth();
  const [latestCompletedAt, setLatestCompletedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("diet_requests")
        .select("updated_at")
        .eq("client_id", user.id)
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.updated_at) setLatestCompletedAt(new Date(data.updated_at));
    })();
  }, [user]);

  if (!latestCompletedAt) return null;

  const daysSince = Math.floor((Date.now() - latestCompletedAt.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 30 - daysSince);
  const isUnlocked = daysRemaining === 0;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card className="glass-card border-primary/30 bg-gradient-to-br from-primary/5 via-accent/10 to-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Próximos Passos
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Mantenha o ritmo! O acompanhamento mensal é o segredo dos resultados duradouros.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 flex-shrink-0">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-display font-semibold text-sm">Ajuste Mensal de Metas</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isUnlocked
                  ? "Sua janela de ajuste está aberta! Garanta o desconto de fidelidade."
                  : `Liberado em ${daysRemaining} dia${daysRemaining === 1 ? "" : "s"} — receba um plano atualizado com desconto exclusivo de fidelidade.`}
              </p>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={isUnlocked ? "" : "cursor-not-allowed"}>
                  <Button
                    disabled={!isUnlocked}
                    className={
                      isUnlocked
                        ? "w-full emerald-gradient text-primary-foreground"
                        : "w-full opacity-60"
                    }
                    variant={isUnlocked ? "default" : "outline"}
                  >
                    {isUnlocked ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Ajustar Plano por R$ 29,90
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Ajuste Mensal de Metas — Liberado em {daysRemaining} dia{daysRemaining === 1 ? "" : "s"}
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-xs">
                  Após 30 dias do seu plano validado, você desbloqueia um <strong>ajuste mensal por apenas R$ 29,90</strong> (50% off do preço original) para manter sua evolução com novas metas.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <p className="text-[10px] text-center text-muted-foreground">
            💡 Clientes que fazem ajustes mensais têm <strong className="text-primary">3x mais resultado</strong> a longo prazo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
