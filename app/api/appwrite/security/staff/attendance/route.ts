import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { AppwriteRestError, ensureAppwriteSchemaReady } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { listStaffAttendance, saveStaffAttendance } from "@/lib/appwrite/staff";

const readerRoles: UserRole[] = ["security_guard", "cso", "estate_admin", "super_admin"];
const writerRoles: UserRole[] = ["cso", "estate_admin", "super_admin"];

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: readerRoles });
    await ensureAppwriteSchemaReady();
    const date = request.nextUrl.searchParams.get("date") ?? "";
    const attendance = await listStaffAttendance(date, estateScopeFor(context));
    return NextResponse.json({ attendance });
  } catch (error) {
    return errorResponse(error, "Unable to load attendance.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid attendance request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: writerRoles });
    await ensureAppwriteSchemaReady();
    const record = await saveStaffAttendance({
      staffId: String(body.staffId ?? ""),
      staffName: String(body.staffName ?? ""),
      attendanceDate: String(body.attendanceDate ?? ""),
      clockIn: body.clockIn === undefined ? undefined : String(body.clockIn),
      clockOut: body.clockOut === undefined ? undefined : String(body.clockOut),
      status: body.status,
      source: body.source ? String(body.source) : "supervisor",
      note: body.note === undefined ? undefined : String(body.note),
      ...writableEstate(context, body)
    });

    return NextResponse.json({ attendance: record });
  } catch (error) {
    return errorResponse(error, "Unable to save attendance.");
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
    throw new Error("Super admin attendance writes require an estateId.");
  }

  return { estateId };
}
