import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { createGuardPatrolEvent, listCsoReviews, listGuardPatrolEvents, listSecurityIncidents } from "@/lib/appwrite/tour";

const readerRoles: UserRole[] = ["cso", "estate_admin", "super_admin", "security_guard"];
const scannerRoles: UserRole[] = ["security_guard", "estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: readerRoles });
    const scope = estateScopeFor(context);
    const [patrols, incidents, reviews] = await Promise.all([
      listGuardPatrolEvents(150, scope),
      listSecurityIncidents(100, scope),
      listCsoReviews(100, scope)
    ]);
    return NextResponse.json({ patrols, incidents, reviews });
  } catch (error) {
    return errorResponse(error, "Unable to load patrol events.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid patrol request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: scannerRoles });
    const patrol = await createGuardPatrolEvent({
      qrToken: String(body.qrToken ?? ""),
      guardId: context.profileId,
      guardName: String(body.guardName ?? ""),
      deviceLatitude: Number(body.deviceLatitude),
      deviceLongitude: Number(body.deviceLongitude),
      scannedAt: String(body.scannedAt ?? ""),
      isOfflineLog: Boolean(body.isOfflineLog),
      deviceLabel: String(body.deviceLabel ?? ""),
      estateId: writableEstateId(context, body)
    });

    return NextResponse.json({ patrol });
  } catch (error) {
    return errorResponse(error, "Unable to save patrol event.");
  }
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

function writableEstateId(context: SessionContext, body: unknown) {
  if (context.role !== "super_admin") {
    return context.estateId;
  }

  const estateId = typeof body === "object" && body
    ? String((body as { estateId?: unknown }).estateId ?? "").trim()
    : "";
  if (!estateId) {
    throw new Error("Super admin patrol writes require an estateId.");
  }

  return estateId;
}
