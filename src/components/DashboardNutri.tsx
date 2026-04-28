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
import { cn } from "@/lib/utils";
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
    <div className="rounded-lg border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] p-3 text-sm shadow-md">
      <p className="mb-1 font-display font-semibold text-[hsl(var(--ink-1))]">{label}</p>
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

  const planBadge =
    tier === "premium" || tier === "clinic" ? (
      <span className="badge-gold rounded-full px-2.5 py-0.5 text-xs font-semibold">Pro</span>
    ) : tier === "freemium" ? (
      <span className="rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ink-2))]">Free</span>
    ) : (
      <span className="rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--ink-2))]">Básico</span>
    );

  return (
    <div className="space-y-6">
      <div className="border-b border-[1px] border-[hsl(var(--surface-3))] pb-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-[hsl(var(--ink-1))]">Painel Clínico</h1>
          {planBadge}
        </div>
        <p className="mt-1 text-sm font-sans text-[hsl(var(--ink-3))]">Métricas e evolução do seu consultório</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          {
            label: "Validações",
            value: completedCount,
            icon: CheckCircle2,
            color: "text-[hsl(var(--primary))]",
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
            color: "text-coin-gold",
            suffix: "",
          },
          {
            label: "Ganhos totais",
            value: totalEarned,
            icon: Wallet,
            color: "text-[hsl(var(--primary))]",
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
            <div
              key={stat.label}
              className="card-clinical p-4 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <Icon className={cn("mx-auto mb-1.5 h-5 w-5", stat.color)} />
              <p className="font-display text-lg font-bold tabular-nums text-[hsl(var(--ink-1))]">{display}</p>
              <p className="text-[10px] font-medium font-sans text-[hsl(var(--ink-3))]">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="card-clinical overflow-hidden border-[hsl(var(--surface-3))] p-0 shadow-sm">
          <div className="border-b border-[1px] border-[hsl(var(--surface-3))] px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display flex items-center gap-2 text-sm font-semibold text-[hsl(var(--ink-1))]">
                <BarChart3 className="h-4 w-4 text-[hsl(var(--primary))]" />
                Validações por mês
              </h3>
              <Badge variant="outline" className="text-[10px] text-[hsl(var(--ink-3))]">Todos os planos</Badge>
            </div>
          </div>
          <div className="p-3">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={MONTHLY_VALIDATIONS}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-3))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--surface-0))",
                    border: "1px solid hsl(var(--surface-3))",
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="validacoes" name="Validações" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <PlanGate
            tier={tier}
            required="premium"
            feature="Evolução de Faturamento — disponível no Plano Premium e Clínica"
            minHeight={240}
          >
            <div className="card-clinical h-full overflow-hidden border-[hsl(var(--surface-3))] p-0 shadow-sm">
              <div className="border-b border-[1px] border-[hsl(var(--surface-3))] px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display flex items-center gap-2 text-sm font-semibold text-[hsl(var(--ink-1))]">
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--primary))]" />
                    Evolução de faturamento (R$)
                  </h3>
                  <Badge className="text-[10px] emerald-gradient text-primary-foreground">Premium+</Badge>
                </div>
              </div>
              <div className="p-3">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={MONTHLY_EARNINGS}>
                    <defs>
                      <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradLiq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--surface-3))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--ink-3))" }} stroke="hsl(var(--ink-3))" />
                    <Tooltip content={<BRLTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="faturamento"
                      name="Faturamento bruto"
                      stroke="hsl(var(--primary))"
                      fill="url(#gradFat)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="liquido"
                      name="Valor líquido"
                      stroke="hsl(var(--info))"
                      fill="url(#gradLiq)"
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </PlanGate>
        </div>
      </div>

      {/* ── Banner de saque (só aparece para planos que podem sacar) ── */}
      {["basic", "premium", "clinic"].includes(tier) && totalEarned > 0 && (
        <div className="card-clinical border-primary/25 p-0 overflow-hidden">
          <div className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl emerald-gradient">
                <Wallet className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">
                  Você tem{" "}
                  {totalEarned.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{" "}
                  disponíveis para saque
                </p>
                <p className="text-xs text-[hsl(var(--ink-3))]">Processado em até 2 dias úteis via PIX</p>
              </div>
            </div>
            <Button
              size="sm"
              className="emerald-gradient flex-shrink-0 gap-1.5 text-primary-foreground"
              onClick={() => navigate("/cadastro-pix")}
            >
              Solicitar Saque <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {tier === "freemium" && completedCount > 0 && (
        <div className="card-clinical border-amber-300/50 bg-amber-50/50 p-0 dark:border-amber-800/50 dark:bg-amber-950/20">
          <div className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  Saldo trancado: {totalEarned.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
                <p className="text-xs text-amber-800/90 dark:text-amber-400/90">Faça upgrade para desbloquear saques. O saldo pode ser usado como desconto.</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              onClick={() => navigate("/planos")}
            >
              Ver Planos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
