import { z } from "zod";

export const OutcomeLabelSchema = z.enum(["mostly_right", "mixed", "wrong"]);
export const TriggerStateSchema = z.enum(["yes", "no", "unknown"]);
export const WatchlistTriggerStateSchema = z.enum([
  "yes",
  "no",
  "partially",
  "unknown",
]);

export const NO_CLEAR_SCENARIO_MATCH = "__no_clear_match__";

export const AnalysisReviewUpsertSchema = z.object({
  outcomeLabel: OutcomeLabelSchema.nullable().optional(),
  realizedScenario: z.string().trim().max(500).nullable().optional(),
  downgradeTriggered: TriggerStateSchema.nullable().optional(),
  upgradeTriggered: TriggerStateSchema.nullable().optional(),
  watchlistTriggered: WatchlistTriggerStateSchema.nullable().optional(),
  reviewNotes: z.string().max(4_000).nullable().optional(),
});

export type AnalysisReviewUpsertInput = z.infer<typeof AnalysisReviewUpsertSchema>;
