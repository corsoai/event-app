import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  createAnnouncement,
  listAdminAnnouncements,
  resolveAnnouncementActor,
  type AnnouncementInput
} from "@/lib/appwrite/announcements";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const announcements = await listAdminAnnouncements({
      status: request.nextUrl.searchParams.get("status") ?? undefined
    });

    return NextResponse.json({ announcements });
  } catch (error) {
    return errorResponse(error, "Unable to load announcements.");
  }
}

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (!adminRoles.has(role) || !userId) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid announcement request." }, { status: 400 });
  }

  try {
    const actor = await resolveAnnouncementActor(userId, role);
    const announcement = await createAnnouncement(toAnnouncementInput(body), actor);

    return NextResponse.json({ announcement });
  } catch (error) {
    return errorResponse(error, "Unable to create announcement.");
  }
}

function toAnnouncementInput(body: Record<string, unknown>): AnnouncementInput {
  return {
    title: String(body.title ?? ""),
    message: String(body.message ?? ""),
    priority: String(body.priority ?? "normal") as AnnouncementInput["priority"],
    targetRole: String(body.targetRole ?? "all") as AnnouncementInput["targetRole"],
    status: String(body.status ?? "draft") as AnnouncementInput["status"],
    expiresAt: body.expiresAt === undefined ? undefined : String(body.expiresAt),
    isPinned: Boolean(body.isPinned)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;

  return NextResponse.json({ error: message }, { status });
}
