/**
 * usePlanTier — hook central de planos/moedas do nutrIAprova
 *
 * Fonte única da verdade para limites de plano, limites de IA,
 * flags de acesso e helpers de verificação.
 */

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

export type PlanTier = "freemium" | "basic" | "premium" | "clinic";

export interface TierConfig {
  label: string;
  initialCoins: number;           // moedas ao entrar no plano
  aiCorrectionsPerDay: number | "unlimited";
  canWithdraw: boolean;           // pode sacar ganhos
  advancedDashboard: boolean;
  customSignature: boolean;       // logo + assinatura personalizada
  unlimitedValidations: boolean;  // sem custo de moeda por job (Clínica)
  groupSize: number;              // nutris no grupo (Clínica)
  prioritySupport: boolean;
  priceMonthly: number | null;    // null = gratuito
}

export const TIER_CONFIG: Record<PlanTier, TierConfig> = {
  freemium: {
    label: "Freemium",
    initialCoins: 5,
    aiCorrectionsPerDay: 0,          // sem IA
    canWithdraw: false,              // saldo trancado até assinar plano pago
    advancedDashboard: false,
    customSignature: false,
    unlimitedValidations: false,
    groupSize: 0,
    prioritySupport: false,
    priceMonthly: null,
  },
  basic: {
    label: "Basic",
    initialCoins: 20,
    aiCorrectionsPerDay: 5,
    canWithdraw: true,
    advancedDashboard: false,
    customSignature: false,
    unlimitedValidations: false,
    groupSize: 0,
    prioritySupport: false,
    priceMonthly: 49.9,
  },
  premium: {
    label: "Premium (Pro)",
    initialCoins: 120,
    aiCorrectionsPerDay: 10,
    canWithdraw: true,
    advancedDashboard: true,
    customSignature: false,
    unlimitedValidations: false,
    groupSize: 0,
    prioritySupport: false,
    priceMonthly: 99.9,
  },
  clinic: {
    label: "Clínica",
    initialCoins: 0,                 // validações ilimitadas, sem moedas
    aiCorrectionsPerDay: "unlimited",
    canWithdraw: true,
    advancedDashboard: true,
    customSignature: true,
    unlimitedValidations: true,
    groupSize: 4,
    prioritySupport: true,
    priceMonthly: 199.9,
  },
};

// Retorna a config do tier do perfil passado (fallback: freemium)
export function getTierConfig(tier?: string | null): TierConfig {
  return TIER_CONFIG[(tier as PlanTier) ?? "freemium"] ?? TIER_CONFIG.freemium;
}

// Verifica se o nutri ainda tem correções de IA disponíveis hoje
// (chamadas externas devem passar `usedToday` vindo do banco/cache)
export function canUseAI(tier: PlanTier, usedToday: number): boolean {
  const limit = TIER_CONFIG[tier].aiCorrectionsPerDay;
  if (limit === "unlimited") return true;
  return usedToday < limit;
}

// Custo de moedas para aceitar 1 job (freemium & pago por moeda)
export function jobCoinCost(tier: PlanTier): number {
  if (TIER_CONFIG[tier].unlimitedValidations) return 0;
  return 1;
}

const TIER_ORDER: PlanTier[] = ["freemium", "basic", "premium", "clinic"];

function tierRank(tier: string | undefined): number {
  const t = (tier as PlanTier) || "freemium";
  const i = TIER_ORDER.indexOf(t);
  return i === -1 ? 0 : i;
}

/** Exibe `children` apenas se o plano do usuário for >= `required`. */
export default function PlanGate({
  tier,
  required,
  feature,
  minHeight = 200,
  children,
}: {
  tier: string;
  required: PlanTier;
  feature: string;
  minHeight?: number;
  children: ReactNode;
}) {
  if (tierRank(tier) >= tierRank(required)) {
    return <>{children}</>;
  }

  return (
    <Card
      className="glass-card border-dashed border-muted-foreground/25"
      style={{ minHeight }}
    >
      <CardContent className="flex min-h-[inherit] flex-col items-center justify-center gap-3 p-8 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground max-w-sm">{feature}</p>
      </CardContent>
    </Card>
  );
}