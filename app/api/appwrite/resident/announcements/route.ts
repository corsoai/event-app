import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listResidentAnnouncements } from "@/lib/appwrite/announcements";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const announcements = await listResidentAnnouncements({ estateId: context.estateId });

    return NextResponse.json({ announcements });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load announcements.";
    const status = error instanceof SessionContextError
      ? error.status
      : error instanceof AppwriteRestError
        ? error.status
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
