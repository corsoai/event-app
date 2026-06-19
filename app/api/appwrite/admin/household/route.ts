import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listAdminHouseholdMembers } from "@/lib/appwrite/household";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const allowedRoles = ["estate_admin", "super_admin", "security_guard", "cso"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, {
      allowedRoles,
      requireEstate: true
    });
    const members = await listAdminHouseholdMembers({
      residentId: request.nextUrl.searchParams.get("residentId") ?? undefined,
      unitCode: request.nextUrl.searchParams.get("unitCode") ?? undefined,
      hasEstateAccess: request.nextUrl.searchParams.get("hasEstateAccess") ?? undefined
    }, estateScopeFor(context));
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load household members.";
    const status = error instanceof SessionContextError ? error.status
      : error instanceof AppwriteRestError ? error.status
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}
