import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  isPrismaNotFoundError,
  logDbWriteFailure,
  parseAnalysisReviewRow,
} from "@/lib/analysis";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-logger";
import { AnalysisReviewUpsertSchema } from "@/schemas/review";

export const runtime = "nodejs";

function normalizeNullable<T extends string>(value: T | null | undefined): T | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const row = await prisma.analysisReview.findUnique({ where: { analysisId: id } });
    return NextResponse.json({ review: row ? parseAnalysisReviewRow(row) : null });
  } catch (error) {
    logServerError("review.read_failed", error, { analysisId: id });
    return NextResponse.json(
      { error: "Unable to load this review." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const json = await request.json();
    const payload = AnalysisReviewUpsertSchema.parse(json);

    const analysis = await prisma.analysis.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found." },
        { status: 404 },
      );
    }

    const data = {
      outcomeLabel: normalizeNullable(payload.outcomeLabel ?? null),
      realizedScenario: normalizeNullable(payload.realizedScenario ?? null),
      downgradeTriggered: normalizeNullable(payload.downgradeTriggered ?? null),
      upgradeTriggered: normalizeNullable(payload.upgradeTriggered ?? null),
      watchlistTriggered: normalizeNullable(payload.watchlistTriggered ?? null),
      reviewNotes: normalizeNullable(payload.reviewNotes ?? null),
    };

    const row = await prisma.analysisReview.upsert({
      where: { analysisId: id },
      update: data,
      create: { analysisId: id, ...data },
    });

    return NextResponse.json({ review: parseAnalysisReviewRow(row) });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error:
            "Invalid review payload: " +
            error.issues
              .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
              .join("; "),
        },
        { status: 400 },
      );
    }

    logDbWriteFailure("db.write_review_failed", error, { analysisId: id });
    logServerError("review.write_failed", error, { analysisId: id });
    return NextResponse.json(
      { error: "Unable to save this review." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.analysisReview.delete({ where: { analysisId: id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ ok: true });
    }
    logServerError("review.delete_failed", error, { analysisId: id });
    return NextResponse.json(
      { error: "Unable to delete this review." },
      { status: 500 },
    );
  }
}
