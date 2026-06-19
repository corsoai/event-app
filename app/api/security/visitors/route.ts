import { NextRequest, NextResponse } from "next/server";
import type { Visitor } from "@/lib/types";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { findAppwriteVisitorByCode, listAppwriteExpectedVisitors, updateAppwriteVisitorStatus } from "@/lib/appwrite/visitors";

const securityVisitorRoles = ["security_guard", "estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";

  try {
    const context = await resolveSessionContext(request, { allowedRoles: securityVisitorRoles });
    if (!code.trim()) {
      const visitors = await listAppwriteExpectedVisitors(context);
      return NextResponse.json({ visitors });
    }

    const result = await findAppwriteVisitorByCode(context, code);
    return NextResponse.json(result);
  } catch (error) {
    return visitorErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid visitor update request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: securityVisitorRoles });
    const visitor = await updateAppwriteVisitorStatus(
      context,
      String(body.visitorId ?? ""),
      String(body.status ?? "") as Visitor["status"]
    );
    return NextResponse.json({ visitor });
  } catch (error) {
    return visitorErrorResponse(error);
  }
}

function visitorErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Visitor code could not be verified online.";
  const status = error instanceof SessionContextError ? error.status
    : message.includes("No valid visitor") ? 404
    : message.includes("expired") || message.includes("cancelled") ? 410
      : message.includes("logged in") || message.includes("profile") ? 401
        : message.includes("cannot") || message.includes("Only") ? 403
          : 400;

  return NextResponse.json({ error: message }, { status });
}
