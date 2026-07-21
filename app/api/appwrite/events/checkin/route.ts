import { NextRequest, NextResponse } from "next/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { checkInAppwriteGuestByCode, listAppwriteEventCheckins } from "@/lib/appwrite/events";

const gateRoles = ["security_guard", "estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: gateRoles });
    const checkins = await listAppwriteEventCheckins(context, eventId);
    return NextResponse.json({ checkins });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gate log could not be loaded online.";
    const status = error instanceof SessionContextError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.eventId || !body.code) {
    return NextResponse.json({ error: "eventId and code are required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: gateRoles });
    const guest = await checkInAppwriteGuestByCode(
      context,
      String(body.eventId),
      String(body.code),
      String(body.gateName ?? "Main gate"),
      body.capturedAt ? String(body.capturedAt) : undefined
    );
    return NextResponse.json({ guest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Guest code could not be verified online.";
    const status = error instanceof SessionContextError ? error.status
      : message.includes("No guest found") ? 404
        : message.includes("already checked in") || message.includes("cancelled") ? 409
          : message.includes("logged in") || message.includes("profile") ? 401
            : message.includes("cannot") || message.includes("Only") ? 403
              : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
