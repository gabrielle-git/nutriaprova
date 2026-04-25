import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Users, AlertTriangle, CheckCircle2, Clock, Phone } from "lucide-react";

interface ClientRetention {
  id: string;
  name: string;
  dietDate: string;
  daysSince: number;
  status: "active" | "warning" | "risk";
  lastCheckin: string | null;
}

const MOCK_CLIENTS: ClientRetention[] = [
  { id: "1", name: "Maria Silva", dietDate: "2026-04-10", daysSince: 4, status: "active", lastCheckin: "Ontem" },
  { id: "2", name: "João Santos", dietDate: "2026-04-07", daysSince: 7, status: "warning", lastCheckin: "3 dias atrás" },
  { id: "3", name: "Ana Oliveira", dietDate: "2026-04-02", daysSince: 12, status: "risk", lastCheckin: null },
  { id: "4", name: "Carlos Pereira", dietDate: "2026-04-12", daysSince: 2, status: "active", lastCheckin: "Hoje" },
  { id: "5", name: "Fernanda Costa", dietDate: "2026-04-05", daysSince: 9, status: "risk", lastCheckin: "5 dias atrás" },
];

const STATUS_CONFIG = {
  active: { label: "Ativo", color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle2 },
  warning: { label: "Dia 7", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-300 dark:border-amber-700", icon: Clock },
  risk: { label: "Alerta de Desistência", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
};

interface RetentionTabProps {
  nutritionistName: string;
}

export default function RetentionTab({ nutritionistName }: RetentionTabProps) {
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRetention | null>(null);

  const openWhatsappPreview = (client: ClientRetention) => {
    setSelectedClient(client);
    setWhatsappModalOpen(true);
  };

  const activeCount = MOCK_CLIENTS.filter(c => c.status === "active").length;
  const riskCount = MOCK_CLIENTS.filter(c => c.status === "risk").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold text-primary">{MOCK_CLIENTS.length}</p>
            <p className="text-xs text-muted-foreground">Total Clientes</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold text-primary">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Engajados</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-display font-bold text-destructive">{riskCount}</p>
            <p className="text-xs text-muted-foreground">Em Risco</p>
          </CardContent>
        </Card>
      </div>

      {/* Retention Table */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Acompanhamento de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Dias desde Dieta</TableHead>
                  <TableHead>Status de Retenção</TableHead>
                  <TableHead>Último Check-in</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CLIENTS.map((client) => {
                  const status = STATUS_CONFIG[client.status];
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">Dia {client.daysSince}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {client.lastCheckin || "Nunca"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => openWhatsappPreview(client)}
                        >
                          <Phone className="h-3 w-3" />
                          Check-in WhatsApp
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Preview Modal */}
      <Dialog open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Preview — Check-in via WhatsApp
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#dcf8c6] dark:bg-green-900/30 p-4 border border-green-300 dark:border-green-800">
                <p className="text-sm text-foreground leading-relaxed">
                  Oi <strong>{selectedClient.name.split(" ")[0]}</strong>! 🌿
                  {selectedClient.daysSince <= 3 && (
                    <> Como está sendo o <strong>dia {selectedClient.daysSince}</strong> da sua nova dieta? Está conseguindo seguir as refeições? Estou aqui para ajudar! 💪</>
                  )}
                  {selectedClient.daysSince > 3 && selectedClient.daysSince <= 7 && (
                    <> Já se passaram <strong>{selectedClient.daysSince} dias</strong> desde o início da sua dieta validada pelo Dr(a) <strong>{nutritionistName}</strong>. Como está se sentindo? Alguma dificuldade com alguma receita? 🍽️</>
                  )}
                  {selectedClient.daysSince > 7 && (
                    <> Sentimos sua falta! 😊 Faz <strong>{selectedClient.daysSince} dias</strong> que você recebeu seu plano alimentar personalizado. Que tal retomarmos juntos? Posso te ajudar com ajustes se precisar! 🌟</>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-2 text-right">
                  Enviado pelo NutriBot • nutrIAprova
                </p>
              </div>

              <div className="rounded-lg bg-accent/30 border border-primary/10 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>ℹ️ Nota:</strong> Esta é uma pré-visualização. A integração com a API do WhatsApp Business será conectada em breve para envio automático.
                </p>
              </div>

              <Button className="w-full emerald-gradient text-primary-foreground" disabled>
                <Phone className="h-4 w-4 mr-2" />
                Disparar Check-in Automático (Em Breve)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}