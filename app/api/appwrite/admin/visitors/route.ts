import { NextRequest, NextResponse } from "next/server";
import { listAppwriteAdminVisitors } from "@/lib/appwrite/visitors";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

const adminVisitorRoles = ["estate_admin", "super_admin", "cso"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, {
      allowedRoles: adminVisitorRoles,
      requireEstate: true
    });
    const visitors = await listAppwriteAdminVisitors(context);
    return NextResponse.json({ visitors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visitor logs could not be loaded.";
    const status = error instanceof SessionContextError ? error.status
      : message.includes("logged in") || message.includes("profile") ? 401
      : message.includes("cannot") ? 403
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
