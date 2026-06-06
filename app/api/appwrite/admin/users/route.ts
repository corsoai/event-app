import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  createAppwriteManagedUser,
  deleteAppwriteManagedUser,
  listAppwriteManagedUsers,
  updateAppwriteManagedUser
} from "@/lib/appwrite/users";

const adminRoles = new Set(["estate_admin", "super_admin"]);
const superAdminRoles: UserRole[] = ["super_admin", "estate_admin", "cso", "security_guard", "resident", "vendor"];
const estateAdminRoles: UserRole[] = ["cso", "security_guard", "resident", "vendor"];

export async function GET(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const users = await listAppwriteManagedUsers(adminRole === "super_admin" ? "super-admin" : "admin");
    return NextResponse.json({ users });
  } catch (error) {
    return errorResponse(error, "Unable to load Appwrite users.");
  }
}

export async function POST(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const role = String(body.role ?? "resident") as UserRole;
  const allowedRoles = adminRole === "super_admin" ? superAdminRoles : estateAdminRoles;
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "You are not allowed to create this role." }, { status: 403 });
  }

  try {
    const result = await createAppwriteManagedUser({
      fullName: String(body.fullName ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      password: String(body.password ?? ""),
      role,
      estateId: String(body.estateId ?? ""),
      houseNumber: String(body.houseNumber ?? "")
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to create Appwrite user.");
  }
}

export async function PATCH(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const role = body.role ? String(body.role) as UserRole : undefined;
  const allowedRoles = adminRole === "super_admin" ? superAdminRoles : estateAdminRoles;
  if (role && !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "You are not allowed to assign this role." }, { status: 403 });
  }

  try {
    const result = await updateAppwriteManagedUser({
      profileId: String(body.profileId ?? ""),
      action: String(body.action ?? "update"),
      fullName: body.fullName === undefined ? undefined : String(body.fullName),
      phone: body.phone === undefined ? undefined : String(body.phone),
      role,
      estateId: body.estateId === undefined ? undefined : String(body.estateId),
      houseNumber: body.houseNumber === undefined ? undefined : String(body.houseNumber),
      active: body.active === undefined ? undefined : Boolean(body.active)
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to update Appwrite user.");
  }
}

export async function DELETE(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId") ?? "";

  try {
    const result = await deleteAppwriteManagedUser(profileId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to delete Appwrite user.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;

  return NextResponse.json({ error: message }, { status });
}
