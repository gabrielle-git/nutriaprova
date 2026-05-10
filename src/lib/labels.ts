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

export function allergyLabel(raw: string | null | undefined): string {
  if (!raw) return raw ?? "";
  return ALLERGY_LABELS[raw.toLowerCase()] ?? raw;
}
