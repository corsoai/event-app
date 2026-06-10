import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  getAdminComplaint,
  resolveComplaintActor,
  updateComplaint,
  type ComplaintUpdateInput
} from "@/lib/appwrite/complaints";

const adminRoles = new Set(["estate_admin", "super_admin"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const complaint = await getAdminComplaint(id);

    return NextResponse.json({ complaint });
  } catch (error) {
    return errorResponse(error, "Unable to load complaint.");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (!adminRoles.has(role) || !userId) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid complaint update request." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const actor = await resolveComplaintActor(userId, role);
    const complaint = await updateComplaint(id, toComplaintUpdateInput(body), actor);

    return NextResponse.json({ complaint });
  } catch (error) {
    return errorResponse(error, "Unable to update complaint.");
  }
}

function toComplaintUpdateInput(body: Record<string, unknown>): ComplaintUpdateInput {
  return {
    status: body.status === undefined ? undefined : String(body.status) as ComplaintUpdateInput["status"],
    assignedTo: body.assignedTo === undefined ? undefined : String(body.assignedTo),
    assignedToName: body.assignedToName === undefined ? undefined : String(body.assignedToName),
    adminResponse: body.adminResponse === undefined ? undefined : String(body.adminResponse),
    resolvedAt: body.resolvedAt === undefined ? undefined : String(body.resolvedAt),
    priority: body.priority === undefined ? undefined : String(body.priority) as ComplaintUpdateInput["priority"]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;

  return NextResponse.json({ error: message }, { status });
}
