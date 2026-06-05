import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { buildAllTablesCsvExport, buildResidentsCsvExport, csvFilename } from "@/lib/appwrite/export";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const scope = request.nextUrl.searchParams.get("scope") === "all" ? "all" : "residents";

  try {
    const csv = scope === "all"
      ? await buildAllTablesCsvExport()
      : await buildResidentsCsvExport();

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(scope)}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export Appwrite data.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
