import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { listVehicleLogs, saveVehicleLog } from "@/lib/appwrite/vehicles";

const readerRoles: UserRole[] = ["security_guard", "cso", "estate_admin", "super_admin"];
const writerRoles: UserRole[] = ["security_guard", "cso", "estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: readerRoles });
    await setupAppwriteOnboardingSchema();
    const logs = await listVehicleLogs(100, estateScopeFor(context));
    return NextResponse.json({ logs });
  } catch (error) {
    return errorResponse(error, "Unable to load vehicle logs.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid vehicle log request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: writerRoles });
    await setupAppwriteOnboardingSchema();
    const log = await saveVehicleLog({
      plate: String(body.plate ?? ""),
      vehicleClass: String(body.vehicleClass ?? ""),
      direction: body.direction === "out" ? "out" : "in",
      postLabel: String(body.postLabel ?? ""),
      guardId: context.profileId ?? "",
      guardName: String(body.guardName ?? ""),
      scannedAt: String(body.scannedAt ?? ""),
      visitorId: String(body.visitorId ?? ""),
      visitorCode: String(body.visitorCode ?? ""),
      residentId: String(body.residentId ?? ""),
      matchStatus: String(body.matchStatus ?? "unknown"),
      region: String(body.region ?? ""),
      score: body.score === undefined ? undefined : Number(body.score),
      rawRead: String(body.rawRead ?? ""),
      note: String(body.note ?? ""),
      ...writableEstate(context, body)
    });

    return NextResponse.json({ log });
  } catch (error) {
    return errorResponse(error, "Unable to save vehicle log.");
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
    throw new Error("Super admin vehicle log writes require an estateId.");
  }

  return { estateId };
}
