import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { getResidentSosIncident } from "@/lib/appwrite/sos";

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
    const incident = await getResidentSosIncident(userId, id);
    return NextResponse.json({ incident });
  } catch (error) {
    return errorResponse(error, "Unable to load SOS alert.");
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;

  return NextResponse.json({ error: message }, { status });
}
