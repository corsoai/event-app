import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { createGuardCheckpoint, findGuardCheckpointByToken, listGuardCheckpoints } from "@/lib/appwrite/tour";

const readerRoles = new Set<UserRole>(["security_guard", "cso", "estate_admin", "super_admin"]);
const writerRoles = new Set<UserRole>(["cso", "estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value as UserRole | undefined;
  if (!role || !readerRoles.has(role)) {
    return NextResponse.json({ error: "Security access is required." }, { status: 403 });
  }

  try {
    const qrToken = request.nextUrl.searchParams.get("qrToken") ?? "";
    const checkpoints = qrToken
      ? [await findGuardCheckpointByToken(qrToken)].filter(Boolean)
      : await listGuardCheckpoints();

    return NextResponse.json({ checkpoints });
  } catch (error) {
    return errorResponse(error, "Unable to load guard checkpoints.");
  }
}

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value as UserRole | undefined;
  if (!role || !writerRoles.has(role)) {
    return NextResponse.json({ error: "CSO access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid checkpoint request." }, { status: 400 });
  }

  try {
    const checkpoint = await createGuardCheckpoint({
      checkpointCode: String(body.checkpointCode ?? ""),
      checkpointName: String(body.checkpointName ?? ""),
      gateName: String(body.gateName ?? ""),
      locationLabel: String(body.locationLabel ?? ""),
      qrToken: String(body.qrToken ?? ""),
      latitude: Number(body.latitude),
      longitude: Number(body.longitude),
      allowedRadius: Number(body.allowedRadius),
      status: body.status === "inactive" ? "inactive" : "active"
    });

    return NextResponse.json({ checkpoint });
  } catch (error) {
    return errorResponse(error, "Unable to save checkpoint.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;
  return NextResponse.json({ error: message }, { status });
}
