import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { listAdminComplaints } from "@/lib/appwrite/complaints";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const complaints = await listAdminComplaints({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      priority: request.nextUrl.searchParams.get("priority") ?? undefined,
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined
    }, estateScopeFor(context));

    return NextResponse.json({ complaints });
  } catch (error) {
    return errorResponse(error, "Unable to load complaints.");
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

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}
