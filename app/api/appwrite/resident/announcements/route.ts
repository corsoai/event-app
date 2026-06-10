import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { listResidentAnnouncements } from "@/lib/appwrite/announcements";

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (role !== "resident") {
    return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
  }

  try {
    const announcements = await listResidentAnnouncements();

    return NextResponse.json({ announcements });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load announcements.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
