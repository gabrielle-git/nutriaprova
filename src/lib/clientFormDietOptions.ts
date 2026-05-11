/**
 * Opções do questionário / perfil — labels gravados em `client_data.allergies` e `client_data.foodPreferences`.
 * Restrições = obrigatórias para a IA evitar; preferências = orientação de estilo (não são alergias).
 */

export const RESTRICTION_OPTIONS = [
  { value: "gluten", label: "Intolerância ao Glúten", emoji: "🌾" },
  { value: "lactose", label: "Intolerância à Lactose", emoji: "🥛" },
  { value: "amendoim", label: "Alergia a Amendoim", emoji: "🥜" },
  { value: "frutos_do_mar", label: "Alergia a Frutos do Mar", emoji: "🦐" },
  { value: "ovo", label: "Alergia a Ovo", emoji: "🥚" },
  { value: "soja", label: "Alergia a Soja", emoji: "🫘" },
  { value: "vegano", label: "Dieta Vegana", emoji: "🌱" },
] as const;

export const FOOD_PREFERENCE_OPTIONS = [
  { value: "vegetariano", label: "Dieta Vegetariana", emoji: "🥬" },
  { value: "pref_frango", label: "Prefiro frango e cortes magros", emoji: "🍗" },
  { value: "pref_peixe", label: "Prefiro peixes e frutos do mar", emoji: "🐟" },
  { value: "low_carb", label: "Afinidade com dieta low carb", emoji: "🥑" },
  { value: "refeicoes_rapidas", label: "Refeições rápidas e práticas", emoji: "⏱️" },
  { value: "alimentos_naturais", label: "Priorizo alimentos naturais / pouco processados", emoji: "🌿" },
] as const;

/** Migra rótulos antigos do perfil para os rótulos canônicos (alinhados ao onboarding). */
const LEGACY_RESTRICTION_LABEL_MAP: Record<string, string> = {
  "Sem Glúten": "Intolerância ao Glúten",
  "Zero Lactose": "Intolerância à Lactose",
  Amendoim: "Alergia a Amendoim",
  "Frutos do Mar": "Alergia a Frutos do Mar",
  Ovo: "Alergia a Ovo",
  Soja: "Alergia a Soja",
  Vegano: "Dieta Vegana",
};

export function canonicalRestrictionLabel(label: string): string {
  return LEGACY_RESTRICTION_LABEL_MAP[label] ?? label;
}

const VEGETARIANO_CANONICAL_LABEL = FOOD_PREFERENCE_OPTIONS[0].label;

/** Versões antigas do rótulo "vegetariano" só em allergies — migram para foodPreferences. */
export function partitionLegacyVegetarianoFromAllergies(allergies: string[]): {
  restrictions: string[];
  migratedPreferences: string[];
} {
  const migratedPreferences: string[] = [];
  const normalized = allergies.map((a) => canonicalRestrictionLabel(a));
  const legacyVegetarianLabels = new Set([
    VEGETARIANO_CANONICAL_LABEL,
    "Vegetariano",
    "Dieta Vegetariana (ovo/leite ok)",
  ]);
  const restrictions = normalized.filter((a) => {
    if (legacyVegetarianLabels.has(a)) {
      if (!migratedPreferences.includes(VEGETARIANO_CANONICAL_LABEL)) {
        migratedPreferences.push(VEGETARIANO_CANONICAL_LABEL);
      }
      return false;
    }
    return true;
  });
  return { restrictions, migratedPreferences };
}
