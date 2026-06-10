import { NextRequest, NextResponse } from "next/server";
import { readAppwriteAccessRequestStatus } from "@/lib/appwrite/access-requests";

export async function GET(request: NextRequest) {
  const identifier = request.nextUrl.searchParams.get("identifier") ?? "";
  if (!identifier.trim()) {
    return NextResponse.json({ error: "Identifier is required." }, { status: 400 });
  }

  try {
    const requestStatus = await readAppwriteAccessRequestStatus(identifier);
    if (!requestStatus) {
      return NextResponse.json({ request: null }, { status: 404 });
    }

    return NextResponse.json({ request: requestStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Access request status could not be checked.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
