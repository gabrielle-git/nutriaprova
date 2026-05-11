import { supabase } from "@/integrations/supabase/client";

export interface ClientData {
  age: number;
  birthDate?: string;
  weight: number;
  height: number;
  goal: string;
  allergies: string[];
  foodPreferences?: string[];
  activityLevel: string;
  additionalNotes?: string;
}

export interface Meal {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  instructions: string;
  prepTime?: string;
  tips?: string;
}

export interface DietPlan {
  totalCalories: number;
  meals: {
    cafeDaManha: Meal;
    lancheDaManha: Meal;
    almoco: Meal;
    lancheDaTarde: Meal;
    jantar: Meal;
  };
  notes: string;
  generatedAt: string;
}

/**
 * Extrai corpo cru de erros do `supabase.functions.invoke`.
 *
 * O SDK expõe a resposta HTTP em `error.context` (um Response clonado). Aqui
 * lemos o `text()` e imprimimos TUDO no console do navegador para sabermos se
 * o Google está rejeitando a chave, se é cota, ou se é outro bug.
 */
async function logEdgeError(label: string, error: unknown, data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = error as any;
  const ctx = anyErr?.context;
  let bodyText: string | null = null;
  let status: number | undefined;

  if (ctx && typeof ctx === "object") {
    status = typeof ctx.status === "number" ? ctx.status : undefined;
    if (typeof ctx.text === "function") {
      try {
        bodyText = await ctx.text();
      } catch {
        bodyText = null;
      }
    } else if (typeof ctx.error === "string") {
      bodyText = ctx.error;
    } else {
      try {
        bodyText = JSON.stringify(ctx);
      } catch {
        bodyText = null;
      }
    }
  }

  console.error(`[${label}] Edge function falhou`, {
    message: anyErr?.message,
    status,
    body: bodyText,
    data,
  });

  return { status, bodyText };
}

export async function generateDietPlan(clientData: ClientData): Promise<DietPlan> {
  const { data, error } = await supabase.functions.invoke("generate-diet", {
    body: { action: "generate", clientData },
  });

  if (error) {
    const { bodyText } = await logEdgeError("generateDietPlan", error, data);
    throw new Error(bodyText || error.message || "Erro ao gerar plano alimentar");
  }

  if (data?.error) {
    console.error("[generateDietPlan] Edge retornou erro:", data);
    throw new Error(`${data.error}${data.detail ? `: ${data.detail}` : ""}`);
  }

  return data as DietPlan;
}

export async function adjustDietWithAI(currentPlan: DietPlan, instruction: string): Promise<DietPlan> {
  const { data, error } = await supabase.functions.invoke("generate-diet", {
    body: { action: "adjust", currentPlan, instruction },
  });

  if (error) {
    const { bodyText } = await logEdgeError("adjustDietWithAI", error, data);
    throw new Error(bodyText || error.message || "Erro ao ajustar plano");
  }

  if (data?.error) {
    console.error("[adjustDietWithAI] Edge retornou erro:", data);
    throw new Error(`${data.error}${data.detail ? `: ${data.detail}` : ""}`);
  }

  return data as DietPlan;
}
