import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { getPublicAppwriteEvent, publicRsvpAppwriteGuest } from "@/lib/appwrite/events";

// Public (unauthenticated) endpoints for the shareable RSVP page.
// GET returns public-safe event info only; POST issues a pass.

export async function GET(_request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const event = await getPublicAppwriteEvent(eventId);
    return NextResponse.json({ event });
  } catch (error) {
    return errorResponse(error, "This event could not be loaded.");
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!eventId || !body || !body.fullName || !body.phone) {
    return NextResponse.json({ error: "Your name and phone number are required." }, { status: 400 });
  }

  try {
    const guest = await publicRsvpAppwriteGuest(eventId, {
      fullName: String(body.fullName),
      phone: String(body.phone)
    });
    return NextResponse.json({
      guest: {
        fullName: guest.fullName,
        code: guest.code,
        category: guest.category
      }
    });
  } catch (error) {
    return errorResponse(error, "Your RSVP could not be saved.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError
    ? error.status
    : message.includes("could not be found") ? 404
      : message.includes("closed") || message.includes("full") ? 409
        : 400;
  return NextResponse.json({ error: message }, { status });
}
