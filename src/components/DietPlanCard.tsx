import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LucideIcon } from "lucide-react";
import {
  ChefHat,
  Lightbulb,
  Utensils,
  Flame,
  Droplets,
  Wheat,
  Info,
  Clock,
  RefreshCw,
  Repeat2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DietPlan, Meal } from "@/services/n8nService";
import GroceryChecklist from "./GroceryChecklist";

const MEAL_LABELS: Record<string, { label: string; emoji: string; time: string }> = {
  cafeDaManha: { label: "Café da Manhã", emoji: "☀️", time: "07:00" },
  lancheDaManha: { label: "Lanche da Manhã", emoji: "🍎", time: "10:00" },
  almoco: { label: "Almoço", emoji: "🍛", time: "12:30" },
  lancheDaTarde: { label: "Lanche da Tarde", emoji: "🥤", time: "15:30" },
  jantar: { label: "Jantar", emoji: "🌙", time: "19:00" },
};

// ── MacroBadge: mostra valor alcançado + meta + barra de progresso ──────────
// Usado apenas na visão do nutricionista.
function MacroBadge({
  icon: Icon,
  label,
  displayValue,
  target,
  progressClass,
  color,
}: {
  icon: LucideIcon;
  label: string;
  displayValue: string;
  target?: number;
  progressClass: string;
  color: string;
}) {
  const hasTarget = typeof target === "number" && target > 0;
  const raw = parseFloat(displayValue.replace(/[^\d.,-]/g, "").replace(",", "."));
  const achieved = Number.isFinite(raw) ? raw : 0;
  const pct = hasTarget ? Math.min(100, Math.round((achieved / target!) * 100)) : 0;

  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl p-3 ${color}`}>
      <Icon className="h-5 w-5" />
      <p className="text-xl font-display font-bold leading-tight">{displayValue}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
      {hasTarget && (
        <>
          <p className="text-[10px] text-muted-foreground/90 font-normal normal-case tracking-normal">
            (Meta: {target}g)
          </p>
          <div className="mt-0.5 h-1 w-full max-w-[5rem] overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${progressClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MealCard({ mealKey, meal }: { mealKey: string; meal: Meal }) {
  const meta = MEAL_LABELS[mealKey] || { label: mealKey, emoji: "🍽️", time: "" };
  const [showAlt, setShowAlt] = useState(false);
  const hasAlternatives = Array.isArray(meal.alternatives) && meal.alternatives.length > 0;
  const hasSubstitutions = Array.isArray(meal.substitutions) && meal.substitutions.length > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 overflow-hidden transition-shadow hover:shadow-md">
      {/* Meal Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-accent/60 to-transparent border-b border-border/30">
        <span className="text-2xl">{meta.emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display font-bold text-sm">{meta.label}</p>
            {meal.timing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Clock className="h-2.5 w-2.5" />
                {meal.timing}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {meta.time} • {meal.prepTime || "~20 min"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          <Flame className="h-3 w-3 mr-1 text-destructive" />
          {meal.calories} kcal
        </Badge>
      </div>

      <div className="p-5 space-y-4">
        <p className="font-display font-semibold text-base leading-tight">{meal.name}</p>

        {/* Macros com label contextual */}
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-medium">Macros desta refeição:</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 text-xs rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1.5 text-blue-700 dark:text-blue-300 font-medium">
              <Droplets className="h-3 w-3" /> P: {meal.protein}g
            </div>
            <div className="flex items-center gap-1.5 text-xs rounded-lg bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1.5 text-amber-700 dark:text-amber-300 font-medium">
              <Wheat className="h-3 w-3" /> C: {meal.carbs}g
            </div>
            <div className="flex items-center gap-1.5 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 text-rose-700 dark:text-rose-300 font-medium">
              <Flame className="h-3 w-3" /> G: {meal.fat}g
            </div>
          </div>
        </div>

        {/* Nota clínica */}
        {meal.clinicalNote && (
          <div className="rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/30 p-3 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed">{meal.clinicalNote}</p>
          </div>
        )}

        {/* Ingredients */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Utensils className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
              Ingredientes
            </p>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {(meal.ingredients ?? []).map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <span className="text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {typeof meal.instructions === "string" && meal.instructions.trim().length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ChefHat className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                Modo de Preparo
              </p>
            </div>
            <div className="space-y-2 text-sm text-foreground/80 leading-relaxed">
              {meal.instructions
                .split(/(?=\d+\.\s)/)
                .filter(Boolean)
                .map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full emerald-gradient text-primary-foreground text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p>{step.replace(/^\d+\.\s*/, "")}</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {meal.tips && (
          <div className="rounded-lg bg-accent/40 border border-primary/10 p-3 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">{meal.tips}</p>
          </div>
        )}

        {/* Substituições de ingredientes */}
        {hasSubstitutions && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Repeat2 className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                Substituições permitidas
              </p>
            </div>
            <div className="space-y-2">
              {meal.substitutions!.map((sub, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-medium text-foreground/80">
                    <span className="text-muted-foreground">Em vez de</span> {sub.original}:
                  </p>
                  <ul className="space-y-0.5 pl-2">
                    {sub.alternatives.map((alt, j) => (
                      <li key={j} className="flex items-center gap-1.5 text-foreground/70">
                        <div className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                        {alt}
                      </li>
                    ))}
                  </ul>
                  {sub.note && <p className="text-muted-foreground italic pt-0.5">{sub.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opção alternativa completa */}
        {hasAlternatives && (
          <div>
            <button
              type="button"
              onClick={() => setShowAlt((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {showAlt ? "Ocultar opção alternativa" : "Ver opção alternativa"}
            </button>
            {showAlt && (
              <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                {meal.alternatives!.map((alt, i) => (
                  <div key={i}>
                    {i > 0 && <div className="border-t border-primary/10 my-2" />}
                    <p className="font-display font-semibold text-sm text-foreground/90">
                      Opção {String.fromCharCode(65 + i)}: {alt.name}
                    </p>
                    <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span>{alt.calories} kcal</span>
                      <span>P: {alt.protein}g</span>
                      <span>C: {alt.carbs}g</span>
                      <span>G: {alt.fat}g</span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {alt.ingredients.map((ing, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-xs text-foreground/70">
                          <div className="w-1 h-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                    {alt.instructions && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{alt.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface DietPlanCardProps {
  plan: DietPlan;
  showNotes?: boolean;
}

export default function DietPlanCard({ plan, showNotes = true }: DietPlanCardProps) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const mealsMap =
    plan?.meals && typeof plan.meals === "object" && !Array.isArray(plan.meals)
      ? plan.meals
      : ({} as DietPlan["meals"]);

  const totalProtein = Object.values(mealsMap).reduce((sum, m) => sum + (m?.protein ?? 0), 0);
  const totalCarbs = Object.values(mealsMap).reduce((sum, m) => sum + (m?.carbs ?? 0), 0);
  const totalFat = Object.values(mealsMap).reduce((sum, m) => sum + (m?.fat ?? 0), 0);
  const totalCal =
    typeof plan.totalCalories === "number" && Number.isFinite(plan.totalCalories)
      ? plan.totalCalories
      : null;
  const calTarget =
    typeof plan.targetCalories === "number" && plan.targetCalories > 0
      ? plan.targetCalories
      : undefined;
  const calPct =
    calTarget != null && totalCal != null ? Math.min(100, Math.round((totalCal / calTarget) * 100)) : 0;

  const hasDays = Array.isArray(plan.days) && plan.days.length > 0;
  const activeMeals = hasDays ? (plan.days![selectedDayIdx]?.meals ?? mealsMap) : mealsMap;

  const hasAnyTarget =
    calTarget != null ||
    (typeof plan.targetProtein === "number" && plan.targetProtein > 0) ||
    (typeof plan.targetCarbs === "number" && plan.targetCarbs > 0) ||
    (typeof plan.targetFat === "number" && plan.targetFat > 0);

  return (
    <div className="space-y-6">
      {hasAnyTarget && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/20 px-4 py-3.5">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
            <span className="font-semibold">Como interpretar estes dados:</span> a IA definiu as{" "}
            <span className="font-medium">metas</span> com base no perfil e objetivo do paciente. Os{" "}
            <span className="font-medium">valores alcançados</span> abaixo representam a soma exata dos macronutrientes
            dos alimentos gerados no cardápio. Pequenas variações (±5%) são aceitáveis e esperadas.
          </p>
        </div>
      )}

      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-accent/40 to-primary/10 border border-primary/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-xl">Plano Alimentar Personalizado</h3>
            <p className="text-sm text-muted-foreground">Gerado por IA • Validado por Nutricionista</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className="emerald-gradient text-primary-foreground text-sm px-4 py-1.5">
              {totalCal != null ? totalCal : "—"} kcal/dia
            </Badge>
            {calTarget != null && (
              <>
                <p className="text-[10px] text-muted-foreground/90">(Meta: {calTarget} kcal)</p>
                <div className="h-1 w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary/80 transition-all"
                    style={{ width: `${calPct}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MacroBadge
            icon={Droplets}
            label="Proteínas"
            displayValue={`${totalProtein}g`}
            target={plan.targetProtein}
            progressClass="bg-blue-500 dark:bg-blue-400"
            color="bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
          />
          <MacroBadge
            icon={Wheat}
            label="Carboidratos"
            displayValue={`${totalCarbs}g`}
            target={plan.targetCarbs}
            progressClass="bg-amber-500 dark:bg-amber-400"
            color="bg-amber-100/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
          />
          <MacroBadge
            icon={Flame}
            label="Gorduras"
            displayValue={`${totalFat}g`}
            target={plan.targetFat}
            progressClass="bg-rose-500 dark:bg-rose-400"
            color="bg-rose-100/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
          />
        </div>
      </div>

      {hasDays && (
        <div
          role="tablist"
          className="flex gap-1 rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] p-1"
        >
          {plan.days!.map((day, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={selectedDayIdx === idx}
              onClick={() => setSelectedDayIdx(idx)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-medium transition-colors",
                selectedDayIdx === idx
                  ? "bg-[hsl(var(--surface-0))] shadow-sm text-[hsl(var(--ink-1))]"
                  : "text-[hsl(var(--ink-2))] hover:text-[hsl(var(--ink-1))]",
              )}
            >
              {day.dayLabel}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {(["cafeDaManha", "lancheDaManha", "almoco", "lancheDaTarde", "jantar"] as const).map((key) => {
          const meal = activeMeals[key];
          if (!meal) return null;
          return <MealCard key={`${selectedDayIdx}-${key}`} mealKey={key} meal={meal} />;
        })}
      </div>

      <GroceryChecklist dietPlan={plan} />

      {showNotes && plan.notes && (
        <>
          <Separator />
          <div className="rounded-lg bg-accent/30 border border-primary/10 p-4">
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              📋 Observações do Nutricionista
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">{plan.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}
