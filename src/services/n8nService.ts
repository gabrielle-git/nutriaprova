/**
 * Webhooks n8n — geração/ajuste de dieta.
 *
 * Sincronização com o dashboard:
 * - O fluxo do **cliente** (ex.: ClientOnboarding) chama o webhook; o n8n deve persistir o
 * resultado em `public.diet_requests.ai_draft` via **Supabase REST**.
 */
const N8N_GENERATE_WEBHOOK_URL =
  (typeof import.meta.env.VITE_N8N_GENERATE_WEBHOOK_URL === "string" &&
    import.meta.env.VITE_N8N_GENERATE_WEBHOOK_URL.trim()) ||
  "http://localhost:5678/webhook/ajustar-dieta";
const N8N_ADJUST_WEBHOOK_URL =
  (typeof import.meta.env.VITE_N8N_ADJUST_WEBHOOK_URL === "string" &&
    import.meta.env.VITE_N8N_ADJUST_WEBHOOK_URL.trim()) ||
  "http://localhost:5678/webhook/ajustar-dieta";

if (import.meta.env.DEV) {
  if (N8N_ADJUST_WEBHOOK_URL.includes("/webhook-test/")) {
    console.warn(
      "[n8nService] VITE_N8N_ADJUST_WEBHOOK_URL aponta para /webhook-test/ — " +
        "troque para /webhook/<id> e ative o workflow para funcionar de verdade.",
    );
  }
}

export interface ClientData {
  age: number;
  birthDate?: string;
  gender: "masculino" | "feminino";
  weight: number;
  height: number;
  bodyFat?: number;
  goal: string;
  allergies: string[];
  foodPreferences?: string[];
  activityLevel: string;
  additionalNotes?: string;
  targetWeight?: number;
  targetTimelineMonths?: number;
}

export function formatGeminiDietRestrictionAndPreferenceBlock(clientData: ClientData): string {
  const restrictions = clientData.allergies?.length
    ? clientData.allergies.join("; ")
    : "Nenhuma informada pelo paciente.";
  const preferences = clientData.foodPreferences?.length
    ? clientData.foodPreferences.join("; ")
    : "Nenhuma preferência específica informada.";
  return (
    `ALERGIAS/RESTRIÇÕES ABSOLUTAS: ${restrictions}\n` +
    `PREFERÊNCIAS DO PACIENTE: ${preferences}`
  );
}

/** Uma refeição alternativa de troca (mesmos macros aproximados). */
export interface MealAlternative {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  instructions: string;
  prepTime?: string;
}

/** Substituição de ingrediente dentro de uma refeição. */
export interface MealSubstitution {
  /** Ingrediente original, ex: "Frango grelhado 150g" */
  original: string;
  /** Lista de alternativas, ex: ["Atum em lata 130g", "Tofu grelhado 150g"] */
  alternatives: string[];
  /** Nota de ajuste, ex: "Mantenha a mesma quantidade em gramas" */
  note?: string;
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
  /**
   * Nota clínica contextual — ex: "Rico em ferro não-heme: consuma com
   * vitamina C para melhor absorção". Diferente de `tips` (dica de preparo),
   * é informação nutricional/fisiológica relevante para o paciente.
   */
  clinicalNote?: string;
  /**
   * Contexto de treino quando relevante — ex: "Pré-treino", "Pós-treino".
   * Null/undefined se a refeição não tem relação com janela de treino.
   */
  timing?: string | null;
  /**
   * 1 ou 2 opções alternativas com macros equivalentes.
   * O paciente pode escolher qualquer uma sem sair da meta.
   */
  alternatives?: MealAlternative[];
  /**
   * Substituições de ingredientes específicos dentro desta refeição.
   * Útil para pacientes com restrições pontuais que não invalidam o plano.
   */
  substitutions?: MealSubstitution[];
}

/** Um dia completo do plano (usado no plano de 3 dias). */
export interface DayPlan {
  /** Rótulo do dia, ex: "Segunda-feira" */
  dayLabel: string;
  /** Total calórico deste dia específico */
  totalCalories: number;
  meals: {
    cafeDaManha: Meal;
    lancheDaManha: Meal;
    almoco: Meal;
    lancheDaTarde: Meal;
    jantar: Meal;
  };
}

export interface DietPlan {
  totalCalories: number;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  /** Refeições do Dia 1 / Dia base (mantido para compatibilidade com planos antigos). */
  meals: {
    cafeDaManha: Meal;
    lancheDaManha: Meal;
    almoco: Meal;
    lancheDaTarde: Meal;
    jantar: Meal;
  };
  /**
   * Variações de 3 dias (Segunda, Quarta, Sexta).
   * Se presente, a UI exibe abas por dia. Se ausente, exibe só `meals` (plano legado).
   */
  days?: DayPlan[];
  notes: string;
  generatedAt: string;
  /** Lista agregada enviada pela IA (`lista_de_compras` / `shoppingList`); opcional. */
  shoppingList?: string[];
}

async function logN8nError(label: string, error: unknown, data: unknown) {
  console.error(`[${label}] N8N webhook falhou`, {
    message: error instanceof Error ? error.message : 'Unknown error',
    data,
  });
}

async function postToN8n(url: string, payload: Record<string, unknown>) {
  console.log("URL_CHAMADA:", url);
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function buildGenerateDietWebhookPayload(clientData: ClientData, meta?: Record<string, unknown>) {
  const geminiDietContextNarrative = formatGeminiDietRestrictionAndPreferenceBlock(clientData);
  return {
    action: 'generate',
    tipo: 'gerar',
    clientData,
    geminiDietContextNarrative,
    geminiPromptHints: geminiDietContextNarrative,
    ...meta,
  } as Record<string, unknown>;
}

export type FireGenerateDietWebhookOptions = {
  /** Chamado quando a rede falha ou o HTTP não é OK (uso típico: marcar falha em `diet_requests`). */
  onFailure?: (error: unknown) => void;
};

/**
 * Dispara o webhook de geração sem esperar pela resposta (não há `await` no fetch —
 * apenas `void` sobre a Promise ao retornar). Útil para redirecionar o cliente antes da IA terminar.
 */
export function fireGenerateDietWebhook(
  clientData: ClientData,
  meta?: Record<string, unknown>,
  options?: FireGenerateDietWebhookOptions,
): void {
  const payload = buildGenerateDietWebhookPayload(clientData, meta);
  void postToN8n(N8N_ADJUST_WEBHOOK_URL, payload)
    .then((response) => {
      if (response.ok) return;
      return response.text().then((errorText) => {
        const error = new Error(`HTTP ${response.status}: ${errorText}`);
        void logN8nError('fireGenerateDietWebhook', error, { clientData, meta });
        options?.onFailure?.(error);
      });
    })
    .catch((error: unknown) => {
      void logN8nError('fireGenerateDietWebhook', error, { clientData, meta });
      options?.onFailure?.(error);
    });
}

/**
 * Dispara o webhook de geração. 
 * Agora aponta para o mesmo endpoint de ajuste, diferenciado pelo campo 'tipo' e 'action'.
 */
export async function triggerGenerateDietWebhook(
  clientData: ClientData,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const response = await postToN8n(
      N8N_ADJUST_WEBHOOK_URL,
      buildGenerateDietWebhookPayload(clientData, meta),
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
  } catch (error) {
    await logN8nError('triggerGenerateDietWebhook', error, { clientData, meta });
    throw new Error(error instanceof Error ? error.message : 'Erro ao acionar geração do plano');
  }
}

export async function adjustDietWithAI(currentPlan: DietPlan, instruction: string): Promise<DietPlan> {
  try {
    const response = await postToN8n(N8N_ADJUST_WEBHOOK_URL, {
      action: 'adjust',
      tipo: 'ajustar_json',
      currentPlan,
      instruction,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    return data as DietPlan;
  } catch (error) {
    await logN8nError('adjustDietWithAI', error, { currentPlan, instruction });
    throw new Error(error instanceof Error ? error.message : 'Erro ao ajustar plano');
  }
}

export async function adjustMarkdownWithAI(
  currentMarkdown: string,
  instruction: string,
): Promise<string> {
  try {
    const response = await postToN8n(N8N_ADJUST_WEBHOOK_URL, {
      action: "adjust_markdown",
      tipo: "ajustar_markdown",
      currentMarkdown,
      instruction,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data.error) throw new Error(String(data.error));

    const result = (data.markdownText ?? data.text ?? data.markdown) as string | undefined;
    if (typeof result !== "string" || !result.trim()) {
      throw new Error("Resposta do n8n não continha campo markdownText válido.");
    }

    return result;
  } catch (error) {
    await logN8nError("adjustMarkdownWithAI", error, { instruction });
    throw new Error(
      error instanceof Error ? error.message : "Erro ao ajustar Markdown com IA",
    );
  }
}