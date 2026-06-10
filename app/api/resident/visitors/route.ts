import { NextRequest, NextResponse } from "next/server";
import { createAppwriteResidentVisitor } from "@/lib/appwrite/visitors";

export async function POST(request: NextRequest) {
  const appwriteUserId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid visitor request." }, { status: 400 });
  }

  try {
    const visitor = await createAppwriteResidentVisitor(appwriteUserId, {
      visitorName: String(body.visitorName ?? ""),
      phone: String(body.phone ?? ""),
      visitDate: String(body.visitDate ?? ""),
      arrivalTime: String(body.arrivalTime ?? ""),
      purpose: String(body.purpose ?? ""),
      count: Number(body.count ?? 1)
    });

    return NextResponse.json({ visitor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visitor invitation could not be saved.";
    const status = message.includes("expired") || message.includes("logged in") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
