import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);

export const DefinitionSchema = z.object({
  term: NonEmptyString,
  definition: NonEmptyString,
});

export const LensSchema = z.object({
  name: NonEmptyString,
  why_it_matters: NonEmptyString,
  key_drivers: z.array(NonEmptyString).min(1),
  bull_case: NonEmptyString,
  bear_case: NonEmptyString,
  base_case: NonEmptyString,
  wildcard_case: NonEmptyString,
  evidence_for: z.array(NonEmptyString).min(1),
  evidence_against: z.array(NonEmptyString).min(1),
  leading_indicators: z.array(NonEmptyString).min(1),
  disconfirming_signals: z.array(NonEmptyString).min(1),
});

export const ScenarioSchema = z.object({
  name: NonEmptyString,
  description: NonEmptyString,
  probability: z.number().int().min(0).max(100),
  impact: z.enum(["low", "medium", "high"]),
  time_horizon: NonEmptyString,
  confidence: z.enum(["low", "medium", "high"]),
  leading_indicators: z.array(NonEmptyString).min(1),
});

export const MonitoringSignalSchema = z.object({
  name: NonEmptyString,
  why_it_matters: NonEmptyString,
  current_read: z.string().trim().default(""),
  bullish_threshold: NonEmptyString,
  neutral_threshold: NonEmptyString,
  bearish_threshold: NonEmptyString,
});

const BaseAnalysisOutputSchema = z.object({
  title: NonEmptyString,
  original_question: NonEmptyString,
  reframed_question: NonEmptyString,
  time_horizon: z.string().default(""),
  objective: z.string().default(""),
  definitions: z.array(DefinitionSchema).min(1),
  domains: z.array(NonEmptyString).min(1),
  key_drivers: z.array(NonEmptyString).min(1),
  hidden_variables: z.array(NonEmptyString).min(1),
  change_my_mind_conditions: z.array(NonEmptyString).min(1),
  bottom_line: NonEmptyString,
  watchlist: z.array(NonEmptyString).min(1),
});

export const StandardAnalysisOutputSchema = BaseAnalysisOutputSchema.extend({
  lenses: z.array(LensSchema).min(1),
  scenarios: z.array(ScenarioSchema).min(3),
});

export const MonitorAnalysisOutputSchema = BaseAnalysisOutputSchema.extend({
  objective: z.string().default("monitor"),
  current_stance: NonEmptyString,
  monitoring_signals: z.array(MonitoringSignalSchema).min(3).max(5),
  review_cadence: NonEmptyString,
  confirm_current_view: z.array(NonEmptyString).min(2).max(4),
  disconfirm_current_view: z.array(NonEmptyString).min(2).max(4),
  what_to_ignore: z.array(NonEmptyString).max(4).default([]),
  lenses: z.array(LensSchema).default([]),
  scenarios: z.array(ScenarioSchema).default([]),
});

export const AnalysisOutputSchema = z.union([
  StandardAnalysisOutputSchema,
  MonitorAnalysisOutputSchema,
]);

export const AnalysisRequestSchema = z.object({
  question: NonEmptyString.min(10, "Please enter a fuller question."),
  domain: z.string().trim().optional().default(""),
  timeHorizon: z.string().trim().optional().default(""),
  objective: z.string().trim().optional().default(""),
});

export const AnalysisUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(140).optional(),
    notes: z.string().max(10_000).nullable().optional(),
  })
  .refine((value) => value.title !== undefined || value.notes !== undefined, {
    message: "Provide a title or notes update.",
  });
