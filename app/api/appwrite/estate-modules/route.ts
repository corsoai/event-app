import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import {
  AppwriteRestError,
  appwriteRequest,
  appwriteUpsertRow,
  ensureAppwriteSchemaReady,
  getAppwriteServerConfig
} from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

// Module keys that estate admins may switch on/off per estate.
// (Kept in sync with TOGGLABLE_MODULE_OPTIONS in components/dashboard/pages.tsx.)
const TOGGLABLE_MODULES = [
  "guard_tour",
  "plate_capture",
  "facilities",
  "marketplace",
  "household",
  "knowledge_base",
  "digital_ids"
] as const;

const readerRoles: UserRole[] = ["estate_admin", "super_admin", "cso", "security_guard", "resident", "vendor"];
const writerRoles: UserRole[] = ["estate_admin", "super_admin"];

type EstateRow = {
  disabledModules?: string;
};

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: readerRoles });
    const estateId = estateIdFor(context, request.nextUrl.searchParams.get("estateId"));
    if (!estateId) {
      return NextResponse.json({ disabled: [] });
    }

    return NextResponse.json({ disabled: await readDisabledModules(estateId) });
  } catch (error) {
    return errorResponse(error, "Unable to load estate modules.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { disabled?: unknown; estateId?: unknown } | null;
  if (!body || !Array.isArray(body.disabled)) {
    return NextResponse.json({ error: "Invalid module settings request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: writerRoles });
    const estateId = estateIdFor(context, typeof body.estateId === "string" ? body.estateId : null);
    if (!estateId) {
      return NextResponse.json({ error: "An estateId is required." }, { status: 400 });
    }

    const disabled = body.disabled
      .map((value) => String(value))
      .filter((value) => (TOGGLABLE_MODULES as readonly string[]).includes(value));

    await ensureAppwriteSchemaReady();
    await appwriteUpsertRow<EstateRow>("estates", estateId, {
      disabledModules: JSON.stringify(disabled),
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ disabled });
  } catch (error) {
    return errorResponse(error, "Unable to save estate modules.");
  }
}

function estateIdFor(context: SessionContext, requested: string | null) {
  if (context.role === "super_admin") {
    return (requested ?? "").trim();
  }
  return context.estateId;
}

async function readDisabledModules(estateId: string): Promise<string[]> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    return [];
  }

  const row = await appwriteRequest<EstateRow>(
    `/tablesdb/${config.databaseId}/tables/estates/rows/${estateId}`,
    { method: "GET", allowNotFound: true }
  );
  try {
    const parsed = JSON.parse(row?.disabledModules ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;
  return NextResponse.json({ error: message }, { status });
}
