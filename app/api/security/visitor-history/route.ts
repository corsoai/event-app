import { NextRequest, NextResponse } from "next/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { listAppwriteSecurityVisitorHistory } from "@/lib/appwrite/visitors";

const securityVisitorRoles = ["security_guard", "estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: securityVisitorRoles });
    const visitors = await listAppwriteSecurityVisitorHistory(context);
    return NextResponse.json({ visitors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visitor movement history could not be loaded.";
    const status = error instanceof SessionContextError ? error.status
      : message.includes("logged in") || message.includes("profile") ? 401
      : message.includes("cannot") ? 403
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
