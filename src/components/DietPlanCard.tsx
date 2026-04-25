import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChefHat, Lightbulb, Utensils, Flame, Droplets, Wheat } from "lucide-react";
import type { DietPlan, Meal } from "@/services/n8nService";

const MEAL_LABELS: Record<string, { label: string; emoji: string; time: string }> = {
  cafeDaManha: { label: "Café da Manhã", emoji: "☀️", time: "07:00" },
  lancheDaManha: { label: "Lanche da Manhã", emoji: "🍎", time: "10:00" },
  almoco: { label: "Almoço", emoji: "🍛", time: "12:30" },
  lancheDaTarde: { label: "Lanche da Tarde", emoji: "🥤", time: "15:30" },
  jantar: { label: "Jantar", emoji: "🌙", time: "19:00" },
};

function MacroBadge({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-xl p-3 ${color}`}>
      <Icon className="h-5 w-5" />
      <p className="text-xl font-display font-bold">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p>
    </div>
  );
}

function MealCard({ mealKey, meal }: { mealKey: string; meal: Meal }) {
  const meta = MEAL_LABELS[mealKey] || { label: mealKey, emoji: "🍽️", time: "" };

  return (
    <div className="rounded-xl border border-border/60 bg-card/80 overflow-hidden transition-shadow hover:shadow-md">
      {/* Meal Header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-accent/60 to-transparent border-b border-border/30">
        <span className="text-2xl">{meta.emoji}</span>
        <div className="flex-1">
          <p className="font-display font-bold text-sm">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{meta.time} • {meal.prepTime || "~20 min"}</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          <Flame className="h-3 w-3 mr-1 text-destructive" />
          {meal.calories} kcal
        </Badge>
      </div>

      <div className="p-5 space-y-4">
        {/* Dish Name */}
        <p className="font-display font-semibold text-base leading-tight">{meal.name}</p>

        {/* Macros Row */}
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

        {/* Ingredients */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Utensils className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Ingredientes</p>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {meal.ingredients.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <span className="text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        {meal.instructions && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ChefHat className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">Modo de Preparo</p>
            </div>
            <div className="space-y-2 text-sm text-foreground/80 leading-relaxed">
              {meal.instructions.split(/(?=\d+\.\s)/).filter(Boolean).map((step, i) => (
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
      </div>
    </div>
  );
}

interface DietPlanCardProps {
  plan: DietPlan;
  showNotes?: boolean;
}

export default function DietPlanCard({ plan, showNotes = true }: DietPlanCardProps) {
  const totalProtein = Object.values(plan.meals).reduce((sum, m) => sum + m.protein, 0);
  const totalCarbs = Object.values(plan.meals).reduce((sum, m) => sum + m.carbs, 0);
  const totalFat = Object.values(plan.meals).reduce((sum, m) => sum + m.fat, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-accent/40 to-primary/10 border border-primary/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-xl">Plano Alimentar Personalizado</h3>
            <p className="text-sm text-muted-foreground">Gerado por IA • Validado por Nutricionista</p>
          </div>
          <Badge className="emerald-gradient text-primary-foreground text-sm px-4 py-1.5">
            {plan.totalCalories} kcal/dia
          </Badge>
        </div>

        {/* Total Macros */}
        <div className="grid grid-cols-3 gap-3">
          <MacroBadge icon={Droplets} label="Proteínas" value={`${totalProtein}g`} color="bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300" />
          <MacroBadge icon={Wheat} label="Carboidratos" value={`${totalCarbs}g`} color="bg-amber-100/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300" />
          <MacroBadge icon={Flame} label="Gorduras" value={`${totalFat}g`} color="bg-rose-100/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300" />
        </div>
      </div>

      {/* Meals - enforced chronological order */}
      <div className="space-y-4">
        {(["cafeDaManha", "lancheDaManha", "almoco", "lancheDaTarde", "jantar"] as const).map((key) => {
          const meal = plan.meals[key];
          if (!meal) return null;
          return <MealCard key={key} mealKey={key} meal={meal} />;
        })}
      </div>

      {/* Notes */}
      {showNotes && plan.notes && (
        <>
          <Separator />
          <div className="rounded-lg bg-accent/30 border border-primary/10 p-4">
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">📋 Observações do Nutricionista</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{plan.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}
