import OpenAI from "openai";
import { getLlmConnectionConfig } from "@/lib/runtime-mode";

let client: OpenAI | null = null;
let clientCacheKey = "";
const DEFAULT_LLM_TIMEOUT_MS = 90_000;

function getLlmTimeoutMs() {
  const configured = Number.parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || "", 10);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_LLM_TIMEOUT_MS;
}

function buildTimeoutSignal() {
  return AbortSignal.timeout(getLlmTimeoutMs());
}

function getClient() {
  const connection = getLlmConnectionConfig();

  if (!connection.apiKey) {
    throw new Error(
      "No live model API key is configured. Set LLM_API_KEY, KIMI_API_KEY, or OPENAI_API_KEY before running an analysis.",
    );
  }

  const nextCacheKey = `${connection.baseURL || "https://api.openai.com/v1"}::${connection.apiKey}`;

  if (!client || clientCacheKey !== nextCacheKey) {
    client = new OpenAI({
      apiKey: connection.apiKey,
      baseURL: connection.baseURL || undefined,
    });
    clientCacheKey = nextCacheKey;
  }

  return client;
}

async function generateWithKimi({
  apiKey,
  baseURL,
  model,
  systemPrompt,
  userPrompt,
  maxTokens,
}: {
  apiKey: string;
  baseURL: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
}) {
  const response = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    signal: buildTimeoutSignal(),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: maxTokens,
    }),
  });

  const json = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{
      finish_reason?: string | null;
      message?: { content?: string | null };
    }>;
  };

  if (!response.ok) {
    throw new Error(
      json.error?.message || `Kimi API request failed with status ${response.status}.`,
    );
  }

  const text = json.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Model output was empty.");
  }

  return {
    text,
    finishReason: json.choices?.[0]?.finish_reason ?? null,
  };
}

export async function generateStructuredJson({
  model,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
}: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}) {
  const connection = getLlmConnectionConfig();
  const useKimiK25Profile =
    connection.providerName === "Kimi" && model.trim().startsWith("kimi-k2.5");

  if (useKimiK25Profile && connection.baseURL && connection.apiKey) {
    return generateWithKimi({
      apiKey: connection.apiKey,
      baseURL: connection.baseURL,
      model,
      systemPrompt,
      userPrompt,
      maxTokens,
    });
  }

  const response = await getClient().chat.completions.create(
    {
      model,
      temperature,
      max_completion_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    {
      signal: buildTimeoutSignal(),
    },
  );

  const text = response.choices[0]?.message?.content;

  if (!text) {
    throw new Error("Model output was empty.");
  }

  return {
    text,
    finishReason: response.choices[0]?.finish_reason ?? null,
  };
}
