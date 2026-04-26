const N8N_GENERATE_WEBHOOK_URL = 'http://localhost:5678/webhook/gerar-dieta';
const N8N_ADJUST_WEBHOOK_URL = 'http://localhost:5678/webhook/ajustar-dieta';

export interface ClientData {
  age: number;
  birthDate?: string;
  gender: "masculino" | "feminino";
  weight: number;
  height: number;
  goal: string;
  allergies: string[];
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

async function logN8nError(label: string, error: unknown, data: unknown) {
  console.error(`[${label}] N8N webhook falhou`, {
    message: error instanceof Error ? error.message : 'Unknown error',
    data,
  });
}

async function postToN8n(url: string, payload: Record<string, unknown>) {
  // Contrato explícito com o n8n: sempre POST com JSON no body.
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function generateDietPlan(clientData: ClientData): Promise<DietPlan> {
  try {
    const response = await postToN8n(N8N_GENERATE_WEBHOOK_URL, {
      action: 'generate',
      clientData,
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
    await logN8nError('generateDietPlan', error, { clientData });
    throw new Error(error instanceof Error ? error.message : 'Erro ao gerar plano alimentar');
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
