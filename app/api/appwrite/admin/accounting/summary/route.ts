import { NextRequest, NextResponse } from "next/server";
import { getAppwriteAccountingSummary } from "@/lib/appwrite/accounting";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const summary = await getAppwriteAccountingSummary({
      ...estateScopeFor(context),
      bypassCache: request.nextUrl.searchParams.get("refresh") === "1"
    });
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Appwrite accounting summary.";
    const status = error instanceof SessionContextError
      ? error.status
      : error instanceof AppwriteRestError
        ? error.status
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}
