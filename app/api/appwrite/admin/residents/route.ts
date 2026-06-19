import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory, updateAppwriteResident } from "@/lib/appwrite/residents";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import type { Resident } from "@/lib/types";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const directory = await listAppwriteResidentDirectory(estateScopeFor(context));
    return NextResponse.json(directory);
  } catch (error) {
    return adminRouteError(error, "Unable to load Appwrite residents.");
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null) as Partial<Resident> & {
    residentId?: string;
    name?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid resident update request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const resident = await updateAppwriteResident({
      residentId: String(body.residentId ?? body.id ?? ""),
      name: String(body.name ?? ""),
      ...estateScopeFor(context),
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
    return adminRouteError(error, "Unable to update Appwrite resident.");
  }
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}

function adminRouteError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;

  return NextResponse.json({ error: message }, { status });
}
