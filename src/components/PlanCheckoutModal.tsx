import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2, QrCode, ShieldCheck, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
}

const PIX_CODE = "00020126580014BR.GOV.BCB.PIX0136nutriaprova-checkout-simulado5204000053039865802BR5923NUTRIAPROVA TECNOLOGIA6009SAO PAULO62070503***6304ABCD";
/** Moedas inclusas no plano ao ativar (nunca reduz o saldo existente — só garante o mínimo do tier). */
const PLAN_CREDIT_GRANT: Record<string, number> = {
  freemium: 5,
  basic: 20,
  premium: 120,
  clinic: 9999,
};

function txIntegerBrl(reais: number): number {
  return Math.round(Number(reais) || 0);
}

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function checkoutErrText(err: unknown) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function PlanCheckoutModal({ open, onOpenChange, plan, onApproved }: PlanCheckoutModalProps) {
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
        // Saldo interno equivalente: ganhos concluídos (R$ 15 por validação)
        // menos o que já foi usado em upgrades com saldo.
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

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_CODE);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar o código PIX.");
    }
  };

  const finishUpgrade = async (internalUsed: number, externalPaid: number) => {
    if (!plan) return;
    if (!user) {
      toast.error("Faça login para concluir o upgrade do plano.");
      return;
    }

    setProcessing(true);
    try {
      await wait(2000);

      const tierKey = String(plan.tier).toLowerCase();
      const targetCredits = PLAN_CREDIT_GRANT[tierKey] ?? 0;
      const currentCredits = profile?.credits ?? 0;
      /** Preserva moedas acima do pacote do tier (ex.: Basic não “zera” para 20 se o nutri já tem mais). */
      const nextCredits = Math.max(currentCredits, targetCredits);

      const profilePayload: Record<string, unknown> = { plan_tier: tierKey };
      if (nextCredits !== currentCredits) {
        profilePayload.credits = nextCredits;
      }

      try {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("user_id", user.id);
        if (profileErr) throw profileErr;

        const txRows: Array<{ user_id: string; amount: number; type: string; description: string }> = [];
        const intInternal = txIntegerBrl(internalUsed);
        const intExternal = txIntegerBrl(externalPaid);
        if (intInternal > 0) {
          txRows.push({
            user_id: user.id,
            amount: -intInternal,
            type: "plan_upgrade_balance_debit",
            description: `Upgrade para ${plan.name} usando saldo interno`,
          });
        }
        if (intExternal > 0) {
          txRows.push({
            user_id: user.id,
            amount: -intExternal,
            type: "plan_upgrade_external_payment",
            description: `Pagamento externo simulado no upgrade para ${plan.name}`,
          });
        }
        if (txRows.length > 0) {
          const { error: txErr } = await supabase.from("transactions").insert(txRows);
          if (txErr) throw txErr;
        }

        const creditDelta = nextCredits - currentCredits;
        if (creditDelta > 0) {
          const { error: grantErr } = await supabase.from("transactions").insert({
            user_id: user.id,
            amount: creditDelta,
            type: "plan_coin_grant",
            description: `Ajuste de moedas no upgrade para ${plan.name}`,
          });
          if (grantErr) throw grantErr;
        }

        await refreshProfile();
      } catch (error: unknown) {
        console.error("ERRO_CHECKOUT:", checkoutErrText(error) || error);
        throw error;
      }

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

  const handleConfirmExternalPayment = async () => {
    await finishUpgrade(0, planAmount);
  };

  const handleConfirmWithBalance = async () => {
    if (!plan) return;
    if (!user) {
      toast.error("Faça login para concluir o upgrade do plano.");
      return;
    }
    if (balanceToUse <= 0) {
      toast.error("Você ainda não possui saldo acumulado para usar no upgrade.");
      return;
    }
    await finishUpgrade(balanceToUse, remainingToPay);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="emerald-gradient px-6 py-5 text-primary-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
              Checkout do Plano
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              Confirme seu pagamento simulado para ativar o upgrade imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-xs opacity-80">Plano selecionado</p>
              <p className="font-display text-xl font-bold">{plan?.name ?? "-"}</p>
              <p className="mt-1 text-sm opacity-90">{formatBrl(plan?.amount ?? 0)}</p>
            </div>
            <Badge className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
              Simulado
            </Badge>
          </div>
        </div>

        <div className="p-6">
          {!!plan && (profile?.role === "nutritionist" || profile?.role === "admin") && (
            <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
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
                        : `Aplicaremos ${formatBrl(balanceToUse)} e você paga só ${formatBrl(remainingToPay)} de diferença.`}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full border-primary/40 bg-background"
                onClick={handleConfirmWithBalance}
                disabled={processing || loadingBalance || balanceToUse <= 0}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : hasEnoughBalance ? (
                  "Pagar com meu saldo disponível"
                ) : (
                  `Usar saldo + pagar ${formatBrl(remainingToPay)}`
                )}
              </Button>
            </div>
          )}

          <Tabs defaultValue="card" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="card" className="gap-2">
                <CreditCard className="h-4 w-4" /> Cartão
              </TabsTrigger>
              <TabsTrigger value="pix" className="gap-2">
                <QrCode className="h-4 w-4" /> PIX
              </TabsTrigger>
            </TabsList>

            <TabsContent value="card" className="mt-4 space-y-3">
              <div>
                <Label htmlFor="plan-card-name">Nome no Cartão</Label>
                <Input id="plan-card-name" placeholder="Como impresso no cartão" />
              </div>
              <div>
                <Label htmlFor="plan-card-number">Número do Cartão</Label>
                <Input id="plan-card-number" placeholder="0000 0000 0000 0000" inputMode="numeric" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="plan-card-exp">Validade</Label>
                  <Input id="plan-card-exp" placeholder="MM/AA" inputMode="numeric" />
                </div>
                <div>
                  <Label htmlFor="plan-card-cvv">CVV</Label>
                  <Input id="plan-card-cvv" placeholder="123" inputMode="numeric" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pix" className="mt-4 space-y-3">
              <div>
                <Label htmlFor="plan-pix-code">PIX Copia e Cola</Label>
                <Input id="plan-pix-code" value={PIX_CODE} readOnly className="font-mono text-xs" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={copyPix}>
                Copiar código PIX
              </Button>
            </TabsContent>
          </Tabs>

          <Button
            type="button"
            className="mt-6 h-12 w-full emerald-gradient text-base font-semibold text-primary-foreground"
            onClick={handleConfirmExternalPayment}
            disabled={!plan || processing}
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Confirmar Pagamento Externo Simulado
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
