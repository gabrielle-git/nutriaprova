import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Flame, Droplets, Wheat, Utensils, ChefHat, Lightbulb, Shield, Camera, Instagram } from "lucide-react";
import type { DietPlan } from "@/services/n8nService";
import { toast } from "sonner";
import AiDraftMarkdown, { isStructuredDietPlan, markdownTextFromAiDraft } from "./AiDraftMarkdown";

const MEAL_LABELS: Record<string, { label: string; emoji: string; time: string }> = {
  cafeDaManha: { label: "Café da Manhã", emoji: "☀️", time: "07:00" },
  lancheDaManha: { label: "Lanche da Manhã", emoji: "🍎", time: "10:00" },
  almoco: { label: "Almoço", emoji: "🍛", time: "12:30" },
  lancheDaTarde: { label: "Lanche da Tarde", emoji: "🥤", time: "15:30" },
  jantar: { label: "Jantar", emoji: "🌙", time: "19:00" },
};

interface PremiumDietPlanViewProps {
  /** JSON estruturado ({@link DietPlan}), texto/markdown bruto ou objeto legado sem `meals`. */
  plan?: DietPlan | string | null;
  nutritionistName?: string;
  crnNumber?: string;
  specialty?: string;
  signatureStyle?: "modern" | "classic" | "minimal";
  isCompleted?: boolean;
  /** White-label: clinic logo URL (Premium / Clínica). */
  clinicLogoUrl?: string | null;
  /** Tier do profissional validador — logo quando premium ou clínica. */
  professionalTier?: string | null;
}

export default function PremiumDietPlanView({
  plan,
  nutritionistName = "Nutricionista",
  crnNumber = "CRN não informado",
  specialty,
  signatureStyle = "modern",
  isCompleted = false,
  clinicLogoUrl = null,
  professionalTier = null,
}: PremiumDietPlanViewProps) {
  if (plan == null || plan === "") {
    return (
      <div className="card-clinical p-8 md:p-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="font-display text-base font-semibold text-[hsl(var(--ink-1))]">Preparando seu plano alimentar...</p>
          <p className="max-w-md text-sm text-[hsl(var(--ink-2))]">
            Estamos aguardando os dados da dieta para renderizar as refeições e os macronutrientes.
          </p>
        </div>
      </div>
    );
  }

  const markdownText = markdownTextFromAiDraft(plan);
  if (markdownText) {
    return (
      <div className="space-y-4">
        <AiDraftMarkdown text={markdownText} />
      </div>
    );
  }

  if (!isStructuredDietPlan(plan)) {
    return (
      <div className="card-clinical p-8 md:p-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="max-w-md text-sm text-[hsl(var(--ink-2))]">
            Não foi possível exibir este plano neste formato. Entre em contato com seu nutricionista.
          </p>
        </div>
      </div>
    );
  }

  const showClinicLogo =
    (professionalTier === "clinic" || professionalTier === "premium") &&
    !!clinicLogoUrl;
  const meals = Object.values(plan.meals ?? {});
  const totalProtein = meals.reduce((s, m) => s + (m?.protein ?? 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m?.carbs ?? 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m?.fat ?? 0), 0);
  const totalCal = plan.totalCalories;

  // Macro percentages for visual chart
  const totalMacroGrams = totalProtein + totalCarbs + totalFat;
  const protPct = totalMacroGrams > 0 ? Math.round((totalProtein / totalMacroGrams) * 100) : 0;
  const carbPct = totalMacroGrams > 0 ? Math.round((totalCarbs / totalMacroGrams) * 100) : 0;
  const fatPct = totalMacroGrams > 0 ? 100 - protPct - carbPct : 0;

  const date = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="space-y-0">
      {/* ===== DOCUMENT WRAPPER WITH TECH BORDER ===== */}
      <div className="relative rounded-2xl overflow-hidden">
        {/* Outer tech border */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary via-primary/60 to-primary/30 p-[2px]">
          <div className="w-full h-full rounded-2xl bg-card" />
        </div>

        <div className="relative z-10 p-1">
          {/* Inner content with subtle pattern */}
          <div className="rounded-xl bg-card overflow-hidden">
            {/* ===== DOCUMENT HEADER ===== */}
            <div className="relative border-b border-[hsl(var(--surface-3))] bg-gradient-to-br from-[hsl(var(--surface-1))] to-[hsl(var(--surface-0))] px-6 py-8">
              <div className="absolute left-0 top-0 h-1 w-full emerald-gradient" />

              {/* White-label co-branding bar (Plano Clínica only) */}
              {showClinicLogo && (
                <div className="flex items-center justify-center gap-4 pb-5 mb-5 border-b border-primary/15">
                  <img
                    src={clinicLogoUrl!}
                    alt="Logotipo da Clínica"
                    className="h-12 w-auto max-w-[160px] object-contain"
                    loading="lazy"
                  />
                  <div className="h-8 w-px bg-primary/30" aria-hidden />
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-display font-bold text-sm">Nutr<span className="text-primary">IA</span>prova</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                      {showClinicLogo ? "Plano Clínica · Documento Oficial" : "nutrIAprova"}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-[hsl(var(--ink-1))]">Plano alimentar personalizado</h1>
                  <p className="mt-1 text-sm text-[hsl(var(--ink-2))]">Documento gerado por IA • Validado por profissional CRN</p>
                </div>
                <div className="text-right">
                  <Badge className="emerald-gradient text-primary-foreground text-lg px-5 py-2 font-display font-bold">
                    {totalCal} kcal/dia
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">{date}</p>
                </div>
              </div>
            </div>

            {/* ===== MACRO SUMMARY SECTION ===== */}
            <div className="px-6 py-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full emerald-gradient" />
                <h2 className="font-display font-bold text-sm uppercase tracking-wider text-foreground">Resumo de Macronutrientes</h2>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/30 p-4 text-center">
                  <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl font-display font-bold text-blue-700 dark:text-blue-300">{totalProtein}g</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Proteínas</p>
                  <p className="text-xs text-blue-400 mt-1">{protPct}%</p>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30 p-4 text-center">
                  <Wheat className="h-6 w-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                  <p className="text-2xl font-display font-bold text-amber-700 dark:text-amber-300">{totalCarbs}g</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Carboidratos</p>
                  <p className="text-xs text-amber-400 mt-1">{carbPct}%</p>
                </div>
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/30 p-4 text-center">
                  <Flame className="h-6 w-6 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
                  <p className="text-2xl font-display font-bold text-rose-700 dark:text-rose-300">{totalFat}g</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">Gorduras</p>
                  <p className="text-xs text-rose-400 mt-1">{fatPct}%</p>
                </div>
              </div>

              {/* Visual macro bar */}
              <div className="flex h-[6px] w-full overflow-hidden rounded-full bg-[hsl(var(--surface-3))]">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${protPct}%` }}
                />
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${carbPct}%` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${fatPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-blue-500">Proteínas {protPct}%</span>
                <span className="text-[10px] text-amber-500">Carboidratos {carbPct}%</span>
                <span className="text-[10px] text-rose-500">Gorduras {fatPct}%</span>
              </div>
            </div>

            <Separator className="mx-6" />

            {/* ===== MEALS SECTION ===== */}
            <div className="px-6 py-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-5 rounded-full emerald-gradient" />
                <h2 className="font-display font-bold text-sm uppercase tracking-wider text-foreground">Receitas Detalhadas</h2>
              </div>

              <div className="overflow-hidden rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))]">
                {(["cafeDaManha", "lancheDaManha", "almoco", "lancheDaTarde", "jantar"] as const).map((key) => {
                  const meal = plan.meals[key];
                  if (!meal) return null;
                  const meta = MEAL_LABELS[key] || { label: key, emoji: "🍽️", time: "" };
                  return (
                    <div
                      key={key}
                      className="border-b border-[hsl(var(--surface-3))] last:border-b-0"
                    >
                      <div className="flex items-center gap-3 border-b border-[hsl(var(--surface-3))] bg-gradient-to-r from-[hsl(var(--surface-1))] to-transparent px-5 py-3">
                        <span className="text-2xl">{meta.emoji}</span>
                        <div className="flex-1">
                          <p className="font-display font-bold text-sm">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.time} • {meal.prepTime || "~20 min"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-primary gap-1 h-7 print:hidden"
                            onClick={() => {/* Photo upload placeholder */}}
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Adicionar Foto
                          </Button>
                          <Badge variant="outline" className="text-xs font-mono">
                            <Flame className="h-3 w-3 mr-1 text-destructive" />
                            {meal.calories} kcal
                          </Badge>
                        </div>
                      </div>

                      {/* Photo placeholder area */}
                      <div className="mx-5 mt-4 rounded-lg border-2 border-dashed border-border/50 bg-muted/30 p-4 flex items-center justify-center gap-2 text-muted-foreground print:hidden">
                        <Camera className="h-5 w-5" />
                        <span className="text-xs">Foto do prato (opcional)</span>
                      </div>

                      <div className="p-5 space-y-4">
                        <p className="font-display font-semibold text-base leading-tight">{meal.name}</p>

                        {/* Macros Row */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--ink-2))]">
                            <Droplets className="h-3 w-3 text-primary" /> P: {meal.protein}g
                          </div>
                          <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--ink-2))]">
                            <Wheat className="h-3 w-3 text-primary" /> C: {meal.carbs}g
                          </div>
                          <div className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-2))] px-2.5 py-1.5 text-xs font-medium text-[hsl(var(--ink-2))]">
                            <Flame className="h-3 w-3 text-primary" /> G: {meal.fat}g
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
                })}
              </div>
            </div>

            <Separator className="mx-6" />

            {/* ===== NOTES ===== */}
            {plan.notes && (
              <>
                <Separator className="mx-6" />
                <div className="px-6 py-4">
                  <div className="rounded-lg bg-accent/30 border border-primary/10 p-4">
                    <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">📋 Observações do Nutricionista</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{plan.notes}</p>
                  </div>
                </div>
              </>
            )}

            <Separator className="mx-6" />

            {/* ===== SIGNATURE BLOCK ===== */}
            <div className="px-6 py-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full emerald-gradient" />
                <h2 className="font-display font-bold text-sm uppercase tracking-wider text-foreground">Assinatura Digital</h2>
              </div>

              {signatureStyle === "classic" ? (
                <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-accent/40 to-card p-8 text-center max-w-md mx-auto">
                  <div className="w-20 h-0.5 bg-primary mx-auto mb-4" />
                  <p className="font-serif text-xl font-bold text-foreground italic">{nutritionistName}</p>
                  <p className="text-sm text-primary font-semibold mt-2">Nutricionista — {crnNumber}</p>
                  {specialty && <p className="text-xs text-muted-foreground mt-1">{specialty}</p>}
                  <Separator className="my-4" />
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Validado digitalmente em {date}</p>
                  </div>
                  <div className="w-20 h-0.5 bg-primary mx-auto mt-4" />
                </div>
              ) : signatureStyle === "minimal" ? (
                <div className="rounded-lg border border-border bg-card p-5 max-w-md mx-auto">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{nutritionistName}</p>
                      <p className="text-xs text-muted-foreground">{crnNumber} • {specialty || "Nutrição"}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                      <Badge className="text-[10px] emerald-gradient text-primary-foreground">Verificado</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-right">{date}</p>
                </div>
              ) : (
                /* Modern (default) */
                <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-accent/30 to-primary/5 p-8 text-center relative overflow-hidden max-w-md mx-auto">
                  <div className="absolute top-0 left-0 w-full h-1.5 emerald-gradient" />
                  <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
                  <p className="font-display font-bold text-xl text-foreground">{nutritionistName}</p>
                  <p className="text-sm text-primary font-semibold mt-2">
                    Nutricionista — {crnNumber}
                  </p>
                  {specialty && (
                    <p className="text-xs text-muted-foreground mt-1">Especialidade: {specialty}</p>
                  )}
                  <Separator className="my-4" />
                  <div className="flex items-center justify-center gap-2">
                    <Badge className="text-xs emerald-gradient text-primary-foreground gap-1">
                      <Shield className="h-3 w-3" /> Profissional Verificado
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Validado digitalmente em {date}
                  </p>
                  <div className="absolute bottom-0 left-0 w-full h-1.5 emerald-gradient" />
                </div>
              )}
            </div>

            {/* ===== SHARE + FOOTER ===== */}
            {isCompleted && (
              <div className="px-6 py-4 flex justify-center print:hidden">
                <Button
                  variant="outline"
                  className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => {
                    toast.success("Imagem para Stories gerada! Compartilhe no Instagram 📸");
                  }}
                >
                  <Instagram className="h-4 w-4" />
                  Compartilhar no Instagram
                </Button>
              </div>
            )}
            <div className="px-6 py-4 bg-muted/30 border-t border-border/50 text-center">
              <p className="text-[10px] text-muted-foreground">
                Este documento foi gerado pela plataforma nutrIAprova com auxílio de inteligência artificial e validado por profissional registrado no Conselho Regional de Nutricionistas (CRN).
                Não substitui acompanhamento presencial.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}