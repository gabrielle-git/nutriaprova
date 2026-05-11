import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DietPlan, Meal } from "@/services/n8nService";

const AI_DRAFT_MEAL_KEYWORD = /(café|cafe|lanche|almoço|almoco|jantar|ceia)/i;

function extractMealHeadingTitle(line: string): string | null {
  const t = line.trim();
  if (t.startsWith("## ")) return t.slice(3).trim();
  if (t.startsWith("**")) {
    const closed = t.match(/^\*\*([^*]+)\*\*/);
    if (closed) return closed[1].trim();
    const partial = t.match(/^\*\*([^*]+)/);
    if (partial) return partial[1].trim();
  }
  return null;
}

function isMealSectionHeadingLine(line: string): boolean {
  const title = extractMealHeadingTitle(line);
  if (!title) return false;
  const n = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return AI_DRAFT_MEAL_KEYWORD.test(n);
}

function mealVisualFromTitle(title: string): { label: string; emoji: string; borderL: string; badge: string } {
  const n = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/cafe/.test(n)) {
    return {
      label: title,
      emoji: "☀️",
      borderL: "border-l-emerald-500",
      badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    };
  }
  if (/lanche/.test(n)) {
    return {
      label: title,
      emoji: "🍎",
      borderL: "border-l-orange-500",
      badge: "border-orange-500/40 bg-orange-500/10 text-orange-900 dark:text-orange-100",
    };
  }
  if (/almoco/.test(n)) {
    return {
      label: title,
      emoji: "🍛",
      borderL: "border-l-amber-500",
      badge: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    };
  }
  if (/jantar/.test(n)) {
    return {
      label: title,
      emoji: "🌙",
      borderL: "border-l-indigo-500",
      badge: "border-indigo-500/40 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100",
    };
  }
  if (/ceia/.test(n)) {
    return {
      label: title,
      emoji: "🥣",
      borderL: "border-l-violet-500",
      badge: "border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-100",
    };
  }
  return {
    label: title,
    emoji: "🍽️",
    borderL: "border-l-[hsl(var(--primary))]",
    badge: "border-primary/40 bg-primary/10 text-[hsl(var(--ink-1))]",
  };
}

type AiDraftSection =
  | { kind: "general"; body: string }
  | { kind: "meal"; body: string; visual: ReturnType<typeof mealVisualFromTitle> };

function splitAiDraftIntoSections(text: string): AiDraftSection[] {
  const lines = text.split(/\r?\n/);
  const out: AiDraftSection[] = [];
  let genBuf: string[] = [];
  let mealBuf: string[] | null = null;
  let mealVisual: ReturnType<typeof mealVisualFromTitle> | null = null;

  const flushGeneral = () => {
    const body = genBuf.join("\n").trimEnd();
    if (body) out.push({ kind: "general", body });
    genBuf = [];
  };

  const flushMeal = () => {
    if (mealBuf !== null && mealVisual) {
      const body = mealBuf.join("\n").trimEnd();
      out.push({ kind: "meal", body, visual: mealVisual });
    }
    mealBuf = null;
    mealVisual = null;
  };

  for (const line of lines) {
    if (isMealSectionHeadingLine(line)) {
      flushMeal();
      flushGeneral();
      const title = extractMealHeadingTitle(line)!;
      mealVisual = mealVisualFromTitle(title);
      mealBuf = [];
      continue;
    }
    const trimmed = line.trim();
    if (mealBuf !== null && trimmed.startsWith("## ") && !isMealSectionHeadingLine(line)) {
      flushMeal();
      genBuf.push(line);
      continue;
    }
    if (mealBuf !== null) mealBuf.push(line);
    else genBuf.push(line);
  }
  flushMeal();
  flushGeneral();
  return out;
}

const aiDraftProseClass =
  "prose prose-sm dark:prose-invert max-w-none text-[hsl(var(--ink-1))] [&_h1]:font-display [&_h2]:font-display [&_h3]:font-display [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:space-y-1 [&_li]:text-sm [&_p]:text-sm [&_strong]:font-semibold [&_strong]:text-[hsl(var(--ink-1))]";

function mealBlockNonEmpty(block: unknown): boolean {
  if (block == null) return false;
  if (Array.isArray(block)) return block.length > 0;
  if (typeof block === "object") return Object.keys(block as Record<string, unknown>).length > 0;
  return false;
}

/** Há dados de cardápio estruturado em inglês (`meals`) ou PT-BR (`refeicoes` / `refeições`). */
export function hasStructuredMeals(o: Record<string, unknown>): boolean {
  return (
    mealBlockNonEmpty(o.meals) ||
    mealBlockNonEmpty(o.refeicoes) ||
    mealBlockNonEmpty(o["refeições"])
  );
}

/** Ordem-canônico do cardápio no app (slots fixos para UI/PDF). */
const MEAL_KEY_ORDER = ["cafeDaManha", "lancheDaManha", "almoco", "lancheDaTarde", "jantar"] as const;
type CanonicalMealKey = (typeof MEAL_KEY_ORDER)[number];

/** Normaliza texto para comparar nomes de chaves PT/en (acentos, espaços, hífens → _). */
export function asciiNormLabel(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function keyLettersOnly(s: string): string {
  return asciiNormLabel(s).replace(/_/g, "");
}

function getFlexible(rec: Record<string, unknown>, key: string): unknown {
  if (rec == null || typeof rec !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(rec, key)) return rec[key as keyof typeof rec];
  const want = keyLettersOnly(key);
  if (!want.length) return undefined;
  for (const k of Object.keys(rec)) {
    if (keyLettersOnly(k) === want) return rec[k as keyof typeof rec];
  }
  return undefined;
}

function pickStr(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t.length ? t : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Extrai número de valores numéricos ou strings (“200 kcal”, “25,5g”). */
function safeNutriNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const m = v.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return 0;
    const n = Number(m[0].replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const MACRO_WRAPPER_KEYS = [
  "macros",
  "macro",
  "macronutrientes",
  "macronutriente",
  "valorNutricional",
  "valoresNutricionais",
  "nutrientes",
  "totais",
  "totaisNutricionais",
  "analiseNutricional",
  "perfilNutricional",
] as const;

function readNumericByAliases(rec: Record<string, unknown>, aliases: readonly string[], depth = 0): number | undefined {
  if (depth > 6) return undefined;
  for (const alias of aliases) {
    const v = getFlexible(rec, alias);
    if (v !== undefined && v !== null && v !== "") {
      const n = safeNutriNumber(v);
      return n;
    }
  }
  for (const w of MACRO_WRAPPER_KEYS) {
    const inner = getFlexible(rec, w);
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      const nested = readNumericByAliases(inner as Record<string, unknown>, aliases, depth + 1);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function emptyMeal(): Meal {
  return { name: "—", calories: 0, protein: 0, carbs: 0, fat: 0, ingredients: [], instructions: "" };
}

function normalizeIngredientArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    if (typeof x === "string") return x;
    if (x && typeof x === "object" && !Array.isArray(x)) {
      const xo = x as Record<string, unknown>;
      const nome =
        pickStr(getFlexible(xo, "nome")) ??
        pickStr(getFlexible(xo, "name")) ??
        pickStr(getFlexible(xo, "item")) ??
        pickStr(getFlexible(xo, "ingrediente"));
      const qty =
        pickStr(getFlexible(xo, "quantidade")) ??
        pickStr(getFlexible(xo, "qtd")) ??
        pickStr(getFlexible(xo, "quantia"));
      if (nome && qty) return `${nome} (${qty})`;
      if (nome) return nome;
    }
    return String(x);
  });
}

function pickInstructionsMerged(o: Record<string, unknown>): string {
  const aliases = ["instructions", "instrucoes", "instruções", "preparo", "modo_de_preparo", "modoPreparo", "passos"];
  for (const a of aliases) {
    const v = getFlexible(o, a);
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join("\n");
  }
  return "";
}

const CAL_ALIAS = ["calories", "calorias", "caloria", "kcal", "energia", "valorEnergetico", "valor_energetico", "valorEnergético"];
const PROT_ALIAS = ["protein", "proteinas", "proteínas", "proteina", "prot"];
const CARB_ALIAS = ["carbs", "carboidratos", "carboidrato", "carbohydrate"];
const FAT_ALIAS = ["fat", "gorduras", "gordura", "fats", "lipidios", "lípidios"];

function mealFromLooseObject(m: unknown): Meal {
  if (m == null || typeof m !== "object" || Array.isArray(m)) return emptyMeal();
  const o = m as Record<string, unknown>;

  const name =
    pickStr(getFlexible(o, "name")) ??
    pickStr(getFlexible(o, "nome")) ??
    pickStr(getFlexible(o, "refeicao")) ??
    pickStr(getFlexible(o, "refeição")) ??
    pickStr(getFlexible(o, "titulo")) ??
    pickStr(getFlexible(o, "prato")) ??
    pickStr(getFlexible(o, "title")) ??
    "—";

  const ingRaw =
    getFlexible(o, "ingredients") ?? getFlexible(o, "ingredientes") ?? getFlexible(o, "itens");
  const ingredients = normalizeIngredientArray(ingRaw);

  const instructions = pickInstructionsMerged(o);

  const calories = readNumericByAliases(o, CAL_ALIAS) ?? 0;
  const protein = readNumericByAliases(o, PROT_ALIAS) ?? 0;
  const carbs = readNumericByAliases(o, CARB_ALIAS) ?? 0;
  const fat = readNumericByAliases(o, FAT_ALIAS) ?? 0;

  const pt = pickStr(getFlexible(o, "prepTime")) ?? pickStr(getFlexible(o, "tempo_preparo")) ?? pickStr(getFlexible(o, "tempoPreparo"));
  const tips =
    pickStr(getFlexible(o, "tips")) ?? pickStr(getFlexible(o, "dicas"));

  return {
    name,
    calories,
    protein,
    carbs,
    fat,
    ingredients,
    instructions,
    ...(pt ? { prepTime: pt } : {}),
    ...(tips ? { tips } : {}),
  };
}

function resolveCanonicalMealKey(rawKey: string): CanonicalMealKey | null {
  if ((MEAL_KEY_ORDER as readonly string[]).includes(rawKey)) return rawKey as CanonicalMealKey;
  const n = asciiNormLabel(rawKey);
  /* Chaves texto em PT comuns */
  if (/^cafe(_da_manha)?$/.test(n) || n === "pequeno_almoco" || n === "desjejum" || n === "breakfast") return "cafeDaManha";
  if (/lanche/.test(n) && /manha/.test(n)) return "lancheDaManha";
  if (n === "almoco" || n === "almoco_principal") return "almoco";
  if (/lanche/.test(n) && /tarde/.test(n)) return "lancheDaTarde";
  if (/^lanche$/.test(n)) return null;
  if (n === "jantar" || n === "ceia" || n === "janta" || n === "dinner") return "jantar";
  return null;
}

function inferCanonicalSlotFromMealItem(item: unknown): CanonicalMealKey | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  const labelHints = ["periodo", "tipo", "turno", "nome_refeicao", "titulo_slot", "slot"];
  for (const h of labelHints) {
    const s = pickStr(getFlexible(o, h));
    if (!s) continue;
    const byKey = resolveCanonicalMealKey(s);
    if (byKey) return byKey;
    const slack = asciiNormLabel(s).replace(/_/g, " ");
    if (/\bcafe\b/.test(slack) && /\bmanha\b/.test(slack)) return "cafeDaManha";
    if (/\blanche\b/.test(slack) && /\bmanha\b/.test(slack)) return "lancheDaManha";
    if (/\balmoco\b/.test(slack) || /\balmo[oçc]o\b/.test(slack)) return "almoco";
    if (/\blanche\b/.test(slack) && /\btarde\b/.test(slack)) return "lancheDaTarde";
    if (/\bjantar\b/.test(slack) || /\bceia\b/.test(slack)) return "jantar";
  }
  return null;
}

function ingestMealsContainer(container: unknown, out: Partial<Record<CanonicalMealKey, unknown>>): void {
  if (!mealBlockNonEmpty(container)) return;
  if (Array.isArray(container)) {
    container.forEach((item, idx) => {
      if (idx >= MEAL_KEY_ORDER.length) return;
      const slot = inferCanonicalSlotFromMealItem(item) ?? MEAL_KEY_ORDER[idx];
      if (item != null && out[slot] == null) out[slot] = item;
    });
    return;
  }
  if (typeof container !== "object") return;
  const obj = container as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    let slot: CanonicalMealKey | null = resolveCanonicalMealKey(k);
    if (
      slot == null &&
      typeof v === "object" &&
      v !== null &&
      !Array.isArray(v)
    ) {
      slot = inferCanonicalSlotFromMealItem(v);
    }
    if (slot != null && v != null && out[slot] == null) out[slot] = v;
  }
}

function filledSlotsFromPlanRoot(base: Record<string, unknown>): Partial<Record<CanonicalMealKey, unknown>> {
  const out: Partial<Record<CanonicalMealKey, unknown>> = {};
  ingestMealsContainer(base.meals, out);
  ingestMealsContainer(base.refeicoes, out);
  ingestMealsContainer(base["refeições"], out);
  return out;
}

/**
 * Converte rascunho da IA em {@link DietPlan} canônico: aceita chaves PT-BR/aninhamentos comuns do n8n.
 */
export function coerceAiDraftPlanToDietPlan(raw: unknown): DietPlan {
  const base =
    raw != null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const bySlot = filledSlotsFromPlanRoot(base);

  const meals = {
    cafeDaManha: mealFromLooseObject(bySlot.cafeDaManha),
    lancheDaManha: mealFromLooseObject(bySlot.lancheDaManha),
    almoco: mealFromLooseObject(bySlot.almoco),
    lancheDaTarde: mealFromLooseObject(bySlot.lancheDaTarde),
    jantar: mealFromLooseObject(bySlot.jantar),
  };

  const totalExplicit =
    readNumericByAliases(base, [
      "totalCalories",
      "total_calories",
      "caloriasTotais",
      "calorias_totais",
      "caloriaTotal",
      "caloria_total",
      "metaCalorias",
    ]) ??
    undefined;
  const totalCalories =
    totalExplicit ??
    MEAL_KEY_ORDER.reduce((acc, k) => acc + meals[k].calories, 0);

  const notes =
    pickStr(getFlexible(base, "notes")) ??
    pickStr(getFlexible(base, "observacoes")) ??
    "";

  const generatedAt =
    pickStr(getFlexible(base, "generatedAt")) ??
    pickStr(getFlexible(base, "generated_at")) ??
    pickStr(getFlexible(base, "geradoEm")) ??
    pickStr(getFlexible(base, "gerado_em")) ??
    new Date().toISOString();

  return {
    totalCalories,
    meals,
    notes,
    generatedAt,
  };
}

function markdownFromNonStructuredObject(o: Record<string, unknown>): string | null {
  if (hasStructuredMeals(o)) return null;
  for (const key of ["markdown", "text", "content", "draft", "body"] as const) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  const notes = o.notes;
  if (typeof notes === "string" && notes.trim()) return notes;
  return null;
}

/** `ai_draft` é um {@link DietPlan} com refeições preenchidas (lista de compras / cardápio estruturado). */
export function isStructuredDietPlan(raw: unknown): raw is DietPlan {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    hasStructuredMeals(raw as Record<string, unknown>)
  );
}

const NESTED_DRAFT_KEYS = [
  "plan",
  "dietPlan",
  "diet_plan",
  "output",
  "result",
  "data",
  "draft",
  "body",
  "message",
  "content",
  "ai_draft",
  "json",
  "response",
  "cardapio",
  "cardápio",
  "diet",
  "plano",
] as const;

/**
 * Achata formatos típicos do n8n: string JSON (incl. dupla codificação), objeto com `output`/`plan`/etc.
 * até obter um objeto com `meals` (cardápio) ou um valor terminal (string / estrutura não aninhada).
 */
export function normalizeRawAiDraft(raw: unknown): unknown {
  let cur: unknown = raw;
  for (let depth = 0; depth < 10; depth++) {
    if (cur == null) return null;

    if (typeof cur === "string") {
      const t = cur.trim();
      if (!t) return null;
      const looksJson =
        (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
      if (looksJson) {
        try {
          cur = JSON.parse(t);
          continue;
        } catch {
          return cur;
        }
      }
      return cur;
    }

    if (Array.isArray(cur)) return cur;

    if (typeof cur === "object") {
      const o = cur as Record<string, unknown>;
      if (hasStructuredMeals(o)) return cur;
      let advanced = false;
      for (const k of NESTED_DRAFT_KEYS) {
        if (k in o && o[k] != null) {
          cur = o[k];
          advanced = true;
          break;
        }
      }
      if (advanced) continue;
      return cur;
    }

    return cur;
  }
  return cur;
}

/** Extrai texto Markdown do campo `ai_draft` (string ou objeto sem refeições estruturadas). */
export function markdownTextFromAiDraft(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    if (t.startsWith("{")) {
      try {
        const o = JSON.parse(t) as Record<string, unknown>;
        return markdownFromNonStructuredObject(o);
      } catch {
        return raw;
      }
    }
    return raw;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return markdownFromNonStructuredObject(raw as Record<string, unknown>);
  }
  return null;
}

/** Frases típicas de funil/checkout — não são o texto do plano em Markdown gravado pela IA no n8n. */
const FUNNEL_NOTE_SIGNALS =
  /\b(questionário enviado|falha ao acionar IA|pagamento confirmado|aguardando validação nutricional|acompanhe no dashboard|Tentar novamente)\b/i;

/**
 * Detecta se `diet_requests.notes` deve ser tratado como rascunho Markdown da IA (n8n gravando na coluna `notes`).
 */
export function isLikelyAiMarkdownNotes(notes: string | null | undefined): boolean {
  if (notes == null || typeof notes !== "string") return false;
  const t = notes.trim();
  if (!t || t.length < 80) return false;
  if (FUNNEL_NOTE_SIGNALS.test(t) && !/^#{1,6}\s/m.test(t)) return false;
  if (/^#{1,6}\s/m.test(t) || /\n#{1,6}\s/.test(t)) return true;
  if (/\*\*[^*\n]{2,}\*\*/.test(t)) return true;
  if (/\n-{3,}\n/.test(t) || /\n\*{3,}\n/.test(t)) return true;
  return t.length >= 400;
}

/**
 * Monta o valor exibível como plano (`PremiumDietPlanView`: JSON estruturado ou texto/Markdown).
 * Prioriza `ai_draft`; usa `notes` quando a IA só persiste o Markdown ali.
 */
export function planPayloadFromDraftAndNotes(
  ai_draft: unknown,
  notes: string | null | undefined,
): DietPlan | string | null {
  const normalized = normalizeRawAiDraft(ai_draft);
  const hasDraftField = normalized !== null && normalized !== undefined && normalized !== "";
  if (hasDraftField) {
    if (isStructuredDietPlan(normalized)) return coerceAiDraftPlanToDietPlan(normalized);
    if (markdownTextFromAiDraft(normalized)) return normalized as DietPlan | string;
    if (typeof normalized === "string") return normalized;
  }
  if (isLikelyAiMarkdownNotes(notes)) return String(notes).trim();
  return null;
}

export default function AiDraftMarkdown({ text }: { text: string }) {
  const safeText = typeof text === "string" ? text : "";
  const sections = useMemo(() => splitAiDraftIntoSections(safeText), [safeText]);

  return (
    <div className="space-y-4">
      {sections.map((sec, i) => {
        if (sec.kind === "general") {
          return (
            <div key={i} className={aiDraftProseClass}>
              <ReactMarkdown>{sec.body}</ReactMarkdown>
            </div>
          );
        }
        return (
          <div
            key={i}
            className={cn(
              "card-clinical overflow-hidden rounded-xl border border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-0))] shadow-sm",
              "border-l-4",
              sec.visual.borderL,
            )}
          >
            <div className="flex items-center gap-2 border-b border-[hsl(var(--surface-3))] bg-[hsl(var(--surface-1))] px-4 py-2.5">
              <Badge variant="outline" className={cn("gap-1.5 font-display text-xs font-semibold", sec.visual.badge)}>
                <span aria-hidden>{sec.visual.emoji}</span>
                {sec.visual.label}
              </Badge>
            </div>
            <div className={cn(aiDraftProseClass, "p-4")}>
              {sec.body ? (
                <ReactMarkdown>{sec.body}</ReactMarkdown>
              ) : (
                <p className="text-sm text-[hsl(var(--ink-3))]">Sem conteúdo nesta refeição.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
