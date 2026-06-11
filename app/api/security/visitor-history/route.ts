import { NextRequest, NextResponse } from "next/server";
import { listAppwriteSecurityVisitorHistory } from "@/lib/appwrite/visitors";

export async function GET(request: NextRequest) {
  const appwriteUserId = request.cookies.get("corso_appwrite_user")?.value ?? "";

  try {
    const visitors = await listAppwriteSecurityVisitorHistory(appwriteUserId);
    return NextResponse.json({ visitors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visitor movement history could not be loaded.";
    const status = message.includes("logged in") || message.includes("profile") ? 401
      : message.includes("cannot") ? 403
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
