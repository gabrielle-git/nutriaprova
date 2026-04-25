/**
 * DashboardNutri.tsx
 * ─────────────────────────────────────────────────────────────────
 * Dashboard do nutricionista com exemplo REAL de uso do PlanGate.
 *
 * O gráfico "Evolução de Faturamento" (AreaChart) só é visível
 * para planos Premium e Clínica.
 * O gráfico simples de "Validações do Mês" é liberado para todos.
 *
 * Uso: substitua ou importe dentro do NutritionistDashboard.tsx
 * existente, ou use como página isolada em /dashboard-nutri.
 *
 * Dependências já presentes no projeto:
 *   recharts, @/components/ui/*, @/hooks/useAuth, PlanGate
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PlanGate from "@/components/PlanGate";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, CheckCircle2, Clock, Coins,
  Wallet, ArrowUpRight, BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// ── Dados de exemplo (substitua por consulta real ao Supabase) ───
const MONTHLY_EARNINGS = [
  { month: "Jan", faturamento: 120,  liquido: 90  },
  { month: "Fev", faturamento: 200,  liquido: 150 },
  { month: "Mar", faturamento: 180,  liquido: 135 },
  { month: "Abr", faturamento: 340,  liquido: 255 },
  { month: "Mai", faturamento: 280,  liquido: 210 },
  { month: "Jun", faturamento: 420,  liquido: 315 },
];

const MONTHLY_VALIDATIONS = [
  { month: "Jan", validacoes: 4  },
  { month: "Fev", validacoes: 7  },
  { month: "Mar", validacoes: 6  },
  { month: "Abr", validacoes: 12 },
  { month: "Mai", validacoes: 9  },
  { month: "Jun", validacoes: 14 },
];

// ── Tooltip customizado do recharts ──────────────────────────────
function BRLTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm shadow-md">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}:{" "}
          {p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────
export default function DashboardNutri() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount]     = useState(0);
  const [credits, setCredits]               = useState(profile?.credits ?? 0);

  const tier = (profile as any)?.plan_tier as string | undefined ?? "freemium";

  // Busca contadores reais do Supabase
  useEffect(() => {
    if (!user) return;
    supabase
      .from("diet_requests")
      .select("status")
      .eq("nutritionist_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setCompletedCount(data.filter((d) => d.status === "completed").length);
        setPendingCount(data.filter((d) => d.status === "pending").length);
      });
  }, [user]);

  useEffect(() => {
    setCredits(profile?.credits ?? 0);
  }, [profile]);

  const totalEarned = completedCount * 15; // R$ 15 por validação

  return (
    <div className="space-y-6">
      {/* ── Cartões de resumo ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Validações",
            value: completedCount,
            icon: CheckCircle2,
            color: "text-primary",
            suffix: "",
          },
          {
            label: "Pendentes",
            value: pendingCount,
            icon: Clock,
            color: "text-amber-500",
            suffix: "",
          },
          {
            label: "Moedas",
            value: credits,
            icon: Coins,
            color: "text-yellow-500",
            suffix: "",
          },
          {
            label: "Ganhos totais",
            value: totalEarned,
            icon: Wallet,
            color: "text-emerald-600",
            suffix: "",
            format: "brl",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          const display =
            stat.format === "brl"
              ? stat.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : String(stat.value);
          return (
            <Card key={stat.label} className="glass-card">
              <CardContent className="pt-4 pb-4 text-center">
                <Icon className={`h-6 w-6 mx-auto mb-1 ${stat.color}`} />
                <p className="text-xl font-display font-bold">{display}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Gráficos ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Validações do mês — LIBERADO PARA TODOS */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Validações por Mês
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">Todos os planos</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={MONTHLY_VALIDATIONS}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="validacoes"
                  name="Validações"
                  fill="hsl(160, 84%, 39%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ── Evolução de Faturamento — BLOQUEADO PARA FREEMIUM E BASIC ── */}
        <div>
          <PlanGate
            tier={tier}
            required="premium"
            feature="Evolução de Faturamento — disponível no Plano Premium e Clínica"
            minHeight={240}
          >
            {/* Este conteúdo só renderiza se tier >= premium */}
            <Card className="glass-card h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-display flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Evolução de Faturamento (R$)
                  </CardTitle>
                  <Badge className="text-[10px] emerald-gradient text-primary-foreground">
                    Premium+
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={MONTHLY_EARNINGS}>
                    <defs>
                      <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0}   />
                      </linearGradient>
                      <linearGradient id="gradLiq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(217, 91%, 60%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip content={<BRLTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="faturamento"
                      name="Faturamento bruto"
                      stroke="hsl(160, 84%, 39%)"
                      fill="url(#gradFat)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="liquido"
                      name="Valor líquido"
                      stroke="hsl(217, 91%, 60%)"
                      fill="url(#gradLiq)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </PlanGate>
        </div>
      </div>

      {/* ── Banner de saque (só aparece para planos que podem sacar) ── */}
      {["basic", "premium", "clinic"].includes(tier) && totalEarned > 0 && (
        <Card className="glass-card border-primary/30">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl emerald-gradient flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display font-semibold text-sm">
                  Você tem{" "}
                  {totalEarned.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{" "}
                  disponíveis para saque
                </p>
                <p className="text-xs text-muted-foreground">
                  Processado em até 2 dias úteis via PIX
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="emerald-gradient text-primary-foreground gap-1.5 flex-shrink-0"
              onClick={() => navigate("/cadastro-pix")}
            >
              Solicitar Saque <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Banner de saldo trancado para Freemium */}
      {tier === "freemium" && completedCount > 0 && (
        <Card className="glass-card border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                  Saldo trancado:{" "}
                  {totalEarned.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Faça upgrade para desbloquear saques. O saldo pode ser usado como desconto.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 flex-shrink-0"
              onClick={() => navigate("/planos")}
            >
              Ver Planos
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
