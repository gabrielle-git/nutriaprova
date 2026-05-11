/** Traduz o valor salvo no banco para exibição em PT-BR. */
export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentário",
  light: "Levemente ativo",
  moderate: "Moderado",
  active: "Ativo",
  very_active: "Muito ativo",
};

export function activityLabel(raw: string | null | undefined): string {
  if (!raw) return "Não informado";
  return ACTIVITY_LABELS[raw.toLowerCase()] ?? raw;
}

export const ALLERGY_LABELS: Record<string, string> = {
  gluten: "Intolerância ao Glúten",
  lactose: "Intolerância à Lactose",
  amendoim: "Alergia a Amendoim",
  frutos_do_mar: "Alergia a Frutos do Mar",
  ovo: "Alergia a Ovo",
  soja: "Alergia a Soja",
  vegano: "Dieta Vegana",
  vegetariano: "Dieta Vegetariana",
};

/** Rótulos para valores de `client_data.foodPreferences` (chaves ou textos curtos). */
export const FOOD_PREFERENCE_LABELS: Record<string, string> = {
  vegetariano: "Dieta Vegetariana",
  pref_frango: "Prefiro frango e cortes magros",
  pref_peixe: "Prefiro peixes e frutos do mar",
  low_carb: "Afinidade com dieta low carb",
  refeicoes_rapidas: "Refeições rápidas e práticas",
  alimentos_naturais: "Priorizo alimentos naturais / pouco processados",
};

export function allergyLabel(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  return ALLERGY_LABELS[raw.toLowerCase()] ?? raw;
}

export function preferenceLabel(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  const key = raw.toLowerCase();
  if (FOOD_PREFERENCE_LABELS[key]) return FOOD_PREFERENCE_LABELS[key];
  const byFullLabel = Object.values(FOOD_PREFERENCE_LABELS).find(
    (label) => label.toLowerCase() === key,
  );
  return byFullLabel ?? raw;
}
