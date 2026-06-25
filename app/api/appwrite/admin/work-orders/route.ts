import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { deleteWorkOrder, listWorkOrders, saveWorkOrder } from "@/lib/appwrite/facilities";

const allowedRoles: UserRole[] = ["estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles });
    await setupAppwriteOnboardingSchema();
    const workOrders = await listWorkOrders(estateScopeFor(context));
    return NextResponse.json({ workOrders });
  } catch (error) {
    return errorResponse(error, "Unable to load work orders.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid work order request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles });
    await setupAppwriteOnboardingSchema();
    const workOrder = await saveWorkOrder({
      id: body.id ? String(body.id) : undefined,
      facilityId: String(body.facilityId ?? ""),
      facilityName: String(body.facilityName ?? ""),
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
      category: String(body.category ?? ""),
      priority: body.priority,
      status: body.status,
      reportedByRole: context.role,
      assignedTo: String(body.assignedTo ?? ""),
      dueDate: String(body.dueDate ?? ""),
      cost: body.cost === undefined ? undefined : Number(body.cost),
      notes: String(body.notes ?? ""),
      ...writableEstate(context, body)
    });

    return NextResponse.json({ workOrder });
  } catch (error) {
    return errorResponse(error, "Unable to save work order.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await resolveSessionContext(request, { allowedRoles });
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!id) {
      return NextResponse.json({ error: "Work order id is required." }, { status: 400 });
    }
    const result = await deleteWorkOrder(id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error, "Unable to delete work order.");
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
    throw new Error("Super admin work order writes require an estateId.");
  }

  return { estateId };
}
