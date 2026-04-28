import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Coins } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  paidStudents: { name: string; date: string }[];
  totalEarnings: number;
}

export default function PTWalletTab({ paidStudents, totalEarnings }: Props) {
  return (
    <Card className="card-clinical border-[hsl(var(--surface-3))] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--surface-3))] py-4">
        <CardTitle className="font-display flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-[hsl(var(--primary))]" /> Carteira
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5 md:p-6">
        <div className="flex flex-col items-center rounded-2xl border border-[hsl(var(--surface-3))] bg-gradient-to-b from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] p-8 text-center shadow-inner">
          <Coins className="mb-1 h-12 w-12 text-[hsl(var(--primary))]" strokeWidth={1.5} />
          <p
            className="font-display text-5xl font-extrabold tabular-nums text-brand sm:text-6xl"
            style={{ fontWeight: 800 }}
          >
            {totalEarnings.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
          <p className="mt-1 text-sm font-sans text-[hsl(var(--ink-3))]">Total de ganhos (carteira)</p>
          <Button className="btn-primary mt-5" onClick={() => toast.info("Função de saque em breve!")}>
            Solicitar saque
          </Button>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-[hsl(var(--ink-2))]">Histórico</p>
          <div className="overflow-hidden rounded-lg border border-[hsl(var(--surface-3))]">
            {paidStudents.map((s, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between gap-3 border-b border-[hsl(var(--surface-3))] px-4 py-3 last:border-0",
                  i % 2 === 0 ? "bg-[hsl(var(--surface-1))]" : "bg-[hsl(var(--surface-0))]",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--ink-1))]">{s.name}</p>
                  <p className="text-xs font-sans text-[hsl(var(--ink-3))]">{s.date}</p>
                </div>
                <span className="font-display text-sm font-semibold text-[hsl(var(--primary))]">+ R$ 10,00</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
