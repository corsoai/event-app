import { NextRequest, NextResponse } from "next/server";
import { appwriteOnboardingTableIds } from "@/lib/appwrite/schema";
import { appwriteRequest, AppwriteRestError, getAppwriteServerConfig } from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

type HealthStatus = "ok" | "warn" | "fail";

type HealthCheck = {
  name: string;
  status: HealthStatus;
  message: string;
};

export async function GET(request: NextRequest) {
  let context: SessionContext;
  try {
    context = await resolveSessionContext(request, { allowedRoles: adminRoles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin access is required." },
      { status: error instanceof SessionContextError ? error.status : 403 }
    );
  }

  const config = getAppwriteServerConfig();
  const estateScope = estateScopeFor(context);
  const checks: HealthCheck[] = [
    {
      name: "Server configuration",
      status: config.configured ? "ok" : "fail",
      message: config.configured
        ? "Required Appwrite server variables are present."
        : `Missing ${config.missing.join(", ")}.`
    },
    {
      name: "API key",
      status: config.apiKeyConfigured ? "ok" : "fail",
      message: config.apiKeyConfigured
        ? "Server API key is configured without exposing the key value."
        : "CORSO_APPWRITE_API_KEY is not set."
    }
  ];

  let liveTableIds: string[] = [];
  let rowCounts: Record<string, number> = {};

  if (config.configured) {
    const database = await appwriteRequest<unknown>(`/tablesdb/${config.databaseId}`, {
      method: "GET",
      allowNotFound: true
    }).catch((error) => error);

    if (database instanceof Error) {
      checks.push({
        name: "Database access",
        status: "fail",
        message: describeAppwriteError(database, "Appwrite database request failed.")
      });
    } else if (!database) {
      checks.push({
        name: "Database access",
        status: "fail",
        message: `Database ${config.databaseId} was not found.`
      });
    } else {
      checks.push({
        name: "Database access",
        status: "ok",
        message: `Database ${config.databaseId} is reachable.`
      });

      const tableResults = await Promise.all(
        appwriteOnboardingTableIds.map(async (tableId) => {
          const table = await appwriteRequest<unknown>(
            `/tablesdb/${config.databaseId}/tables/${tableId}`,
            { method: "GET", allowNotFound: true }
          ).catch(() => null);

          return table ? tableId : "";
        })
      );
      liveTableIds = tableResults.filter(Boolean);

      const countResults = await Promise.all(
        ["properties", "units", "residents", "profiles", "visitors", "payments", "guard_checkpoints", "guard_patrol_events"].map(async (tableId) => {
          if (!liveTableIds.includes(tableId)) {
            return [tableId, 0] as const;
          }

          const rows = await listAppwriteTableRows<Record<string, unknown>>(tableId, estateScope).catch(() => []);
          return [tableId, rows.length] as const;
        })
      );
      rowCounts = Object.fromEntries(countResults);

      const missingTables = appwriteOnboardingTableIds.filter((tableId) => !liveTableIds.includes(tableId));
      checks.push({
        name: "Expected tables",
        status: missingTables.length ? "fail" : "ok",
        message: missingTables.length
          ? `Missing ${missingTables.length} table(s): ${missingTables.join(", ")}.`
          : `${liveTableIds.length} expected Appwrite tables are present.`
      });

      checks.push({
        name: "Resident import",
        status: rowCounts.residents > 0 ? "ok" : "warn",
        message: rowCounts.residents > 0
          ? `${rowCounts.residents} resident row(s), ${rowCounts.units ?? 0} unit row(s), and ${rowCounts.properties ?? 0} property row(s) are available.`
          : "No imported Appwrite residents were found yet."
      });
    }
  }

  const status: HealthStatus = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warn")
      ? "warn"
      : "ok";

  return NextResponse.json({
    status,
    checkedAt: new Date().toISOString(),
    config: {
      endpoint: config.endpoint,
      projectId: maskValue(config.projectId),
      databaseId: config.databaseId,
      apiKeyConfigured: config.apiKeyConfigured
    },
    checks,
    tables: {
      expected: appwriteOnboardingTableIds.length,
      live: liveTableIds.length,
      missing: appwriteOnboardingTableIds.filter((tableId) => !liveTableIds.includes(tableId))
    },
    rowCounts
  });
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}

function describeAppwriteError(error: Error, fallback: string) {
  if (error instanceof AppwriteRestError) {
    return `${error.message} (HTTP ${error.status})`;
  }

  return error.message || fallback;
}

function maskValue(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "configured";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
