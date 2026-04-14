import type { z } from "zod";
import type { GroundingValidationReport } from "@/lib/evidence-grounding";
import type { EvidenceItem } from "@/lib/sources/types";
import type { SourceSummary } from "@/lib/sources/types";
import {
  AnalysisOutputSchema,
  AnalysisRequestSchema,
  MonitorAnalysisOutputSchema,
  MonitoringSignalSchema,
  StandardAnalysisOutputSchema,
} from "@/schemas/analysis";
import { AnalysisFollowUpOutputSchema } from "@/schemas/follow-up";
import { AppSettingsSchema } from "@/schemas/settings";

export type StructuredAnalysis = z.infer<typeof AnalysisOutputSchema>;
export type StandardStructuredAnalysis = z.infer<typeof StandardAnalysisOutputSchema>;
export type MonitorStructuredAnalysis = z.infer<typeof MonitorAnalysisOutputSchema>;
export type AnalysisInput = z.infer<typeof AnalysisRequestSchema>;
export type AnalysisFollowUpOutput = z.infer<typeof AnalysisFollowUpOutputSchema>;
export type AppSettingsValues = z.infer<typeof AppSettingsSchema>;
export type MonitoringSignal = z.infer<typeof MonitoringSignalSchema>;

export type AnalysisSummary = {
  id: string;
  title: string;
  originalQuestion: string;
  reframedQuestion: string;
  domains: string[];
  createdAt: string;
  review: AnalysisReviewSummary;
};

export type RedTeamStatus = "completed" | "failed" | "skipped" | "unknown";

export type OutcomeLabel = "mostly_right" | "mixed" | "wrong";
export type TriggerState = "yes" | "no" | "unknown";
export type WatchlistTriggerState = "yes" | "no" | "partially" | "unknown";

export type AnalysisReviewRecord = {
  id: string;
  analysisId: string;
  outcomeLabel: OutcomeLabel | null;
  realizedScenario: string | null;
  downgradeTriggered: TriggerState | null;
  upgradeTriggered: TriggerState | null;
  watchlistTriggered: WatchlistTriggerState | null;
  reviewNotes: string | null;
  reviewedAt: string;
  updatedAt: string;
};

export type AnalysisReviewSummary = {
  reviewed: boolean;
  outcomeLabel: OutcomeLabel | null;
  realizedScenario: string | null;
  reviewedAt: string | null;
};

export type AnalysisFollowUpRecord = {
  id: string;
  question: string;
  title: string;
  answer: string;
  keyPoints: string[];
  watchouts: string[];
  modelUsed: string | null;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type PersistedAnalysisRecord = {
  id: string;
  title: string;
  notes: string | null;
  modelUsed: string | null;
  promptVersion: string;
  originalQuestion: string;
  selectedDomain: string | null;
  createdAt: string;
  updatedAt: string;
  redTeamStatus: RedTeamStatus;
  redTeamError: string | null;
  evidenceSnapshot: EvidenceItem[];
  evidenceSources: SourceSummary[];
  groundingValidation: GroundingValidationReport | null;
  analysis: StructuredAnalysis;
  followUps: AnalysisFollowUpRecord[];
  review: AnalysisReviewRecord | null;
};
