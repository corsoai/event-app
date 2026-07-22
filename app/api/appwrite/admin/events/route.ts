import { NextRequest, NextResponse } from "next/server";
import type { EventRecord } from "@/lib/types";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { createAppwriteEvent, getAppwriteEvent, listAppwriteEvents, updateAppwriteEventDetails, updateAppwriteEventStatus } from "@/lib/appwrite/events";

const organizerRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    if (eventId.trim()) {
      const event = await getAppwriteEvent(context, eventId);
      return NextResponse.json({ event });
    }
    const events = await listAppwriteEvents(context);
    return NextResponse.json({ events });
  } catch (error) {
    return eventErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid event request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    const event = await createAppwriteEvent(context, {
      name: String(body.name ?? ""),
      venue: String(body.venue ?? ""),
      address: String(body.address ?? ""),
      startAt: String(body.startAt ?? ""),
      endAt: body.endAt ? String(body.endAt) : undefined,
      gates: body.gates ? String(body.gates) : undefined
    });
    return NextResponse.json({ event });
  } catch (error) {
    return eventErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid event update request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    // Detail edits (name/venue/date/gates) and status changes share this route:
    // a body with a name is a detail edit; otherwise it's a status change.
    const event = body.name !== undefined
      ? await updateAppwriteEventDetails(context, String(body.eventId ?? ""), {
          name: String(body.name ?? ""),
          venue: String(body.venue ?? ""),
          address: String(body.address ?? ""),
          startAt: String(body.startAt ?? ""),
          endAt: body.endAt ? String(body.endAt) : undefined,
          gates: body.gates !== undefined ? String(body.gates) : undefined
        })
      : await updateAppwriteEventStatus(
          context,
          String(body.eventId ?? ""),
          String(body.status ?? "") as EventRecord["status"]
        );
    return NextResponse.json({ event });
  } catch (error) {
    return eventErrorResponse(error);
  }
}

function eventErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Event could not be saved online.";
  const status = error instanceof SessionContextError ? error.status
    : message.includes("was not found") ? 404
      : message.includes("logged in") || message.includes("profile") ? 401
        : message.includes("Only") || message.includes("cannot") ? 403
          : 400;

  return NextResponse.json({ error: message }, { status });
}
