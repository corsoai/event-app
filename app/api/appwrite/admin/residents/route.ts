import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory } from "@/lib/appwrite/residents";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const directory = await listAppwriteResidentDirectory();
    return NextResponse.json(directory);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Appwrite residents.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
