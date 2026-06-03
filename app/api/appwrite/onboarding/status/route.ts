import { NextResponse } from "next/server";
import { appwriteOnboardingTableIds } from "@/lib/appwrite/schema";
import { getAppwriteServerConfig } from "@/lib/appwrite/server";

export async function GET() {
  const config = getAppwriteServerConfig();

  return NextResponse.json({
    configured: config.configured,
    missing: config.missing,
    endpoint: config.endpoint,
    projectId: config.projectId,
    databaseId: config.databaseId,
    apiKeyConfigured: config.apiKeyConfigured,
    tableIds: appwriteOnboardingTableIds
  });
}
