import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listAdminSosIncidents, updateSosIncident, type UpdateSosInput } from "@/lib/appwrite/sos";

const readerRoles = new Set<UserRole>(["estate_admin", "super_admin", "cso", "security_guard"]);
const updaterRoles = new Set<UserRole>(["estate_admin", "super_admin", "cso", "security_guard"]);

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value as UserRole | undefined;
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (!role || !readerRoles.has(role) || !userId) {
    return NextResponse.json({ error: "Security alert access is required." }, { status: 403 });
  }

  try {
    const incidents = await listAdminSosIncidents(userId, role);
    return NextResponse.json({ incidents });
  } catch (error) {
    return errorResponse(error, "Unable to load SOS alerts.");
  }
}

export async function PATCH(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value as UserRole | undefined;
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (!role || !updaterRoles.has(role) || !userId) {
    return NextResponse.json({ error: "Security alert access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid SOS update request." }, { status: 400 });
  }

  const status = String(body.status ?? "");
  if (role === "security_guard" && (status === "resolved" || status === "false_alarm" || status === "closed")) {
    return NextResponse.json({ error: "Security guards can acknowledge or mark responding only." }, { status: 403 });
  }

  try {
    const incident = await updateSosIncident(userId, role, toUpdateInput(body));
    return NextResponse.json({ incident });
  } catch (error) {
    return errorResponse(error, "Unable to update SOS alert.");
  }
}

function toUpdateInput(body: Record<string, unknown>): UpdateSosInput {
  return {
    incidentId: String(body.incidentId ?? ""),
    status: String(body.status ?? "acknowledged") as UpdateSosInput["status"],
    note: body.note === undefined ? undefined : String(body.note),
    assignedToProfileId: body.assignedToProfileId === undefined ? undefined : String(body.assignedToProfileId)
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
