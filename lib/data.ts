import { cache } from "react";
import {
  logDbReadFailure,
  parseAnalysisRecord,
  parseAnalysisSummaryRecord,
  type AnalysisReviewRow,
} from "@/lib/analysis";
import type { AnalysisWithFollowUpsRecord } from "@/lib/follow-up";
import { prisma } from "@/lib/prisma";
import { DEFAULT_APP_SETTINGS, parseSettingsRecord } from "@/lib/settings";

export const getRecentAnalyses = cache(async (limit = 5) => {
  try {
    const records = await prisma.analysis.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { review: true },
    });

    return records.map(parseAnalysisSummaryRecord);
  } catch (error) {
    logDbReadFailure("db.read_recent_analyses_failed", error, { limit });
    throw new Error("Unable to load recent analyses.");
  }
});

export const getAllAnalysisSummaries = cache(async () => {
  try {
    const records = await prisma.analysis.findMany({
      orderBy: { createdAt: "desc" },
      include: { review: true },
    });

    return records.map(parseAnalysisSummaryRecord);
  } catch (error) {
    logDbReadFailure("db.read_analysis_summaries_failed", error);
    throw new Error("Unable to load analysis history.");
  }
});

export const getAnalysisById = cache(async (id: string) => {
  try {
    const record = (await prisma.analysis.findUnique({
      where: { id },
      include: {
        followUps: {
          orderBy: { createdAt: "asc" },
        },
        review: true,
      },
    })) as (AnalysisWithFollowUpsRecord & { review: AnalysisReviewRow | null }) | null;
    return record ? parseAnalysisRecord(record) : null;
  } catch (error) {
    logDbReadFailure("db.read_analysis_failed", error, { id });
    throw new Error("Unable to load this analysis record.");
  }
});

export const getAppSettings = cache(async () => {
  try {
    const record = await prisma.appSettings.findUnique({ where: { id: 1 } });
    return record ? parseSettingsRecord(record) : DEFAULT_APP_SETTINGS;
  } catch (error) {
    logDbReadFailure("db.read_settings_failed", error);
    throw new Error("Unable to load analysis settings.");
  }
});
