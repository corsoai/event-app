import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import {
  createAnnouncement,
  listAdminAnnouncements,
  resolveAnnouncementActor,
  type AnnouncementInput
} from "@/lib/appwrite/announcements";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const announcements = await listAdminAnnouncements({
      status: request.nextUrl.searchParams.get("status") ?? undefined
    }, estateScopeFor(context));

    return NextResponse.json({ announcements });
  } catch (error) {
    return errorResponse(error, "Unable to load announcements.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid announcement request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const actor = {
      ...await resolveAnnouncementActor(context),
      estateId: writableEstateId(context, body)
    };
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
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;

  return NextResponse.json({ error: message }, { status });
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}

function writableEstateId(context: SessionContext, body: Record<string, unknown>) {
  if (context.role !== "super_admin") {
    return context.estateId;
  }

  const estateId = String(body.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin announcement writes require an estateId.");
  }

  return estateId;
}
