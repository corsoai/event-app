import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { deleteStaff, listStaff, saveStaff } from "@/lib/appwrite/staff";

const readerRoles: UserRole[] = ["security_guard", "cso", "estate_admin", "super_admin"];
const writerRoles: UserRole[] = ["cso", "estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: readerRoles });
    await setupAppwriteOnboardingSchema();
    const staff = await listStaff(estateScopeFor(context));
    return NextResponse.json({ staff });
  } catch (error) {
    return errorResponse(error, "Unable to load staff.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid staff request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: writerRoles });
    await setupAppwriteOnboardingSchema();
    const staff = await saveStaff({
      id: body.id ? String(body.id) : undefined,
      fullName: String(body.fullName ?? ""),
      roleTitle: String(body.roleTitle ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      photoUrl: String(body.photoUrl ?? ""),
      employmentStatus: body.employmentStatus,
      employmentType: body.employmentType,
      hireDate: String(body.hireDate ?? ""),
      endDate: String(body.endDate ?? ""),
      assignedPost: String(body.assignedPost ?? ""),
      checkpointId: String(body.checkpointId ?? ""),
      onDuty: body.onDuty === true,
      currentShiftLabel: String(body.currentShiftLabel ?? ""),
      idType: String(body.idType ?? ""),
      idNumber: String(body.idNumber ?? ""),
      emergencyContactName: String(body.emergencyContactName ?? ""),
      emergencyContactPhone: String(body.emergencyContactPhone ?? ""),
      address: String(body.address ?? ""),
      notes: String(body.notes ?? ""),
      ...writableEstate(context, body)
    });

    return NextResponse.json({ staff });
  } catch (error) {
    return errorResponse(error, "Unable to save staff.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await resolveSessionContext(request, { allowedRoles: writerRoles });
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!id) {
      return NextResponse.json({ error: "Staff id is required." }, { status: 400 });
    }
    const result = await deleteStaff(id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to delete staff.");
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
    throw new Error("Super admin staff writes require an estateId.");
  }

  return { estateId };
}
