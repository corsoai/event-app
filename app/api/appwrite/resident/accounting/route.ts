import { NextRequest, NextResponse } from "next/server";
import { listAppwriteResidentAccounting } from "@/lib/appwrite/accounting";
import { AppwriteRestError, appwriteRequest } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";
import { normalizePhoneNumber } from "@/lib/utils";

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  prefs?: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const user = await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(context.userId)}`);
    const prefs = user.prefs ?? {};
    const accounting = await listAppwriteResidentAccounting(
      {
        residentId: typeof prefs.residentId === "string" ? prefs.residentId : undefined,
        houseNumber: typeof prefs.houseNumber === "string" ? prefs.houseNumber : undefined,
        email: typeof prefs.email === "string" ? prefs.email : user.email,
        phone: typeof prefs.phone === "string" ? prefs.phone : normalizePhoneNumber(user.phone ?? ""),
        fullName: typeof prefs.fullName === "string" ? prefs.fullName : user.name
      },
      {
        estateId: context.estateId,
        bypassCache: request.nextUrl.searchParams.get("refresh") === "1"
      }
    );

    return NextResponse.json(accounting);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load resident accounting.";
    const status = error instanceof SessionContextError
      ? error.status
      : error instanceof AppwriteRestError
        ? error.status
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
