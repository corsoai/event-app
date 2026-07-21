import { NextRequest, NextResponse } from "next/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listAppwriteVipPlates, markAppwriteVipPlateArrived } from "@/lib/appwrite/vip-parking";

const gateRoles = ["security_guard", "estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: gateRoles });
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
    const context = await resolveSessionContext(request, { allowedRoles: gateRoles });
    const plate = await markAppwriteVipPlateArrived(
      context,
      String(body.eventId),
      String(body.plate),
      String(body.gateName ?? "Car gate")
    );
    return NextResponse.json({ plate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VIP arrival could not be logged.";
    const status = error instanceof SessionContextError ? error.status
      : error instanceof AppwriteRestError ? error.status
        : message.includes("not on this event") ? 404
          : message.includes("already arrived") ? 409
            : 400;
    return NextResponse.json({ error: message }, { status });
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
