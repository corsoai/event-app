import { NextRequest, NextResponse } from "next/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { bulkCreateAppwriteGuests, createAppwriteGuest, listAppwriteEventGuests, type GuestCreateInput } from "@/lib/appwrite/events";

const organizerRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  if (!eventId.trim()) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    const guests = await listAppwriteEventGuests(context, eventId);
    return NextResponse.json({ guests });
  } catch (error) {
    return guestErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.eventId) {
    return NextResponse.json({ error: "Invalid guest request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: organizerRoles });
    const eventId = String(body.eventId);

    if (Array.isArray(body.guests)) {
      const guestInputs: GuestCreateInput[] = body.guests.map((guest: Record<string, unknown>) => ({
        fullName: String(guest.fullName ?? ""),
        phone: guest.phone ? String(guest.phone) : undefined,
        email: guest.email ? String(guest.email) : undefined,
        category: guest.category === "vip" || guest.category === "staff" ? guest.category : "regular"
      }));
      const result = await bulkCreateAppwriteGuests(context, eventId, guestInputs);
      return NextResponse.json(result);
    }

    const guest = await createAppwriteGuest(context, eventId, {
      fullName: String(body.fullName ?? ""),
      phone: body.phone ? String(body.phone) : undefined,
      email: body.email ? String(body.email) : undefined,
      category: body.category === "vip" || body.category === "staff" ? body.category : "regular"
    });
    return NextResponse.json({ guest });
  } catch (error) {
    return guestErrorResponse(error);
  }
}

function guestErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Guest could not be saved online.";
  const status = error instanceof SessionContextError ? error.status
    : message.includes("was not found") ? 404
      : message.includes("logged in") || message.includes("profile") ? 401
        : message.includes("Only") || message.includes("cannot") ? 403
          : 400;

  return NextResponse.json({ error: message }, { status });
}
