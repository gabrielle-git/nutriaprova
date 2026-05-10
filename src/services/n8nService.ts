/**
 * Webhooks n8n — geração/ajuste de dieta.
 *
 * Sincronização com o dashboard:
 * - O fluxo do **cliente** (ex.: ClientOnboarding) pode chamar o webhook; o n8n deve persistir o
 *   resultado em `public.diet_requests.ai_draft` via **Supabase REST** com a mesma **Project URL**
 *   do app (`VITE_SUPABASE_URL`).
 * - O **ID** no PATCH/UPSERT deve ser o UUID exato de `diet_requests.id` que o front lê (campos como
 *   `request_id`, `diet_request_id` ou `target_id` no JSON devem coincidir com essa linha).
 * - O painel do nutricionista **não** dispara geração aqui; só consome `ai_draft` depois do n8n.
 *
 * Atenção ao path `/webhook-test/...` vs `/webhook/...`:
 * - `/webhook-test/<id>` SÓ responde quando o usuário do n8n está com a aba do
 *   editor aberta no botão "Listen for test event". Em produção (ou com o
 *   Docker rodando sem ninguém clicando "Listen"), esse path devolve 404 e o
 *   plano nunca é gerado.
 * - `/webhook/<id>` é o endpoint persistente, que só passa a existir DEPOIS de
 *   o workflow ser ativado (toggle "Active" no canto superior direito do n8n).
 *
 * Configure a URL final em `.env.local`:
 *   VITE_N8N_GENERATE_WEBHOOK_URL=http://localhost:5678/webhook/gerar-dieta
 *   VITE_N8N_ADJUST_WEBHOOK_URL=http://localhost:5678/webhook/ajustar-dieta
 */
const N8N_GENERATE_WEBHOOK_URL =
  (typeof import.meta.env.VITE_N8N_GENERATE_WEBHOOK_URL === "string" &&
    import.meta.env.VITE_N8N_GENERATE_WEBHOOK_URL.trim()) ||
  "http://localhost:5678/webhook/gerar-dieta";
const N8N_ADJUST_WEBHOOK_URL =
  (typeof import.meta.env.VITE_N8N_ADJUST_WEBHOOK_URL === "string" &&
    import.meta.env.VITE_N8N_ADJUST_WEBHOOK_URL.trim()) ||
  "http://localhost:5678/webhook/ajustar-dieta";

if (import.meta.env.DEV) {
  // Aviso explícito em dev se alguém esquecer no path de "test" — esse foi
  // exatamente o motivo do "n8n não gera nada em produção" no início do MVP.
  if (N8N_GENERATE_WEBHOOK_URL.includes("/webhook-test/")) {
    console.warn(
      "[n8nService] VITE_N8N_GENERATE_WEBHOOK_URL aponta para /webhook-test/ — " +
        "esse endpoint só funciona enquanto o n8n está com 'Listen for test event' ativo. " +
        "Troque para /webhook/<id> e ative o workflow para funcionar de verdade.",
    );
  }
}

export interface ClientData {
  age: number;
  birthDate?: string;
  gender: "masculino" | "feminino";
  weight: number;
  height: number;
  /** Percentual de gordura corporal (opcional), ex.: 18.5 */
  bodyFat?: number;
  goal: string;
  allergies: string[];
  activityLevel: string;
  additionalNotes?: string;
  /** Peso alvo (kg) — perda/ganho de peso. */
  targetWeight?: number;
  /** Prazo em meses para a meta de composição. */
  targetTimelineMonths?: number;
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

async function logN8nError(label: string, error: unknown, data: unknown) {
  console.error(`[${label}] N8N webhook falhou`, {
    message: error instanceof Error ? error.message : 'Unknown error',
    data,
  });
}

async function postToN8n(url: string, payload: Record<string, unknown>) {
  // Contrato explícito com o n8n: sempre POST com JSON no body.
  console.log("URL_CHAMADA:", url);
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Dispara o webhook de geração. Sucesso = HTTP 200 (ou outro 2xx). Não lê nem interpreta o corpo.
 * O plano é persistido pelo próprio fluxo n8n → Supabase.
 */
export async function triggerGenerateDietWebhook(
  clientData: ClientData,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const response = await postToN8n(N8N_GENERATE_WEBHOOK_URL, {
      action: 'generate',
      clientData,
      ...meta,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    // Sucesso: não consumimos o corpo — o n8n responde antes do plano existir.
  } catch (error) {
    await logN8nError('triggerGenerateDietWebhook', error, { clientData, meta });
    throw new Error(error instanceof Error ? error.message : 'Erro ao acionar geração do plano');
  }
}

export async function adjustDietWithAI(currentPlan: DietPlan, instruction: string): Promise<DietPlan> {
  try {
    const response = await postToN8n(N8N_ADJUST_WEBHOOK_URL, {
      action: 'adjust',
      currentPlan,
      instruction,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data as DietPlan;
  } catch (error) {
    await logN8nError('adjustDietWithAI', error, { currentPlan, instruction });
    throw new Error(error instanceof Error ? error.message : 'Erro ao ajustar plano');
  }
}

/**
 * Manda o Markdown bruto do plano + instrução do nutri para o webhook n8n de ajuste.
 * O n8n deve usar a mesma instrução (ex: "tire o leite") e reescrever o Markdown,
 * devolvendo { markdownText: string } no corpo da resposta.
 *
 * Contrato de resposta esperado do n8n:
 *   { "markdownText": "# Plano Alimentar\n..." }
 *
 * Se o n8n ainda não tiver esse contrato implementado, retorna o markdown original
 * com um aviso de fallback no console — sem quebrar o fluxo.
 */
export async function adjustMarkdownWithAI(
  currentMarkdown: string,
  instruction: string,
): Promise<string> {
  try {
    const response = await postToN8n(N8N_ADJUST_WEBHOOK_URL, {
      action: "adjust_markdown",
      currentMarkdown,
      instruction,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (data.error) {
      throw new Error(String(data.error));
    }

    // Aceita tanto { markdownText: "..." } quanto { text: "..." } como fallback.
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
