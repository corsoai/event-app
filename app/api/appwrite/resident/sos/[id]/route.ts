import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { getResidentSosIncident } from "@/lib/appwrite/sos";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionContext = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const incident = await getResidentSosIncident(sessionContext, id);
    return NextResponse.json({ incident });
  } catch (error) {
    return errorResponse(error, "Unable to load SOS alert.");
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
