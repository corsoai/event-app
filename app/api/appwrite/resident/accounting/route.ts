import { NextRequest, NextResponse } from "next/server";
import { listAppwriteResidentAccounting } from "@/lib/appwrite/accounting";
import { AppwriteRestError, appwriteRequest } from "@/lib/appwrite/server";
import { normalizePhoneNumber } from "@/lib/utils";

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  prefs?: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";

  if (role !== "resident" || !userId) {
    return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
  }

  try {
    const user = await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`);
    const prefs = user.prefs ?? {};
    const accounting = await listAppwriteResidentAccounting(
      {
        email: typeof prefs.email === "string" ? prefs.email : user.email,
        phone: typeof prefs.phone === "string" ? prefs.phone : normalizePhoneNumber(user.phone ?? ""),
        fullName: typeof prefs.fullName === "string" ? prefs.fullName : user.name
      },
      {
        bypassCache: request.nextUrl.searchParams.get("refresh") === "1"
      }
    );

    return NextResponse.json(accounting);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load resident accounting.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
