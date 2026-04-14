function inferProviderName(baseURL: string | null) {
  if (!baseURL) {
    return "OpenAI";
  }

  if (baseURL.includes("moonshot.ai") || baseURL.includes("kimi.ai")) {
    return "Kimi";
  }

  return "OpenAI";
}

export function getLlmConnectionConfig() {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.KIMI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  const baseURL =
    process.env.LLM_BASE_URL ||
    process.env.KIMI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    (process.env.KIMI_API_KEY ? "https://api.moonshot.ai/v1" : null);
  const providerName =
    process.env.LLM_PROVIDER_NAME?.trim() || inferProviderName(baseURL);

  return {
    apiKey,
    baseURL,
    providerName,
  };
}

export function getAnalysisRuntimeMode() {
  const connection = getLlmConnectionConfig();
  const apiKeyConfigured = Boolean(connection.apiKey);
  const forceMockMode = process.env.MOCK_ANALYSIS_MODE === "true";
  const mockModeActive = forceMockMode || !apiKeyConfigured;

  return {
    apiKeyConfigured,
    providerName: connection.providerName,
    forceMockMode,
    mockModeActive,
  };
}
