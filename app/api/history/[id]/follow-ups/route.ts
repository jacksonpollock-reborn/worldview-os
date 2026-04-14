import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  buildAnalysisFollowUpRecordInput,
  parseAnalysisFollowUpRecord,
  runAnalysisFollowUp,
} from "@/lib/follow-up";
import { getAnalysisById, getAppSettings } from "@/lib/data";
import { logDbWriteFailure } from "@/lib/analysis";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-logger";
import { AnalysisFollowUpRequestSchema } from "@/schemas/follow-up";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const json = await request.json();
    const payload = AnalysisFollowUpRequestSchema.parse(json);
    const analysisRecord = await getAnalysisById(id);

    if (!analysisRecord) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    const settings = await getAppSettings();
    const result = await runAnalysisFollowUp(analysisRecord, payload.question, settings);

    let savedFollowUp;

    try {
      savedFollowUp = await prisma.analysisFollowUp.create({
        data: buildAnalysisFollowUpRecordInput({
          analysisId: analysisRecord.id,
          question: payload.question,
          followUp: result.followUp,
          rawText: result.rawText,
          modelUsed: result.modelUsed,
          promptVersion: result.promptVersion,
        }),
      });
    } catch (error) {
      logDbWriteFailure("db.write_follow_up_failed", error, {
        analysisId: analysisRecord.id,
        question: payload.question,
      });
      throw new Error("Unable to save this follow-up.");
    }

    return NextResponse.json({
      followUp: parseAnalysisFollowUpRecord(savedFollowUp),
    });
  } catch (error) {
    logServerError("follow_up.request_failed", error, { analysisId: id });
    const status = error instanceof ZodError ? 400 : 500;
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create this follow-up.";

    return NextResponse.json({ error: message }, { status });
  }
}
