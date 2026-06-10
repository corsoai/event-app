import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  ForbiddenComplaintError,
  getResidentComplaint,
  resolveResidentComplaintSession
} from "@/lib/appwrite/complaints";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (role !== "resident" || !userId) {
    return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const session = await resolveResidentComplaintSession(userId);
    const complaint = await getResidentComplaint(id, session);

    return NextResponse.json({ complaint });
  } catch (error) {
    if (error instanceof ForbiddenComplaintError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Unable to load complaint.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
