import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import {
  deleteHouseholdMember,
  ForbiddenHouseholdError,
  resolveHouseholdSession,
  updateHouseholdMember,
  type HouseholdUpdateInput
} from "@/lib/appwrite/household";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid household member update request." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const sessionContext = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const session = await resolveHouseholdSession(sessionContext);
    const member = await updateHouseholdMember(id, toHouseholdUpdateInput(body), session);
    return NextResponse.json({ member });
  } catch (error) {
    return householdErrorResponse(error, "Unable to update household member.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionContext = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const session = await resolveHouseholdSession(sessionContext);
    const member = await deleteHouseholdMember(id, session);
    return NextResponse.json({ member });
  } catch (error) {
    return householdErrorResponse(error, "Unable to remove household member.");
  }
}

function toHouseholdUpdateInput(body: Record<string, unknown>): HouseholdUpdateInput {
  return {
    fullName: body.fullName === undefined ? undefined : String(body.fullName),
    relationship: body.relationship === undefined ? undefined : String(body.relationship) as HouseholdUpdateInput["relationship"],
    phone: body.phone === undefined ? undefined : String(body.phone),
    idType: body.idType === undefined ? undefined : String(body.idType) as HouseholdUpdateInput["idType"],
    idNumber: body.idNumber === undefined ? undefined : String(body.idNumber),
    hasEstateAccess: body.hasEstateAccess === undefined ? undefined : Boolean(body.hasEstateAccess),
    accessNote: body.accessNote === undefined ? undefined : String(body.accessNote),
    status: body.status === undefined ? undefined : String(body.status) as HouseholdUpdateInput["status"]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function householdErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ForbiddenHouseholdError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;
  return NextResponse.json({ error: message }, { status });
}
