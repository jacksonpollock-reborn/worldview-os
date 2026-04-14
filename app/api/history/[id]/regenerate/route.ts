import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAnalysisRecordInput,
  isPrismaNotFoundError,
  logDbWriteFailure,
  runAnalysis,
} from "@/lib/analysis";
import { getAppSettings } from "@/lib/data";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const existing = await prisma.analysis.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    const settings = await getAppSettings();
    const payload = {
      question: existing.originalQuestion,
      domain: existing.selectedDomain || "",
      timeHorizon: existing.timeHorizon || "",
      objective: existing.objective || "",
    };
    const result = await runAnalysis(payload, settings);

    const regenerated = await prisma.analysis.create({
      data: buildAnalysisRecordInput(payload, result.analysis, result.rawText, {
        modelUsed: result.modelUsed,
        promptVersion: result.promptVersion,
        evidenceSnapshot: result.evidenceSnapshot,
        evidenceSources: result.evidenceSources,
        groundingValidation: result.groundingValidation,
      }),
    });

    return NextResponse.json({ id: regenerated.id });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    logDbWriteFailure("db.regenerate_analysis_failed", error, { id });
    logServerError("analysis.regenerate_failed", error, { id });

    return NextResponse.json(
      { error: "Unable to regenerate this analysis." },
      { status: 500 },
    );
  }
}
