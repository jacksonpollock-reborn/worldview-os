import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  isPrismaNotFoundError,
  logDbWriteFailure,
} from "@/lib/analysis";
import { getAnalysisById } from "@/lib/data";
import { AnalysisUpdateSchema } from "@/schemas/analysis";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const analysis = await getAnalysisById(id);

    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    logServerError("history.read_failed", error);
    return NextResponse.json(
      { error: "Unable to load this analysis record." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const json = await request.json();
    const payload = AnalysisUpdateSchema.parse(json);

    const analysis = await prisma.analysis.update({
      where: { id },
      data: {
        title: payload.title,
        notes: payload.notes,
      },
    });

    return NextResponse.json({ id: analysis.id });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    logDbWriteFailure("db.update_analysis_failed", error, { id });
    return NextResponse.json(
      {
        error:
        error instanceof Error ? error.message : "Unable to update this analysis.",
      },
      { status: error instanceof ZodError ? 400 : 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await prisma.analysis.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }

    logDbWriteFailure("db.delete_analysis_failed", error, { id });
    return NextResponse.json(
      { error: "Unable to delete this analysis." },
      { status: 500 },
    );
  }
}
