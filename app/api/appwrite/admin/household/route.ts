import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listAdminHouseholdMembers } from "@/lib/appwrite/household";

const allowedRoles = new Set(["estate_admin", "super_admin", "security_guard", "cso"]);

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!allowedRoles.has(role)) {
    return NextResponse.json({ error: "Admin or security access is required." }, { status: 403 });
  }

  try {
    const members = await listAdminHouseholdMembers({
      residentId: request.nextUrl.searchParams.get("residentId") ?? undefined,
      unitCode: request.nextUrl.searchParams.get("unitCode") ?? undefined,
      hasEstateAccess: request.nextUrl.searchParams.get("hasEstateAccess") ?? undefined
    });
    return NextResponse.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load household members.";
    const status = error instanceof AppwriteRestError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
