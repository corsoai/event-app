import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { deleteFacility, listFacilities, saveFacility } from "@/lib/appwrite/facilities";

const allowedRoles: UserRole[] = ["estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles });
    await setupAppwriteOnboardingSchema();
    const facilities = await listFacilities(estateScopeFor(context));
    return NextResponse.json({ facilities });
  } catch (error) {
    return errorResponse(error, "Unable to load facilities.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid facility request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles });
    await setupAppwriteOnboardingSchema();
    const facility = await saveFacility({
      id: body.id ? String(body.id) : undefined,
      name: String(body.name ?? ""),
      category: String(body.category ?? ""),
      location: String(body.location ?? ""),
      status: body.status,
      purchaseDate: String(body.purchaseDate ?? ""),
      warrantyExpiry: String(body.warrantyExpiry ?? ""),
      vendorId: String(body.vendorId ?? ""),
      vendorName: String(body.vendorName ?? ""),
      photoUrl: String(body.photoUrl ?? ""),
      notes: String(body.notes ?? ""),
      ...writableEstate(context, body)
    });

    return NextResponse.json({ facility });
  } catch (error) {
    return errorResponse(error, "Unable to save facility.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await resolveSessionContext(request, { allowedRoles });
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!id) {
      return NextResponse.json({ error: "Facility id is required." }, { status: 400 });
    }
    const result = await deleteFacility(id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to delete facility.");
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

function writableEstate(context: SessionContext, body: unknown) {
  if (context.role !== "super_admin") {
    return { estateId: context.estateId };
  }

  const estateId = typeof body === "object" && body
    ? String((body as { estateId?: unknown }).estateId ?? "").trim()
    : "";
  if (!estateId) {
    throw new Error("Super admin facility writes require an estateId.");
  }

  return { estateId };
}
