import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface Props {
  paidStudents: { name: string; date: string }[];
  totalEarnings: number;
}

export default function PTWalletTab({ paidStudents, totalEarnings }: Props) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Carteira Digital
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
          <DollarSign className="h-10 w-10 text-primary mx-auto mb-2" />
          <p className="text-4xl font-display font-bold text-primary">R$ {totalEarnings.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">Saldo disponível para saque</p>
          <Button className="emerald-gradient text-primary-foreground mt-4" onClick={() => toast.info("Função de saque em breve!")}>
            Solicitar Saque
          </Button>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Histórico de Comissões:</p>
          {paidStudents.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.date}</p>
              </div>
              <span className="text-sm font-semibold text-primary">+ R$ 10,00</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
