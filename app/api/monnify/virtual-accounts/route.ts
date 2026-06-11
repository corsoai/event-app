import { NextRequest, NextResponse } from "next/server";
import { listAppwriteResidentAccounting } from "@/lib/appwrite/accounting";
import { assignMonnifyVirtualAccount, getVirtualAccountForResident } from "@/lib/appwrite/virtual-accounts";
import { AppwriteRestError, appwriteRequest } from "@/lib/appwrite/server";
import { normalizePhoneNumber } from "@/lib/utils";

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  prefs?: Record<string, unknown>;
};

const adminRoles = new Set(["estate_admin", "super_admin", "admin"]);

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as { residentId?: string } | null;
  const residentId = body?.residentId?.trim() ?? "";
  if (!residentId) {
    return NextResponse.json({ error: "Resident ID is required." }, { status: 400 });
  }

  try {
    const account = await assignMonnifyVirtualAccount(residentId);
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign virtual account.";
    const status = error instanceof AppwriteRestError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";

  try {
    const residentId = adminRoles.has(role)
      ? request.nextUrl.searchParams.get("residentId")?.trim() ?? ""
      : role === "resident" && userId
        ? await residentIdFromSession(userId)
        : "";

    if (!residentId) {
      return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
    }

    const account = await getVirtualAccountForResident(residentId);
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load virtual account.";
    const status = error instanceof AppwriteRestError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

async function residentIdFromSession(userId: string) {
  const user = await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`);
  const prefs = user.prefs ?? {};
  const accounting = await listAppwriteResidentAccounting(
    {
      email: typeof prefs.email === "string" ? prefs.email : user.email,
      phone: typeof prefs.phone === "string" ? prefs.phone : normalizePhoneNumber(user.phone ?? ""),
      fullName: typeof prefs.fullName === "string" ? prefs.fullName : user.name
    },
    { bypassCache: false }
  );

  return accounting.resident?.id ?? "";
}
