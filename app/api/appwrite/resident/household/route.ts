import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import {
  createHouseholdMember,
  listResidentHouseholdMembers,
  resolveHouseholdSession,
  type HouseholdInput
} from "@/lib/appwrite/household";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const session = await resolveHouseholdSession(context);
    const members = await listResidentHouseholdMembers(session);
    return NextResponse.json({ members });
  } catch (error) {
    return errorResponse(error, "Unable to load household members.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid household member request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const session = await resolveHouseholdSession(context);
    const member = await createHouseholdMember(toHouseholdInput(body), session);
    return NextResponse.json({ member });
  } catch (error) {
    return errorResponse(error, "Unable to add household member.");
  }
}

function toHouseholdInput(body: Record<string, unknown>): HouseholdInput {
  return {
    fullName: String(body.fullName ?? ""),
    relationship: String(body.relationship ?? "other") as HouseholdInput["relationship"],
    phone: body.phone === undefined ? undefined : String(body.phone),
    idType: body.idType === undefined ? undefined : String(body.idType) as HouseholdInput["idType"],
    idNumber: body.idNumber === undefined ? undefined : String(body.idNumber),
    hasEstateAccess: Boolean(body.hasEstateAccess),
    accessNote: body.accessNote === undefined ? undefined : String(body.accessNote)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
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
