import { NextRequest, NextResponse } from "next/server";
import type { Visitor } from "@/lib/types";
import { findAppwriteVisitorByCode, listAppwriteExpectedVisitors, updateAppwriteVisitorStatus } from "@/lib/appwrite/visitors";

export async function GET(request: NextRequest) {
  const appwriteUserId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";

  try {
    if (!code.trim()) {
      const visitors = await listAppwriteExpectedVisitors(appwriteUserId);
      return NextResponse.json({ visitors });
    }

    const result = await findAppwriteVisitorByCode(appwriteUserId, code);
    return NextResponse.json(result);
  } catch (error) {
    return visitorErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  const appwriteUserId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid visitor update request." }, { status: 400 });
  }

  try {
    const visitor = await updateAppwriteVisitorStatus(
      appwriteUserId,
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
  const status = message.includes("No valid visitor") ? 404
    : message.includes("expired") || message.includes("cancelled") ? 410
      : message.includes("logged in") || message.includes("profile") ? 401
        : message.includes("cannot") || message.includes("Only") ? 403
          : 400;

  return NextResponse.json({ error: message }, { status });
}
