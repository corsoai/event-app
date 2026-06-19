import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { createGuardCheckpoint, findGuardCheckpointByToken, listGuardCheckpoints, renameGuardCheckpoint } from "@/lib/appwrite/tour";

const readerRoles: UserRole[] = ["security_guard", "cso", "estate_admin", "super_admin"];
const writerRoles: UserRole[] = ["cso", "estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: readerRoles });
    const scope = estateScopeFor(context);
    const qrToken = request.nextUrl.searchParams.get("qrToken") ?? "";
    const checkpoints = qrToken
      ? [await findGuardCheckpointByToken(qrToken, scope)].filter(Boolean)
      : await listGuardCheckpoints(scope);

    return NextResponse.json({ checkpoints });
  } catch (error) {
    return errorResponse(error, "Unable to load guard checkpoints.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid checkpoint request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: writerRoles });
    const checkpoint = await createGuardCheckpoint({
      checkpointCode: String(body.checkpointCode ?? ""),
      checkpointName: String(body.checkpointName ?? ""),
      gateName: String(body.gateName ?? ""),
      locationLabel: String(body.locationLabel ?? ""),
      qrToken: String(body.qrToken ?? ""),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      allowedRadius: Number(body.allowedRadius),
      status: body.status === "inactive" ? "inactive" : "active",
      estateId: writableEstateId(context, body)
    });

    return NextResponse.json({ checkpoint });
  } catch (error) {
    return errorResponse(error, "Unable to save checkpoint.");
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid checkpoint rename request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: writerRoles });
    const checkpoint = await renameGuardCheckpoint({
      checkpointId: String(body.checkpointId ?? ""),
      checkpointName: String(body.checkpointName ?? ""),
      ...estateScopeFor(context)
    });

    return NextResponse.json({ checkpoint });
  } catch (error) {
    return errorResponse(error, "Unable to rename checkpoint.");
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

function writableEstateId(context: SessionContext, body: unknown) {
  if (context.role !== "super_admin") {
    return context.estateId;
  }

  const estateId = typeof body === "object" && body
    ? String((body as { estateId?: unknown }).estateId ?? "").trim()
    : "";
  if (!estateId) {
    throw new Error("Super admin checkpoint writes require an estateId.");
  }

  return estateId;
}
