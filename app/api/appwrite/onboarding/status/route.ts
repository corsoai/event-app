import { NextResponse } from "next/server";
import { appwriteOnboardingTableIds } from "@/lib/appwrite/schema";
import { appwriteRequest, getAppwriteServerConfig } from "@/lib/appwrite/server";

export async function GET() {
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
