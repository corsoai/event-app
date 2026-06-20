import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  createAppwriteManagedUser,
  deleteAppwriteManagedUser,
  listAppwriteManagedUsers,
  updateAppwriteManagedUser
} from "@/lib/appwrite/users";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;
const superAdminRoles: UserRole[] = ["super_admin", "estate_admin", "cso", "security_guard", "resident", "vendor"];
const estateAdminRoles: UserRole[] = ["cso", "security_guard", "resident", "vendor"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const users = await listAppwriteManagedUsers(
      context.role === "super_admin" ? "super-admin" : "admin",
      estateScopeFor(context)
    );
    return NextResponse.json({ users });
  } catch (error) {
    return errorResponse(error, "Unable to load users.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const role = String(body.role ?? "resident") as UserRole;
    const allowedRoles = context.role === "super_admin" ? superAdminRoles : estateAdminRoles;
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: "You are not allowed to create this role." }, { status: 403 });
    }

    const result = await createAppwriteManagedUser({
      fullName: String(body.fullName ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      password: String(body.password ?? ""),
      role,
      estateId: writableEstateIdFor(context, body, role),
      houseNumber: String(body.houseNumber ?? "")
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to create user.");
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const role = body.role ? String(body.role) as UserRole : undefined;
    const allowedRoles = context.role === "super_admin" ? superAdminRoles : estateAdminRoles;
    if (role && !allowedRoles.includes(role)) {
      return NextResponse.json({ error: "You are not allowed to assign this role." }, { status: 403 });
    }

    const result = await updateAppwriteManagedUser({
      profileId: String(body.profileId ?? ""),
      action: String(body.action ?? "update"),
      fullName: body.fullName === undefined ? undefined : String(body.fullName),
      phone: body.phone === undefined ? undefined : String(body.phone),
      role,
      estateId: patchEstateIdFor(context, body, role),
      houseNumber: body.houseNumber === undefined ? undefined : String(body.houseNumber),
      active: body.active === undefined ? undefined : Boolean(body.active)
    }, estateScopeFor(context));

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to update user.");
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId") ?? "";

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const result = await deleteAppwriteManagedUser(profileId, estateScopeFor(context));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to delete user.");
  }
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}

function writableEstateIdFor(context: SessionContext, body: { estateId?: unknown }, targetRole?: UserRole) {
  if (targetRole === "super_admin") {
    return "platform";
  }

  if (context.role !== "super_admin") {
    return context.estateId;
  }

  const estateId = String(body.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin user writes require an estateId.");
  }

  return estateId;
}

function patchEstateIdFor(context: SessionContext, body: { estateId?: unknown }, targetRole?: UserRole) {
  if (targetRole === "super_admin") {
    return "platform";
  }

  if (context.role !== "super_admin") {
    return context.estateId;
  }

  if (body.estateId === undefined) {
    return undefined;
  }

  const estateId = String(body.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin user writes require an estateId when changing estate assignment.");
  }

  return estateId;
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
