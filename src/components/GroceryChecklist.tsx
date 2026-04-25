import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DietPlan } from "@/services/n8nService";

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

  const progress = Math.round((checked.size / allIngredients.length) * 100);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-display flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Lista de Compras Semanal
          </div>
          <Badge variant="outline" className="text-xs">
            {checked.size}/{allIngredients.length} itens
          </Badge>
        </CardTitle>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className="h-full emerald-gradient rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {allIngredients.map((item) => (
            <label
              key={item}
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                checked.has(item) ? "bg-accent/50 line-through text-muted-foreground" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox
                checked={checked.has(item)}
                onCheckedChange={() => toggle(item)}
              />
              <span className="text-sm">{item}</span>
              {checked.has(item) && <Check className="h-3 w-3 text-primary ml-auto" />}
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
