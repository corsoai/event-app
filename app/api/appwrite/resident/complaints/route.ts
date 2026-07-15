import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError, ensureAppwriteSchemaReady } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import {
  createResidentComplaint,
  listResidentComplaints,
  resolveResidentComplaintSession,
  type ComplaintCreateInput
} from "@/lib/appwrite/complaints";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const session = await resolveResidentComplaintSession(context);
    const complaints = await listResidentComplaints(session);

    return NextResponse.json({ complaints });
  } catch (error) {
    return errorResponse(error, "Unable to load complaints.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid complaint request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    await ensureAppwriteSchemaReady();
    const session = await resolveResidentComplaintSession(context);
    const complaint = await createResidentComplaint(toComplaintCreateInput(body), session);

    return NextResponse.json({ complaint });
  } catch (error) {
    return errorResponse(error, "Unable to submit complaint.");
  }
}

function toComplaintCreateInput(body: Record<string, unknown>): ComplaintCreateInput {
  return {
    category: String(body.category ?? "other") as ComplaintCreateInput["category"],
    priority: String(body.priority ?? "medium") as ComplaintCreateInput["priority"],
    subject: String(body.subject ?? body.title ?? ""),
    description: String(body.description ?? "")
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
