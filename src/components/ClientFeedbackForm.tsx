import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Heart, Gift, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ClientFeedbackFormProps {
  dietRequestId: string;
  onSubmitted?: () => void;
}

export default function ClientFeedbackForm({ dietRequestId, onSubmitted }: ClientFeedbackFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showPositive, setShowPositive] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("client_feedback").insert({
        diet_request_id: dietRequestId,
        client_id: user.id,
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;

      setSubmitted(true);
      toast.success("Feedback enviado com sucesso!");

      if (rating <= 2) {
        setShowRecoveryModal(true);
      } else {
        setShowPositive(true);
      }

      onSubmitted?.();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted && showPositive) {
    return (
      <Card className="glass-card border-primary/30">
        <CardContent className="py-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-display font-bold text-lg">Obrigado pelo seu feedback! 💚</p>
            <p className="text-sm text-muted-foreground mt-2">
              Agradecemos muito pelo seu feedback! Volte sempre para atualizar seu plano e continuar evoluindo.
            </p>
          </div>
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-5 w-5 ${s <= rating ? "text-[hsl(45,93%,47%)] fill-[hsl(45,93%,47%)]" : "text-muted"}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (submitted && !showPositive && !showRecoveryModal) {
    return null;
  }

  return (
    <>
      {!submitted && (
        <Card className="glass-card border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Área de Feedback
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Como foi sua experiência com o plano alimentar? Sua opinião é fundamental!
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stars */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-125"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= (hovered || rating)
                        ? "text-[hsl(45,93%,47%)] fill-[hsl(45,93%,47%)]"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-sm font-medium">
                {rating <= 2 ? "😔 Sentimos muito..." : rating <= 4 ? "😊 Que bom!" : "🎉 Incrível!"}
              </p>
            )}

            {/* Comment */}
            <Textarea
              placeholder="Conte-nos mais sobre sua experiência (opcional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />

            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              className="w-full emerald-gradient text-primary-foreground"
            >
              {submitting ? "Enviando..." : "Enviar Feedback"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recovery Modal for negative reviews */}
      <Dialog open={showRecoveryModal} onOpenChange={setShowRecoveryModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Segunda Chance — 100% Gratuita
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/30 border border-primary/20 p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
                <Gift className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                Sentimos muito que a sua experiência não tenha sido perfeita. Queremos entender o que houve e consertar isso!
              </p>
              <p className="text-sm leading-relaxed text-foreground mt-3 font-semibold">
                Estamos liberando uma <span className="text-primary">Segunda Chance 100% Gratuita</span> para você gerar um novo plano.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Por favor, na próxima solicitação, use o campo opcional <strong>"Descreva melhor seu foco"</strong> para nos dar o máximo de detalhes possíveis.
              </p>
            </div>

            <Button
              className="w-full emerald-gradient text-primary-foreground"
              onClick={() => setShowRecoveryModal(false)}
            >
              Entendi, vou tentar novamente! 💪
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
