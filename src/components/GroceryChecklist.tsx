import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DietPlan } from "@/services/n8nService";
import { cn } from "@/lib/utils";

interface Props {
  dietPlan: DietPlan;
}

export default function GroceryChecklist({ dietPlan }: Props) {
  const allIngredients = Object.values(dietPlan.meals)
    .flatMap((m) => m.ingredients)
    .filter((v, i, a) => a.indexOf(v) === i);

  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (item: string) => {
    const next = new Set(checked);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setChecked(next);
  };

  const progress = allIngredients.length === 0 ? 0 : Math.round((checked.size / allIngredients.length) * 100);

  return (
    <div className="card-clinical overflow-hidden">
      <div className="border-b border-[hsl(var(--surface-3))] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <span className="font-display text-sm font-semibold text-[hsl(var(--ink-1))]">
              Lista de compras semanal
            </span>
          </div>
          <Badge variant="outline" className="border-[hsl(var(--surface-3))] text-xs text-[hsl(var(--ink-2))]">
            {checked.size}/{allIngredients.length} itens
          </Badge>
        </div>
        <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-[hsl(var(--surface-3))]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-glow)))",
            }}
          />
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
          {allIngredients.map((item) => {
            const isOn = checked.has(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors",
                  "hover:bg-[hsl(var(--surface-1))]",
                  isOn && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border",
                    isOn
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))]",
                  )}
                  aria-hidden
                >
                  {isOn ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span
                  className={cn(
                    "text-sm text-[hsl(var(--ink-1))]",
                    isOn && "text-[hsl(var(--ink-3))] line-through decoration-[hsl(var(--ink-3))]",
                  )}
                >
                  {item}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
