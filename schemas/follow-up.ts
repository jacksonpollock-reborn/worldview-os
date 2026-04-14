import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);

export const AnalysisFollowUpRequestSchema = z.object({
  question: NonEmptyString.min(8, "Ask a more specific follow-up question."),
});

export const AnalysisFollowUpOutputSchema = z.object({
  title: NonEmptyString.max(120),
  answer: NonEmptyString.min(24),
  key_points: z.array(NonEmptyString).min(2).max(5),
  watchouts: z.array(NonEmptyString).max(4).default([]),
});
