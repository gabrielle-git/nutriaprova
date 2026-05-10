import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { trackInviteEvent } from "@/services/inviteAnalytics";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount?: number;
  /** Chamado após o fluxo de pagamento simulado; pode ser assíncrono para refetch no painel. */
  onApproved?: () => void | Promise<void>;
  /** Quando definido, textos refletem assinatura de plano (ex.: /planos) em vez do fluxo cardápio. */
  planLabel?: string | null;
}

export default function CheckoutModal({
  open,
  onOpenChange,
  amount = 39.9,
  onApproved,
  planLabel = null,
}: CheckoutModalProps) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const simulateApproval = async () => {
    setProcessing(true);
    const isSubscription = Boolean(planLabel);

    // Mock: fluxo cardápio (cliente) — não altera diet_requests em checkout de assinatura de plano.
    if (user && !isSubscription) {
      const { data: latest } = await supabase
        .from("diet_requests")
        .select("id, status")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const id = latest?.[0]?.id;
      if (id) {
        await supabase
          .from("diet_requests")
          .update({ status: "processing", notes: "Pagamento aprovado (simulado). Processando IA." } as any)
          .eq("id", id);

        setTimeout(async () => {
          await supabase
            .from("diet_requests")
            .update({ status: "pending", notes: "Pagamento confirmado. Aguardando validação nutricional." } as any)
            .eq("id", id);
        }, 3000);
      }

      try {
        const { data: clientProfile } = await (supabase as any)
          .from("profiles")
          .select("referred_by")
          .eq("user_id", user.id)
          .maybeSingle();

        const referrerId = clientProfile?.referred_by as string | null | undefined;
        if (referrerId) {
          const { data: referrer } = await (supabase as any)
            .from("profiles")
            .select("affiliate_code")
            .eq("user_id", referrerId)
            .maybeSingle();
          const code = referrer?.affiliate_code as string | null | undefined;
          if (code) {
            await trackInviteEvent({
              code,
              ownerId: referrerId,
              eventType: "sale",
              clientId: user.id,
              amount,
            });
          }
        }
      } catch (err) {
        console.warn("[CheckoutModal] sale tracking:", err);
      }
    }
    setTimeout(() => {
      void (async () => {
        setProcessing(false);
        try {
          await onApproved?.();
          toast.success(
            isSubscription
              ? `Pagamento aprovado! Plano ${planLabel} será ativado em instantes.`
              : "Pagamento aprovado! Sua dieta entrou em processamento.",
          );
        } finally {
          onOpenChange(false);
        }
      })();
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finalizar pagamento</DialogTitle>
          <DialogDescription>
            {planLabel ? `${planLabel} · ` : ""}
            {formatBRL(amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[hsl(var(--ink-2))]">
              Integração de pagamento em configuração. Entre em contato pelo suporte para finalizar seu pedido.
            </p>
          </div>
        </div>

        {import.meta.env.DEV && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">[MODO DESENVOLVIMENTO] Simulação ativa</p>
            <p className="text-xs font-mono text-amber-800/90 dark:text-amber-300/90">
              Clique abaixo para simular aprovação (não aparece em produção)
            </p>
            <Button className="w-full" onClick={simulateApproval} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Simular aprovação (dev only)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
