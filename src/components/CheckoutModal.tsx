import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { QrCode, CreditCard, Copy, Shield, CheckCircle2, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { trackInviteEvent } from "@/services/inviteAnalytics";

interface CheckoutModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  amount?: number;
  onApproved?: () => void;
}

const PIX_CODE = "00020126830014BR.GOV.BCB.PIX0136nutrIAprova-mock-uuid-39905204000053039865802BR5925nutrIAprova TECNOLOGIA LT6009SAO PAULO62070503***6304ABCD";

export default function CheckoutModal({ open, onOpenChange, amount = 39.9, onApproved }: CheckoutModalProps) {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);

  const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(PIX_CODE);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const simulateApproval = async () => {
    setProcessing(true);
    // Mock: advance the user's most recent pending diet to "processing_ai"
    if (user) {
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
          .update({ status: "processing_ai", notes: "Pagamento aprovado (simulado)" })
          .eq("id", id);
      }

      // Registra conversão no painel de Performance de Convites: se o cliente
      // foi referenciado por algum profissional (profiles.referred_by → user_id
      // do afiliado), buscamos o affiliate_code correspondente e contabilizamos
      // a venda com o valor efetivamente pago.
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
        // Analytics é opcional; nunca travar o checkout por causa disso.
        console.warn("[CheckoutModal] sale tracking:", err);
      }
    }
    setTimeout(() => {
      setProcessing(false);
      toast.success("Pagamento aprovado! Sua dieta entrou em processamento.");
      onApproved?.();
      onOpenChange(false);
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="emerald-gradient px-6 py-5 text-primary-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary-foreground font-display text-xl flex items-center gap-2">
              <Shield className="h-5 w-5" /> Checkout Seguro
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              Plano Validado por Nutricionista — pagamento único.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-xs opacity-80">Total a pagar</p>
              <p className="text-3xl font-display font-bold">{formatBRL(amount)}</p>
            </div>
            <Badge className="bg-primary-foreground/15 text-primary-foreground border-primary-foreground/30">
              SLA 24h
            </Badge>
          </div>
        </div>

        <div className="p-6">
          <Tabs defaultValue="pix" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="pix" className="gap-2">
                <QrCode className="h-4 w-4" /> PIX
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-2">
                <CreditCard className="h-4 w-4" /> Cartão
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pix" className="space-y-4 mt-4">
              <div className="flex flex-col items-center gap-3">
                {/* Fake QR code rendered with CSS grid */}
                <div className="w-48 h-48 rounded-xl border-2 border-primary/30 p-3 bg-white">
                  <div
                    className="w-full h-full grid"
                    style={{
                      gridTemplateColumns: "repeat(21, 1fr)",
                      gridTemplateRows: "repeat(21, 1fr)",
                      gap: 0,
                    }}
                    aria-label="QR code mock"
                  >
                    {Array.from({ length: 441 }).map((_, i) => {
                      // Deterministic pseudo-random pattern + 3 finder squares
                      const row = Math.floor(i / 21);
                      const col = i % 21;
                      const isFinder =
                        (row < 7 && col < 7) ||
                        (row < 7 && col > 13) ||
                        (row > 13 && col < 7);
                      const isFinderInner =
                        (row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
                        (row >= 2 && row <= 4 && col >= 16 && col <= 18) ||
                        (row >= 16 && row <= 18 && col >= 2 && col <= 4);
                      const isFinderRing =
                        isFinder &&
                        (row === 0 || row === 6 || col === 0 || col === 6 ||
                         row === 14 || row === 20 || col === 14 || col === 20);
                      const filled = isFinderRing || isFinderInner || ((i * 9301 + 49297) % 233281) % 2 === 0;
                      return <div key={i} className={filled ? "bg-foreground" : "bg-transparent"} />;
                    })}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Abra o app do seu banco e escaneie o QR Code
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Ou use Copia e Cola</Label>
                <div className="flex gap-2">
                  <Input value={PIX_CODE} readOnly className="font-mono text-xs" />
                  <Button onClick={copyPix} variant="outline" size="icon" className="flex-shrink-0">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="card" className="space-y-3 mt-4">
              <div>
                <Label htmlFor="card-name">Nome no Cartão</Label>
                <Input id="card-name" placeholder="Como impresso no cartão" />
              </div>
              <div>
                <Label htmlFor="card-number">Número do Cartão</Label>
                <Input id="card-number" placeholder="0000 0000 0000 0000" inputMode="numeric" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="card-exp">Validade</Label>
                  <Input id="card-exp" placeholder="MM/AA" inputMode="numeric" />
                </div>
                <div>
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input id="card-cvv" placeholder="123" inputMode="numeric" />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 space-y-3">
            <Button
              onClick={simulateApproval}
              disabled={processing}
              className="w-full emerald-gradient text-primary-foreground h-12 text-base font-semibold"
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> Simular Pagamento Aprovado</>
              )}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Ambiente de teste — Nenhum valor real será cobrado</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
