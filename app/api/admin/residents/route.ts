import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory, updateAppwriteResident } from "@/lib/appwrite/residents";
import type { Resident } from "@/lib/types";

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
    return errorResponse(error, "Unable to load Appwrite residents.");
  }
}

export async function PATCH(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as Partial<Resident> & {
    residentId?: string;
    name?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid resident update request." }, { status: 400 });
  }

  try {
    const resident = await updateAppwriteResident({
      residentId: String(body.residentId ?? body.id ?? ""),
      name: String(body.name ?? ""),
      propertyId: body.propertyId,
      unitId: body.unitId,
      phone: body.phone,
      email: body.email,
      type: body.type === "owner" || body.type === "family member" ? body.type : "tenant",
      status: body.status === "inactive" || body.status === "moved out" ? body.status : "active",
      moveInDate: body.moveInDate,
      legacyName: body.legacyName,
      legacyAddress: body.legacyAddress,
      openingOutstanding: typeof body.openingOutstanding === "number" ? body.openingOutstanding : undefined,
      expectedMonthly: typeof body.expectedMonthly === "number" ? body.expectedMonthly : undefined,
      onboardingStatus: body.onboardingStatus,
      reviewReasons: body.reviewReasons
    });

    return NextResponse.json({ resident });
  } catch (error) {
    return errorResponse(error, "Unable to update Appwrite resident.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;
  return NextResponse.json({ error: message }, { status });
}
