import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { createGuardPatrolEvent, listGuardPatrolEvents } from "@/lib/appwrite/tour";

const readerRoles = new Set<UserRole>(["cso", "estate_admin", "super_admin", "security_guard"]);
const scannerRoles = new Set<UserRole>(["security_guard", "estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value as UserRole | undefined;
  if (!role || !readerRoles.has(role)) {
    return NextResponse.json({ error: "Security access is required." }, { status: 403 });
  }

  try {
    const patrols = await listGuardPatrolEvents(150);
    return NextResponse.json({ patrols });
  } catch (error) {
    return errorResponse(error, "Unable to load patrol events.");
  }
}

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value as UserRole | undefined;
  if (!role || !scannerRoles.has(role)) {
    return NextResponse.json({ error: "Security guard access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid patrol request." }, { status: 400 });
  }

  try {
    const patrol = await createGuardPatrolEvent({
      qrToken: String(body.qrToken ?? ""),
      guardId: String(body.guardId ?? request.cookies.get("corso_appwrite_user")?.value ?? ""),
      guardName: String(body.guardName ?? ""),
      deviceLatitude: Number(body.deviceLatitude),
      deviceLongitude: Number(body.deviceLongitude),
      scannedAt: String(body.scannedAt ?? ""),
      isOfflineLog: Boolean(body.isOfflineLog),
      deviceLabel: String(body.deviceLabel ?? "")
    });

    return NextResponse.json({ patrol });
  } catch (error) {
    return errorResponse(error, "Unable to save patrol event.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;
  return NextResponse.json({ error: message }, { status });
}
