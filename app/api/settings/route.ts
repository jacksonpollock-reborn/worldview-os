import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/data";
import { AppSettingsSchema } from "@/schemas/settings";
import { logServerError } from "@/lib/server-logger";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getAppSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    logServerError("settings.read_failed", error);
    return NextResponse.json(
      { error: "Unable to load analysis settings." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const payload = AppSettingsSchema.parse(json);

    const settings = await prisma.appSettings.upsert({
      where: { id: 1 },
      update: payload,
      create: { id: 1, ...payload },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    logServerError("settings.write_failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save settings.",
      },
      { status: error instanceof ZodError ? 400 : 500 },
    );
  }
}
