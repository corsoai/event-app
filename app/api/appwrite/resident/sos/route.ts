import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { createResidentSosIncident, listResidentSosIncidents, type CreateSosInput } from "@/lib/appwrite/sos";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const incidents = await listResidentSosIncidents(context);
    return NextResponse.json({ incidents });
  } catch (error) {
    return errorResponse(error, "Unable to load SOS alerts.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid SOS alert request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const incident = await createResidentSosIncident(context, toCreateInput(body));

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
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;

  return NextResponse.json({ error: message }, { status });
}
