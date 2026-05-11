import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ClientData {
  age: number;
  weight: number;
  height: number;
  goal: string;
  activityLevel: string;
  allergies: string[];
  foodPreferences?: string[];
  additionalNotes?: string;
}

const SYSTEM_PROMPT = `Você é um(a) nutricionista IA especialista em criar planos alimentares personalizados em português do Brasil.

FORMATO DE SAÍDA — LEIA COM MUITA ATENÇÃO:
- A sua resposta INTEIRA deve ser um ÚNICO objeto JSON válido e nada mais.
- O primeiro caractere da resposta DEVE ser "{" e o último DEVE ser "}".
- NÃO escreva nenhuma palavra, saudação, explicação, aviso ou pontuação antes ou depois do JSON.
- NÃO envolva a resposta em blocos de código markdown (NADA de \`\`\`json, \`\`\`, ou crases).
- Use SEMPRE aspas duplas. Números são do tipo number (sem aspas).
- Todos os 5 campos de refeição são obrigatórios: cafeDaManha, lancheDaManha, almoco, lancheDaTarde, jantar.
- "generatedAt" deve ser uma string ISO 8601 (ex.: "2025-01-15T12:00:00.000Z").
- "ingredients" é sempre um array de strings, mesmo que tenha um único item.
- Se houver alergias ou restrições absolutas informadas, NUNCA inclua esses alimentos nas receitas.
- "PREFERÊNCIAS DO PACIENTE" orientam o estilo do cardápio, mas não substituem restrições de saúde.
- Se qualquer instrução acima conflitar com sua vontade de "explicar", PREVALECE o formato JSON puro.

SCHEMA EXATO:
{
  "totalCalories": number,
  "meals": {
    "cafeDaManha":   { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [string], "instructions": string, "prepTime": string, "tips": string },
    "lancheDaManha": { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [string], "instructions": string, "prepTime": string, "tips": string },
    "almoco":        { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [string], "instructions": string, "prepTime": string, "tips": string },
    "lancheDaTarde": { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [string], "instructions": string, "prepTime": string, "tips": string },
    "jantar":        { "name": string, "calories": number, "protein": number, "carbs": number, "fat": number, "ingredients": [string], "instructions": string, "prepTime": string, "tips": string }
  },
  "notes": string,
  "generatedAt": string
}`;

function buildUserPrompt(data: ClientData): string {
  const restrictions = data.allergies.length
    ? data.allergies.join("; ")
    : "Nenhuma informada pelo paciente.";
  const preferences = (data.foodPreferences?.length ?? 0)
    ? (data.foodPreferences as string[]).join("; ")
    : "Nenhuma preferência específica informada.";
  return (
    `Crie um plano alimentar para: ${data.age} anos, ${data.weight}kg, ${data.height}cm. ` +
    `Objetivo: ${data.goal}. Atividade: ${data.activityLevel}.\n` +
    `ALERGIAS/RESTRIÇÕES ABSOLUTAS: ${restrictions}\n` +
    `PREFERÊNCIAS DO PACIENTE: ${preferences}\n` +
    `Notas adicionais do paciente: ${data.additionalNotes || "Nenhuma"}.`
  );
}

// Log de boot: confirma que a secret foi carregada na Edge Function sem expor
// a chave completa (mostra apenas tamanho + 4 primeiros/últimos caracteres).
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
if (GEMINI_API_KEY) {
  const masked = `${GEMINI_API_KEY.slice(0, 4)}…${GEMINI_API_KEY.slice(-4)}`;
  console.log(
    `[generate-diet] GEMINI_API_KEY carregada com sucesso (len=${GEMINI_API_KEY.length}, preview=${masked}).`,
  );
} else {
  console.error(
    "[generate-diet] GEMINI_API_KEY NÃO encontrada em Deno.env. " +
      "Configure a secret no Supabase: `supabase secrets set GEMINI_API_KEY=...`.",
  );
}

// Endpoint + modelo do Gemini.
// A combinação que o Google aceita hoje em produção para esta chave é:
//   endpoint = v1beta  +  modelo = gemini-1.5-flash  (SEM sufixo "-latest")
// - O endpoint v1 rejeitava `responseMimeType` e, em algumas regiões, nem
//   respondia com esse modelo.
// - O alias `gemini-1.5-flash-latest` devolvia 404 tanto no v1 quanto no
//   v1beta, por isso bloqueamos esse sufixo mesmo que alguém tente forçar
//   via secret.
const GEMINI_API_VERSION = "v1beta";
const GEMINI_MODEL_DEFAULT = "gemini-1.5-flash";
const GEMINI_MODEL_ENV = (Deno.env.get("GEMINI_MODEL") ?? "").trim();
const GEMINI_MODEL =
  GEMINI_MODEL_ENV && !GEMINI_MODEL_ENV.endsWith("-latest")
    ? GEMINI_MODEL_ENV
    : GEMINI_MODEL_DEFAULT;

if (GEMINI_MODEL_ENV.endsWith("-latest")) {
  console.warn(
    `[generate-diet] Secret GEMINI_MODEL="${GEMINI_MODEL_ENV}" ignorada: ` +
      `o alias "-latest" não existe no Gemini 1.5. Usando "${GEMINI_MODEL_DEFAULT}".`,
  );
}
console.log(
  `[generate-diet] Gemini endpoint: ${GEMINI_API_VERSION} | model: ${GEMINI_MODEL}`,
);

async function callGemini(prompt: string) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Rode `supabase secrets set GEMINI_API_KEY=...` e faça redeploy da função.",
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }] },
        ],
        // Mantemos o `generationConfig` enxuto — só os campos universalmente
        // aceitos por Gemini 1.5 (v1 e v1beta). Nada de `responseMimeType`
        // (gera "Unknown name responseMimeType at generation_config"). A
        // garantia de JSON puro fica a cargo do SYSTEM_PROMPT + do parser
        // abaixo, que ainda tolera cercas markdown e ruído no entorno.
        generationConfig: {
          // Evita respostas truncadas que resultam em JSON inválido.
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      }),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error("[generate-diet] Falha de rede ao chamar Gemini:", msg);
    throw new Error(`Falha de rede ao contatar Gemini: ${msg}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error(
      `[generate-diet] Gemini respondeu ${response.status}: ${errText.slice(0, 500)}`,
    );
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  // Gemini pode bloquear por prompt (promptFeedback.blockReason) antes mesmo
  // de tentar gerar candidatos — tratamos explicitamente para mostrar algo útil.
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    console.warn("[generate-diet] Prompt bloqueado pelo Gemini:", blockReason);
    throw new Error(
      `Gemini bloqueou o prompt (${blockReason}). Ajuste os dados e tente novamente.`,
    );
  }

  if (!data.candidates || data.candidates.length === 0) {
    console.warn("[generate-diet] Gemini sem candidatos:", JSON.stringify(data).slice(0, 400));
    throw new Error(
      "Gemini não retornou candidatos. Possível problema de segurança ou quota excedida.",
    );
  }

  const candidate = data.candidates[0];
  const finishReason = candidate?.finishReason as string | undefined;

  const parts: Array<{ text?: string }> = candidate?.content?.parts ?? [];
  const rawText = parts.map((p) => p?.text ?? "").join("").trim();

  if (!rawText) {
    console.warn(
      `[generate-diet] Candidato sem texto (finishReason=${finishReason ?? "n/d"}):`,
      JSON.stringify(candidate).slice(0, 400),
    );
    if (finishReason === "MAX_TOKENS") {
      throw new Error("Resposta do Gemini truncada por limite de tokens. Tente novamente.");
    }
    if (finishReason === "SAFETY") {
      throw new Error("Resposta do Gemini bloqueada por filtros de segurança.");
    }
    throw new Error("Gemini retornou resposta vazia. Tente novamente em instantes.");
  }

  // Sem `responseMimeType`, o Gemini às vezes embrulha o objeto em cercas
  // markdown (```json ... ```) ou adiciona comentários antes/depois.
  // Primeiro removemos as cercas; depois, se ainda houver ruído, extraímos o
  // trecho entre o primeiro "{" e o último "}".
  let cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned.startsWith("{") || !cleaned.endsWith("}")) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1).trim();
    }
  }

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error(
      "[generate-diet] JSON inválido vindo do Gemini:",
      cleaned.slice(0, 500),
      parseErr instanceof Error ? parseErr.message : parseErr,
    );
    throw new Error("Gemini retornou um JSON inválido. Tente novamente.");
  }
}

async function logAiUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  success: boolean,
) {
  const { error } = await supabase.from("ai_usage_log").insert({
    user_id: userId,
    action,
    success,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("[generate-diet] ai_usage_log:", error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Não autorizado. Faça login para usar a IA." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = authData.user.id;

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || !profile?.role) {
      return new Response(
        JSON.stringify({ error: "Perfil de usuário não encontrado. Conclua o cadastro." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // client: plano no onboarding; nutritionist/admin: uso clínico; personal_trainer alinhado ao restante do app
    const allowedRoles = ["client", "nutritionist", "admin", "personal_trainer"];
    if (!allowedRoles.includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Seu perfil não tem permissão para gerar planos alimentares com IA." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { clientData, action, currentPlan, instruction } = await req.json();

    let result;
    if (action === "adjust") {
      result = await callGemini(
        `Ajuste este plano: ${JSON.stringify(currentPlan)} seguindo esta instrução: ${instruction}`,
      );
    } else {
      result = await callGemini(buildUserPrompt(clientData));
    }

    await logAiUsage(adminClient, userId, action ?? "generate", true);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno na Edge Function.";
    console.error("[generate-diet] Erro:", message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
