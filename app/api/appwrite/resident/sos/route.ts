import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { createResidentSosIncident, listResidentSosIncidents, type CreateSosInput } from "@/lib/appwrite/sos";

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (role !== "resident" || !userId) {
    return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
  }

  try {
    const incidents = await listResidentSosIncidents(userId);
    return NextResponse.json({ incidents });
  } catch (error) {
    return errorResponse(error, "Unable to load SOS alerts.");
  }
}

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (role !== "resident" || !userId) {
    return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid SOS alert request." }, { status: 400 });
  }

  try {
    const incident = await createResidentSosIncident(userId, toCreateInput(body));

    return NextResponse.json({
      incident,
      incidentId: incident.id,
      status: "created"
    });
  } catch (error) {
    return errorResponse(error, "Unable to send SOS alert.");
  }
}

function toCreateInput(body: Record<string, unknown>): CreateSosInput {
  return {
    alertType: String(body.alertType ?? "panic") as CreateSosInput["alertType"],
    locationLabel: body.locationLabel === undefined ? undefined : String(body.locationLabel),
    details: body.details === undefined ? undefined : String(body.details)
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
