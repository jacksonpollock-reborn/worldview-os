import { z } from "zod";

export const AppSettingsSchema = z.object({
  model: z.string().trim().min(1),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().min(500).max(8_000),
  schemaMode: z.enum(["strict-json", "strict-json-repair"]),
  systemPromptOverride: z.string().nullable(),
  liveDataEnabled: z.boolean().default(false),
});
