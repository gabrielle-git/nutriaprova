import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Users, AlertTriangle, CheckCircle2, Clock, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

interface ClientRetention {
  id: string;
  clientId: string;
  name: string;
  dietDate: string;
  daysSince: number;
  status: "active" | "warning" | "risk";
  lastCheckin: string | null;
}

const STATUS_CONFIG = {
  active: { label: "Ativo", color: "bg-primary/20 text-primary border-primary/30", icon: CheckCircle2 },
  warning: { label: "Dia 7", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-300 dark:border-amber-700", icon: Clock },
  risk: { label: "Alerta de Desistência", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
};

interface RetentionTabProps {
  nutritionistName: string;
  nutritionistUserId?: string;
}

type DietRequestRow = Database["public"]["Tables"]["diet_requests"]["Row"];

function daysSinceFromDate(isoDate: string): number {
  const start = new Date(isoDate);
  if (Number.isNaN(start.getTime())) return 0;
  const diffMs = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function retentionStatus(daysSince: number): ClientRetention["status"] {
  if (daysSince <= 6) return "active";
  if (daysSince <= 10) return "warning";
  return "risk";
}

function humanizeLastCheckin(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return d.toLocaleDateString("pt-BR");
}

function clientNameFromRequest(
  req: DietRequestRow,
  profileName: string | null | undefined,
): string {
  if (profileName && profileName.trim()) return profileName.trim();
  const cd = req.client_data;
  if (cd && typeof cd === "object" && !Array.isArray(cd)) {
    const asRecord = cd as Record<string, unknown>;
    const byFullName = asRecord.full_name;
    const byName = asRecord.name;
    if (typeof byFullName === "string" && byFullName.trim()) return byFullName.trim();
    if (typeof byName === "string" && byName.trim()) return byName.trim();
  }
  return `Paciente #${req.client_id.slice(0, 8)}`;
}

export default function RetentionTab({ nutritionistName, nutritionistUserId }: RetentionTabProps) {
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRetention | null>(null);
  const [clients, setClients] = useState<ClientRetention[]>([]);
  const [loading, setLoading] = useState(true);

  const openWhatsappPreview = (client: ClientRetention) => {
    setSelectedClient(client);
    setWhatsappModalOpen(true);
  };

  useEffect(() => {
    const fetchRetentionClients = async () => {
      if (!nutritionistUserId) {
        setClients([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data: requestsData, error: reqError } = await supabase
        .from("diet_requests")
        .select("id, client_id, client_data, created_at, status, updated_at, nutritionist_id")
        .eq("nutritionist_id", nutritionistUserId)
        .in("status", ["in_review", "completed"])
        .order("created_at", { ascending: false })
        .limit(120);

      if (reqError || !requestsData) {
        setClients([]);
        setLoading(false);
        return;
      }

      const latestByClient = new Map<string, DietRequestRow>();
      for (const req of requestsData as DietRequestRow[]) {
        if (!latestByClient.has(req.client_id)) latestByClient.set(req.client_id, req);
      }

      const clientIds = Array.from(latestByClient.keys());
      if (clientIds.length === 0) {
        setClients([]);
        setLoading(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", clientIds);

      const namesByUserId = new Map<string, string>();
      for (const p of profilesData ?? []) {
        namesByUserId.set(p.user_id, p.full_name ?? "");
      }

      const normalized = Array.from(latestByClient.values())
        .map((req) => {
          const daysSince = daysSinceFromDate(req.created_at);
          const status = retentionStatus(daysSince);
          return {
            id: req.id,
            clientId: req.client_id,
            name: clientNameFromRequest(req, namesByUserId.get(req.client_id)),
            dietDate: req.created_at,
            daysSince,
            status,
            lastCheckin: humanizeLastCheckin((req as { updated_at?: string | null }).updated_at ?? null),
          } satisfies ClientRetention;
        })
        .sort((a, b) => new Date(b.dietDate).getTime() - new Date(a.dietDate).getTime());

      setClients(normalized);
      setLoading(false);
    };

    void fetchRetentionClients();
  }, [nutritionistUserId]);

  const activeCount = useMemo(() => clients.filter((c) => c.status === "active").length, [clients]);
  const riskCount = useMemo(() => clients.filter((c) => c.status === "risk").length, [clients]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="pt-4 pb-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-display font-bold text-primary">{clients.length}</p>
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Carregando acompanhamento...
                    </TableCell>
                  </TableRow>
                ) : clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum paciente em acompanhamento ainda.
                    </TableCell>
                  </TableRow>
                ) : clients.map((client) => {
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