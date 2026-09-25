import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, ShieldCheck, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { activatePlanWithInternalBalance } from "@/services/profileEconomicService";

export interface CheckoutPlanSelection {
  name: string;
  tier: string;
  amount: number;
}

interface PlanCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CheckoutPlanSelection | null;
  onApproved?: () => void | Promise<void>;
  /** monthly | annual — preço calculado no servidor a partir do tier */
  billingPeriod?: "monthly" | "annual";
}

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function checkoutErrText(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

export default function PlanCheckoutModal({
  open,
  onOpenChange,
  plan,
  onApproved,
  billingPeriod = "monthly",
}: PlanCheckoutModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [internalBalance, setInternalBalance] = useState(0);

  const planAmount = plan?.amount ?? 0;
  const balanceToUse = useMemo(() => Math.min(internalBalance, planAmount), [internalBalance, planAmount]);
  const remainingToPay = useMemo(() => Math.max(planAmount - balanceToUse, 0), [planAmount, balanceToUse]);
  const hasEnoughBalance = planAmount > 0 && balanceToUse >= planAmount;

  useEffect(() => {
    if (!open || !user || !plan) return;

    const loadInternalBalance = async () => {
      setLoadingBalance(true);
      try {
        const { count, error: completedErr } = await supabase
          .from("diet_requests")
          .select("id", { count: "exact", head: true })
          .eq("nutritionist_id", user.id)
          .eq("status", "completed");
        if (completedErr) throw completedErr;

        const grossBalance = (count ?? 0) * 15;

        const { data: debitRows, error: debitErr } = await supabase
          .from("transactions")
          .select("amount")
          .eq("user_id", user.id)
          .eq("type", "plan_upgrade_balance_debit");
        if (debitErr) throw debitErr;

        const usedInUpgrades = (debitRows ?? []).reduce((sum, row) => {
          const amount = Number(row.amount) || 0;
          return sum + Math.abs(amount);
        }, 0);

        setInternalBalance(Math.max(0, grossBalance - usedInUpgrades));
      } catch (err) {
        console.error("[PlanCheckoutModal] balance load:", err);
        setInternalBalance(0);
      } finally {
        setLoadingBalance(false);
      }
    };

    void loadInternalBalance();
  }, [open, user, plan]);

  const activateWithTrustedBalance = async () => {
    if (!plan) return;
    if (!user) {
      toast.error("Faça login para concluir o upgrade do plano.");
      return;
    }

    const tierKey = String(plan.tier).toLowerCase();
    if (tierKey !== "basic" && tierKey !== "premium" && tierKey !== "clinic") {
      toast.error("Plano inválido.");
      return;
    }

    setProcessing(true);
    try {
      const result = await activatePlanWithInternalBalance(tierKey, billingPeriod);

      if (!result || result.status === "payment_required") {
        toast.error(
          "Saldo interno insuficiente para ativar este plano. Integração de pagamento em configuração — contate o suporte.",
        );
        return;
      }

      await refreshProfile();
      await onApproved?.();
      toast.success(
        "Upgrade ativado com sucesso! Com suas moedas, você pode lucrar de R$ 300,00 a R$ 500,00 validando dietas.",
      );
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("ERRO_CHECKOUT:", checkoutErrText(err) || err);
      toast.error("Não foi possível ativar o plano. Tente de novo ou fale com o suporte.");
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmWithBalance = async () => {
    if (!plan) return;
    if (!user) {
      toast.error("Faça login para concluir o upgrade do plano.");
      return;
    }
    if (!hasEnoughBalance) {
      toast.error(
        "Saldo parcial não ativa o plano sem comprovação de pagamento. Integração de pagamento em configuração.",
      );
      return;
    }
    await activateWithTrustedBalance();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Finalizar pagamento
          </DialogTitle>
          <DialogDescription>
            {plan?.name ?? "Plano"} — {formatBrl(plan?.amount ?? 0)}
          </DialogDescription>
        </DialogHeader>

        {!!plan && (profile?.role === "nutritionist" || profile?.role === "admin") && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-primary/15 p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[hsl(var(--ink-1))]">
                  {loadingBalance ? "Calculando seu saldo interno..." : `Você tem ${formatBrl(internalBalance)} acumulados.`}
                </p>
                <p className="text-xs text-[hsl(var(--ink-2))]">
                  Use seu saldo para ativar seu plano agora e liberar seus saques!
                </p>
                {!loadingBalance && balanceToUse > 0 && (
                  <p className="text-xs text-[hsl(var(--ink-2))]">
                    {hasEnoughBalance
                      ? "Seu saldo cobre 100% deste plano."
                      : `Saldo parcial (${formatBrl(balanceToUse)}) não ativa o plano sem pagamento comprovado. Falta ${formatBrl(remainingToPay)}.`}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full border-primary/40 bg-background"
              onClick={handleConfirmWithBalance}
              disabled={processing || loadingBalance || !hasEnoughBalance}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : hasEnoughBalance ? (
                "Pagar com meu saldo disponível"
              ) : (
                `Saldo insuficiente (faltam ${formatBrl(remainingToPay)})`
              )}
            </Button>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[hsl(var(--ink-2))]">
              Integração de pagamento em configuração. Entre em contato pelo suporte para finalizar seu pedido.
            </p>
          </div>
        </div>

        {import.meta.env.DEV && (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">[MODO DESENVOLVIMENTO]</p>
            <p className="text-xs font-mono text-amber-800/90 dark:text-amber-300/90">
              Simulação de pagamento externo desabilitada (1E.1B): não existe API de produção que ative plano sem funding confiável.
            </p>
            <Button
              type="button"
              className="h-12 w-full emerald-gradient text-base font-semibold text-primary-foreground"
              onClick={() =>
                toast.info(
                  "Simulação DEV bloqueada pelo hardening econômico. Use saldo interno integral ou aguarde o gateway.",
                )
              }
              disabled={!plan || processing}
            >
              <Zap className="mr-2 h-4 w-4" />
              Simular pagamento externo (bloqueado)
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
