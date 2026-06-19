import { NextRequest, NextResponse } from "next/server";
import { appwriteOnboardingTableIds } from "@/lib/appwrite/schema";
import { appwriteRequest, getAppwriteServerConfig } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

export async function GET(request: NextRequest) {
  try {
    await resolveSessionContext(request, {
      allowedRoles: ["super_admin"],
      requireEstate: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Super admin access is required.";
    const status = error instanceof SessionContextError ? error.status : 403;
    return NextResponse.json({ error: message }, { status });
  }

  const config = getAppwriteServerConfig();
  const tableIds = await getLiveTableIds();

  return NextResponse.json({
    configured: config.configured,
    missing: config.missing,
    endpoint: config.endpoint,
    projectId: config.projectId,
    databaseId: config.databaseId,
    apiKeyConfigured: config.apiKeyConfigured,
    tableIds
  });
}

async function getLiveTableIds() {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    return [];
  }

  const database = await appwriteRequest<unknown>(`/tablesdb/${config.databaseId}`, {
    method: "GET",
    allowNotFound: true
  }).catch(() => null);
  if (!database) {
    return [];
  }

  const tableChecks = await Promise.all(
    appwriteOnboardingTableIds.map(async (tableId) => {
      const table = await appwriteRequest<unknown>(`/tablesdb/${config.databaseId}/tables/${tableId}`, {
        method: "GET",
        allowNotFound: true
      }).catch(() => null);

      return table ? tableId : "";
    })
  );

  return tableChecks.filter(Boolean);
}
