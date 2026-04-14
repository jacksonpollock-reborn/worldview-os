import { NextResponse } from "next/server";
import { getAllAnalysisSummaries } from "@/lib/data";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const analyses = await getAllAnalysisSummaries();
    return NextResponse.json({ analyses });
  } catch (error) {
    logServerError("history.list_failed", error);
    return NextResponse.json(
      { error: "Unable to load analysis history." },
      { status: 500 },
    );
  }
}
