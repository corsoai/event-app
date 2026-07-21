import { NextRequest, NextResponse } from "next/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { addAppwriteVipPlate, listAppwriteVipPlates, removeAppwriteVipPlate } from "@/lib/appwrite/vip-parking";

const organizerRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    const plates = await listAppwriteVipPlates(context, eventId);
    return NextResponse.json({ plates });
  } catch (error) {
    return errorResponse(error, "VIP plates could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.eventId || !body.plate) {
    return NextResponse.json({ error: "eventId and plate are required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    const plate = await addAppwriteVipPlate(context, String(body.eventId), {
      plate: String(body.plate),
      label: body.label ? String(body.label) : undefined
    });
    return NextResponse.json({ plate });
  } catch (error) {
    return errorResponse(error, "VIP plate could not be saved.");
  }
}

export async function DELETE(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  const plateId = request.nextUrl.searchParams.get("plateId") ?? "";
  if (!eventId || !plateId) {
    return NextResponse.json({ error: "eventId and plateId are required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    await removeAppwriteVipPlate(context, eventId, plateId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "VIP plate could not be removed.");
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
