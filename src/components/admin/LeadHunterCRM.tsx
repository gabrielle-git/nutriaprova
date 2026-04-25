import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Radar, Stethoscope, Dumbbell, Users, Plus, Send, Sparkles, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";

type LeadCategory = "nutritionist" | "personal_trainer" | "client";

type LeadStatus =
  | "novo"
  | "mensagem_enviada"
  | "em_negociacao"
  | "convertido"
  | "descartado";

interface Lead {
  id: string;
  category: LeadCategory;
  name: string;
  social: string;
  phone: string;
  niche: string;
  status: LeadStatus;
  createdAt: string;
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo Lead",
  mensagem_enviada: "Mensagem Enviada",
  em_negociacao: "Em Negociação",
  convertido: "Convertido",
  descartado: "Descartado",
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  novo: "bg-primary/15 text-primary border-primary/40",
  mensagem_enviada: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  em_negociacao: "bg-[hsl(45,93%,47%)]/15 text-[hsl(45,93%,60%)] border-[hsl(45,93%,47%)]/40",
  convertido: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  descartado: "bg-red-500/15 text-red-300 border-red-500/40",
};

const CATEGORY_META: Record<LeadCategory, { label: string; icon: typeof Stethoscope; greeting: (name: string) => string }> = {
  nutritionist: {
    label: "Nutricionistas",
    icon: Stethoscope,
    greeting: (name) =>
      `Olá ${name}! Vi seu perfil no Instagram e adorei seu trabalho com nutrição. Sou da nutrIAprova — uma plataforma que ajuda nutricionistas a validar dietas geradas por IA e ganhar de R$ 15 a R$ 25 por validação. Posso te explicar em 2 min?`,
  },
  personal_trainer: {
    label: "Personal Trainers",
    icon: Dumbbell,
    greeting: (name) =>
      `Olá ${name}! Vi seu trabalho como Personal e queria te apresentar a nutrIAprova: você indica seus alunos para gerarem dieta validada e ganha comissão recorrente em cada cliente. Posso te mandar os detalhes?`,
  },
  client: {
    label: "Clientes/Pacientes",
    icon: Users,
    greeting: (name) =>
      `Oi ${name}! Tudo bem? Sou da nutrIAprova — geramos uma dieta personalizada com IA validada por nutricionista real por apenas R$ 39,90. Quer que eu te envie o link para começar agora?`,
  },
};

const MOCK_LEADS: Lead[] = [
  { id: "n1", category: "nutritionist", name: "Dra. Camila Souza", social: "@nutri.camila", phone: "5511988887777", niche: "Emagrecimento feminino", status: "novo", createdAt: new Date().toISOString() },
  { id: "n2", category: "nutritionist", name: "Dr. Rafael Lima", social: "@drrafaelnutri", phone: "5521977776666", niche: "Hipertrofia / esportiva", status: "mensagem_enviada", createdAt: new Date().toISOString() },
  { id: "p1", category: "personal_trainer", name: "Lucas Ferreira", social: "@lucasfer.coach", phone: "5531966665555", niche: "CrossFit / funcional", status: "em_negociacao", createdAt: new Date().toISOString() },
  { id: "p2", category: "personal_trainer", name: "Bruna Oliveira", social: "@brunaoliveira.fit", phone: "5511955554444", niche: "Mulheres pós-parto", status: "novo", createdAt: new Date().toISOString() },
  { id: "c1", category: "client", name: "Mariana Alves", social: "@mari.alves", phone: "5511944443333", niche: "Quer emagrecer 8kg", status: "novo", createdAt: new Date().toISOString() },
  { id: "c2", category: "client", name: "João Pedro", social: "@jpedro.fit", phone: "5511933332222", niche: "Ganho de massa", status: "convertido", createdAt: new Date().toISOString() },
];

export default function LeadHunterCRM() {
  const [leads, setLeads] = useState<Lead[]>(MOCK_LEADS);
  const [activeTab, setActiveTab] = useState<LeadCategory>("nutritionist");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", social: "", phone: "", niche: "" });

  const filtered = useMemo(
    () =>
      leads
        .filter((l) => l.category === activeTab)
        .filter(
          (l) =>
            !search ||
            l.name.toLowerCase().includes(search.toLowerCase()) ||
            l.social.toLowerCase().includes(search.toLowerCase()) ||
            l.niche.toLowerCase().includes(search.toLowerCase())
        ),
    [leads, activeTab, search]
  );

  const updateStatus = (id: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    toast.success(`Status atualizado: ${STATUS_LABELS[status]}`);
  };

  const removeLead = (id: string) => {
    if (!confirm("Remover este lead?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    toast.success("Lead removido");
  };

  const fireWhatsapp = (lead: Lead) => {
    const greeting = CATEGORY_META[lead.category].greeting(lead.name.split(" ")[0]);
    const phone = lead.phone.replace(/\D/g, "");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(greeting)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    if (lead.status === "novo") updateStatus(lead.id, "mensagem_enviada");
  };

  const addLead = () => {
    if (!draft.name || !draft.phone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    const newLead: Lead = {
      id: `${activeTab}-${Date.now()}`,
      category: activeTab,
      name: draft.name,
      social: draft.social,
      phone: draft.phone,
      niche: draft.niche,
      status: "novo",
      createdAt: new Date().toISOString(),
    };
    setLeads((prev) => [newLead, ...prev]);
    setDraft({ name: "", social: "", phone: "", niche: "" });
    setAddOpen(false);
    toast.success("Lead adicionado ao CRM");
  };

  return (
    <Card className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <CardTitle className="font-display text-[hsl(150,10%,95%)] flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary" />
            Radar de Leads (CRM)
          </CardTitle>

          {/* Premium banner */}
          <div className="rounded-lg border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-3 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
            <p className="text-xs sm:text-sm text-[hsl(150,10%,85%)]">
              <span className="font-semibold text-primary">CRM Integrado:</span> Sistema pronto para receber leads de varredura externa via API.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeadCategory)}>
          <TabsList className="bg-[hsl(160,20%,10%)] border border-[hsl(160,15%,15%)] flex-wrap mb-4">
            {(Object.keys(CATEGORY_META) as LeadCategory[]).map((cat) => {
              const Icon = CATEGORY_META[cat].icon;
              const count = leads.filter((l) => l.category === cat).length;
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {CATEGORY_META[cat].label}
                  <Badge className="ml-2 bg-[hsl(160,15%,18%)] text-[hsl(150,10%,80%)] text-[10px] h-4 px-1.5">
                    {count}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(Object.keys(CATEGORY_META) as LeadCategory[]).map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-3">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(150,10%,55%)]" />
                  <Input
                    placeholder="Buscar por nome, @ ou nicho..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] text-[hsl(150,10%,90%)] placeholder:text-[hsl(150,10%,40%)]"
                  />
                </div>
                <Button
                  onClick={() => setAddOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Lead Manualmente
                </Button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-[hsl(160,15%,15%)]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[hsl(160,15%,15%)] hover:bg-transparent">
                      <TableHead className="text-[hsl(150,10%,55%)] whitespace-nowrap">Nome</TableHead>
                      <TableHead className="text-[hsl(150,10%,55%)] whitespace-nowrap">Rede Social (@)</TableHead>
                      <TableHead className="text-[hsl(150,10%,55%)] whitespace-nowrap">Telefone/WhatsApp</TableHead>
                      <TableHead className="text-[hsl(150,10%,55%)] whitespace-nowrap">Origem/Nicho</TableHead>
                      <TableHead className="text-[hsl(150,10%,55%)] whitespace-nowrap">Status do Lead</TableHead>
                      <TableHead className="text-[hsl(150,10%,55%)] whitespace-nowrap text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow className="border-[hsl(160,15%,15%)] hover:bg-transparent">
                        <TableCell colSpan={6} className="text-center text-[hsl(150,10%,55%)] py-8">
                          Nenhum lead encontrado nesta categoria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((lead) => (
                        <TableRow key={lead.id} className="border-[hsl(160,15%,15%)] hover:bg-[hsl(160,20%,10%)]">
                          <TableCell className="font-medium text-[hsl(150,10%,92%)] whitespace-nowrap">{lead.name}</TableCell>
                          <TableCell className="text-[hsl(150,10%,75%)] whitespace-nowrap">{lead.social || "—"}</TableCell>
                          <TableCell className="text-[hsl(150,10%,75%)] whitespace-nowrap font-mono text-xs">{lead.phone}</TableCell>
                          <TableCell className="text-[hsl(150,10%,75%)] whitespace-nowrap">{lead.niche || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Select
                              value={lead.status}
                              onValueChange={(v) => updateStatus(lead.id, v as LeadStatus)}
                            >
                              <SelectTrigger className={`h-8 w-[180px] text-xs border ${STATUS_STYLES[lead.status]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,18%)]">
                                {(Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                                  <SelectItem key={s} value={s} className="text-[hsl(150,10%,90%)]">
                                    {STATUS_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => fireWhatsapp(lead)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8"
                              >
                                <Send className="h-3.5 w-3.5" />
                                Disparar Automação
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeLead(lead.id)}
                                className="h-8 w-8 p-0 text-[hsl(150,10%,55%)] hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Add Lead Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-[hsl(160,20%,8%)] border-[hsl(160,15%,15%)] text-[hsl(150,10%,90%)]">
          <DialogHeader>
            <DialogTitle className="font-display text-[hsl(150,10%,95%)] flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Adicionar Lead — {CATEGORY_META[activeTab].label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-[hsl(150,10%,70%)]">Nome *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Dra. Camila Souza"
                className="bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-[hsl(150,10%,70%)]">Rede Social (@)</Label>
              <Input
                value={draft.social}
                onChange={(e) => setDraft({ ...draft, social: e.target.value })}
                placeholder="@usuario"
                className="bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-[hsl(150,10%,70%)]">Telefone/WhatsApp * (com DDI, ex: 5511999998888)</Label>
              <Input
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, "") })}
                placeholder="5511999998888"
                className="bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] mt-1 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs text-[hsl(150,10%,70%)]">Origem/Nicho</Label>
              <Textarea
                value={draft.niche}
                onChange={(e) => setDraft({ ...draft, niche: e.target.value })}
                placeholder="Ex: Emagrecimento feminino / Instagram"
                className="bg-[hsl(160,20%,6%)] border-[hsl(160,15%,18%)] mt-1 min-h-[60px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addLead} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Salvar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
