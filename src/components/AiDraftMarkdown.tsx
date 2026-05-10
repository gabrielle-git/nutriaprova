import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DietPlan } from "@/services/n8nService";

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

function hasStructuredMeals(o: Record<string, unknown>): boolean {
  const m = o.meals;
  if (m == null || typeof m !== "object" || Array.isArray(m)) return false;
  return Object.keys(m as object).length > 0;
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

export default function AiDraftMarkdown({ text }: { text: string }) {
  const sections = useMemo(() => splitAiDraftIntoSections(text), [text]);

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
