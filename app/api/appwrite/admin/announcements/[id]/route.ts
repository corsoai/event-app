import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import {
  archiveAnnouncement,
  resolveAnnouncementActor,
  updateAnnouncement,
  type AnnouncementUpdateInput
} from "@/lib/appwrite/announcements";

const adminRoles = ["estate_admin", "super_admin"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid announcement update request." }, { status: 400 });
  }

  try {
    const session = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const { id } = await context.params;
    const actor = await resolveAnnouncementActor(session);
    const announcement = await updateAnnouncement(id, toAnnouncementUpdateInput(body), actor);

    return NextResponse.json({ announcement });
  } catch (error) {
    return errorResponse(error, "Unable to update announcement.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const { id } = await context.params;
    const actor = await resolveAnnouncementActor(session);
    const announcement = await archiveAnnouncement(id, actor);

    return NextResponse.json({ announcement });
  } catch (error) {
    return errorResponse(error, "Unable to archive announcement.");
  }
}

function toAnnouncementUpdateInput(body: Record<string, unknown>): AnnouncementUpdateInput {
  return {
    title: body.title === undefined ? undefined : String(body.title),
    message: body.message === undefined ? undefined : String(body.message),
    priority: body.priority === undefined ? undefined : String(body.priority) as AnnouncementUpdateInput["priority"],
    targetRole: body.targetRole === undefined ? undefined : String(body.targetRole) as AnnouncementUpdateInput["targetRole"],
    status: body.status === undefined ? undefined : String(body.status) as AnnouncementUpdateInput["status"],
    expiresAt: body.expiresAt === undefined ? undefined : String(body.expiresAt),
    isPinned: body.isPinned === undefined ? undefined : Boolean(body.isPinned)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;

  return NextResponse.json({ error: message }, { status });
}
