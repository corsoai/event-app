import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { buildAllTablesCsvExport, buildResidentsCsvExport, csvFilename } from "@/lib/appwrite/export";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope") === "all" ? "all" : "residents";

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const estateScope = estateScopeFor(context);
    const csv = scope === "all"
      ? await buildAllTablesCsvExport(estateScope)
      : await buildResidentsCsvExport(estateScope);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(scope)}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export Appwrite data.";
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
