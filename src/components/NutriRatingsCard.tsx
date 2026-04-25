// "Minhas Avaliações" — average star rating + recent client feedback for the logged-in nutritionist.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare, TrendingUp } from "lucide-react";

type Feedback = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  diet_request_id: string;
};

export default function NutriRatingsCard() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Find diet_requests this nutritionist validated
      const { data: myRequests } = await supabase
        .from("diet_requests")
        .select("id")
        .eq("nutritionist_id", user.id)
        .eq("status", "completed");

      const ids = (myRequests || []).map((r) => r.id);
      if (ids.length === 0) {
        setLoading(false);
        return;
      }

      const { data: fbs } = await supabase
        .from("client_feedback")
        .select("*")
        .in("diet_request_id", ids)
        .order("created_at", { ascending: false });

      if (fbs) setFeedbacks(fbs as any);
      setLoading(false);
    })();
  }, [user]);

  const avg =
    feedbacks.length > 0
      ? feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length
      : 0;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Star className="h-5 w-5 text-[hsl(45,93%,47%)] fill-[hsl(45,93%,47%)]" />
          Minhas Avaliações
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          O que seus clientes estão dizendo sobre o seu trabalho
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-primary/20 bg-accent/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Média Geral</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span className="text-2xl font-display font-bold text-primary">
                {avg > 0 ? avg.toFixed(1) : "—"}
              </span>
              <Star className="h-5 w-5 text-[hsl(45,93%,47%)] fill-[hsl(45,93%,47%)]" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Total de Avaliações</p>
            <p className="text-2xl font-display font-bold mt-1">{feedbacks.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">Avaliações 5★</p>
            <p className="text-2xl font-display font-bold mt-1 text-primary">
              {feedbacks.filter((f) => f.rating === 5).length}
            </p>
          </div>
        </div>

        {/* Recent reviews */}
        {loading ? (
          <p className="text-center text-xs text-muted-foreground py-4">Carregando…</p>
        ) : feedbacks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Você ainda não recebeu avaliações.</p>
            <p className="text-xs mt-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3" /> Valide mais dietas para começar a receber feedbacks.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {feedbacks.slice(0, 8).map((fb) => (
              <div key={fb.id} className="rounded-lg border border-border bg-card/60 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= fb.rating
                            ? "text-[hsl(45,93%,47%)] fill-[hsl(45,93%,47%)]"
                            : "text-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(fb.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {fb.comment ? (
                  <p className="text-xs italic text-muted-foreground">"{fb.comment}"</p>
                ) : (
                  <p className="text-xs text-muted-foreground/60">Sem comentário</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
