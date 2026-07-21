import { NextRequest, NextResponse } from "next/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { listAppwriteEvents } from "@/lib/appwrite/events";

const gateRoles = ["security_guard", "estate_admin", "super_admin"] as const;

/**
 * Lightweight event listing for gate/usher staff — used to pick which event
 * to check guests in for. Organizer CRUD lives under /api/appwrite/admin/events.
 */
export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: gateRoles });
    const events = await listAppwriteEvents(context);
    return NextResponse.json({ events: events.filter((event) => event.status !== "ended") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Events could not be loaded online.";
    const status = error instanceof SessionContextError ? error.status
      : message.includes("logged in") || message.includes("profile") ? 401
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
