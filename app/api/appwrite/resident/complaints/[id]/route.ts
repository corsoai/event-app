import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import {
  ForbiddenComplaintError,
  getResidentComplaint,
  resolveResidentComplaintSession
} from "@/lib/appwrite/complaints";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionContext = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const session = await resolveResidentComplaintSession(sessionContext);
    const complaint = await getResidentComplaint(id, session);

    return NextResponse.json({ complaint });
  } catch (error) {
    if (error instanceof ForbiddenComplaintError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Unable to load complaint.";
    const status = error instanceof SessionContextError
      ? error.status
      : error instanceof AppwriteRestError
        ? error.status
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
