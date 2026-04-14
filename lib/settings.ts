import type { AppSettings } from "@prisma/client";
import { AppSettingsSchema } from "@/schemas/settings";
import type { AppSettingsValues } from "@/types/analysis";

export const DEFAULT_APP_SETTINGS: AppSettingsValues = {
  model: "gpt-4.1-mini",
  temperature: 0.3,
  maxTokens: 4800,
  schemaMode: "strict-json-repair",
  systemPromptOverride: null,
  liveDataEnabled: false,
};

export function parseSettingsRecord(record: AppSettings): AppSettingsValues {
  return AppSettingsSchema.parse({
    model: record.model,
    temperature: record.temperature,
    maxTokens: record.maxTokens,
    schemaMode: record.schemaMode,
    systemPromptOverride: record.systemPromptOverride,
    liveDataEnabled: record.liveDataEnabled,
  });
}
