import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const result = await setupAppwriteOnboardingSchema();
    if (!result.ok) {
      return NextResponse.json(
        { error: `Appwrite server configuration is missing: ${result.missing.join(", ")}`, result },
        { status: 400 }
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: appwriteErrorMessage(error) },
      { status: error instanceof AppwriteRestError ? error.status : 500 }
    );
  }
}

function appwriteErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Appwrite schema setup failed.";
}
