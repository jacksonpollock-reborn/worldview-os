import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAnalysisRecordInput,
  logDbWriteFailure,
  runAnalysis,
} from "@/lib/analysis";
import { getAppSettings } from "@/lib/data";
import { AnalysisRequestSchema } from "@/schemas/analysis";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = AnalysisRequestSchema.parse(json);
    const settings = await getAppSettings();
    const result = await runAnalysis(payload, settings);

    let savedAnalysis;

    try {
      savedAnalysis = await prisma.analysis.create({
        data: buildAnalysisRecordInput(payload, result.analysis, result.rawText, {
          modelUsed: result.modelUsed,
          promptVersion: result.promptVersion,
          evidenceSnapshot: result.evidenceSnapshot,
          evidenceSources: result.evidenceSources,
          groundingValidation: result.groundingValidation,
        }),
      });
    } catch (error) {
      logDbWriteFailure("db.write_analysis_failed", error, {
        question: payload.question,
        modelUsed: result.modelUsed,
      });
      throw new Error("Unable to save the completed analysis.");
    }

    return NextResponse.json({
      id: savedAnalysis.id,
      analysis: result.analysis,
    });
  } catch (error) {
    logServerError("analysis.request_failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Unable to complete the analysis request.";

    const status =
      message.includes("API key") || message.includes("Model output")
        ? 502
        : message.includes("question")
          ? 400
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
