import { NextRequest, NextResponse } from "next/server";
import { listAppwriteResidentAccounting } from "@/lib/appwrite/accounting";
import { assignMonnifyVirtualAccount, getVirtualAccountForResident } from "@/lib/appwrite/virtual-accounts";
import { AppwriteRestError, appwriteRequest } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import { normalizePhoneNumber } from "@/lib/utils";

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  prefs?: Record<string, unknown>;
};

const adminRoles = ["estate_admin", "super_admin"] as const;
const allowedRoles = ["resident", "estate_admin", "super_admin"] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { residentId?: string } | null;
  const residentId = body?.residentId?.trim() ?? "";
  if (!residentId) {
    return NextResponse.json({ error: "Resident ID is required." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const account = await assignMonnifyVirtualAccount(residentId, estateScopeFor(context));
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign virtual account.";
    const status = error instanceof SessionContextError
      ? error.status
      : error instanceof AppwriteRestError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles });
    const residentId = context.role === "resident"
      ? await residentIdFromSession(context)
      : request.nextUrl.searchParams.get("residentId")?.trim() ?? "";

    if (!residentId) {
      return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
    }

    const account = await getVirtualAccountForResident(residentId, estateScopeFor(context));
    return NextResponse.json({ account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load virtual account.";
    const status = error instanceof SessionContextError
      ? error.status
      : error instanceof AppwriteRestError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

async function residentIdFromSession(context: SessionContext) {
  const user = await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(context.userId)}`);
  const prefs = user.prefs ?? {};
  const accounting = await listAppwriteResidentAccounting(
    {
      email: typeof prefs.email === "string" ? prefs.email : user.email,
      phone: typeof prefs.phone === "string" ? prefs.phone : normalizePhoneNumber(user.phone ?? ""),
      fullName: typeof prefs.fullName === "string" ? prefs.fullName : user.name
    },
    { estateId: context.estateId, bypassCache: false }
  );

  return accounting.resident?.id ?? "";
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}
