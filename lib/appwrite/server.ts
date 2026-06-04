import { createHash } from "crypto";
import {
  APPWRITE_ONBOARDING_DATABASE_ID,
  appwriteOnboardingTables,
  type AppwriteIndexDefinition,
  type AppwriteTableDefinition
} from "@/lib/appwrite/schema";

export const APPWRITE_LBSVIEW_ESTATE_ID = "lbsview-estate";

type AppwriteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type AppwriteRequestOptions = {
  method?: AppwriteMethod;
  body?: Record<string, unknown>;
  allowNotFound?: boolean;
  requireApiKey?: boolean;
};

type AppwriteServerConfig = {
  configured: boolean;
  missing: string[];
  endpoint: string;
  projectId: string;
  databaseId: string;
  apiKeyConfigured: boolean;
};

export type AppwriteSetupResult = {
  ok: boolean;
  missing: string[];
  endpoint: string;
  projectId: string;
  databaseId: string;
  database: "created" | "exists" | "skipped";
  tables: Array<{
    tableId: string;
    status: "created" | "exists" | "skipped";
    indexes: Array<{ key: string; status: "created" | "exists" | "skipped" }>;
  }>;
};

export class AppwriteRestError extends Error {
  status: number;
  code?: number;
  type?: string;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "AppwriteRestError";
    this.status = status;
    this.details = details;

    if (details && typeof details === "object") {
      const typed = details as { code?: number; type?: string };
      this.code = typed.code;
      this.type = typed.type;
    }
  }
}

export function getAppwriteServerConfig(): AppwriteServerConfig {
  const endpoint = normalizeEndpoint(
    process.env.APPWRITE_ENDPOINT ??
      process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
      "https://fra.cloud.appwrite.io/v1"
  );
  const projectId = (process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "").trim();
  const apiKey = getAppwriteApiKey();
  const databaseId = (process.env.APPWRITE_DATABASE_ID ?? APPWRITE_ONBOARDING_DATABASE_ID).trim();
  const missing = [
    projectId ? "" : "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    apiKey ? "" : "APPWRITE_API_KEY",
    databaseId ? "" : "APPWRITE_DATABASE_ID"
  ].filter(Boolean);

  return {
    configured: missing.length === 0,
    missing,
    endpoint,
    projectId,
    databaseId,
    apiKeyConfigured: Boolean(apiKey)
  };
}

export async function setupAppwriteOnboardingSchema(): Promise<AppwriteSetupResult> {
  const config = getAppwriteServerConfig();
  const result: AppwriteSetupResult = {
    ok: config.configured,
    missing: config.missing,
    endpoint: config.endpoint,
    projectId: config.projectId,
    databaseId: config.databaseId,
    database: "skipped",
    tables: appwriteOnboardingTables.map((table) => ({
      tableId: table.tableId,
      status: "skipped",
      indexes: (table.indexes ?? []).map((index) => ({ key: index.key, status: "skipped" }))
    }))
  };

  if (!config.configured) {
    return result;
  }

  const database = await appwriteRequest<unknown>(`/tablesdb/${config.databaseId}`, {
    method: "GET",
    allowNotFound: true
  });

  if (database) {
    result.database = "exists";
  } else {
    await appwriteRequest("/tablesdb", {
      method: "POST",
      body: {
        databaseId: config.databaseId,
        name: "LBS View Estate",
        enabled: true
      }
    });
    result.database = "created";
  }

  result.tables = [];
  for (const table of appwriteOnboardingTables) {
    result.tables.push(await ensureTable(config.databaseId, table));
  }

  return { ...result, ok: true };
}

export async function appwriteUpsertRow<T>(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<T> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return appwriteRequest<T>(
    `/tablesdb/${config.databaseId}/tables/${tableId}/rows/${rowId}`,
    {
      method: "PUT",
      body: {
        data: compactRecord(data),
        permissions: []
      }
    }
  );
}

export async function appwriteDeleteRow<T>(tableId: string, rowId: string): Promise<T> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return appwriteRequest<T>(`/tablesdb/${config.databaseId}/tables/${tableId}/rows/${rowId}`, {
    method: "DELETE"
  });
}

export function safeAppwriteId(prefix: string, seed: string) {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "row";
  const slug = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 14);
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 12);
  const value = [cleanPrefix, slug, hash].filter(Boolean).join("-");

  return value.slice(0, 36).replace(/[-_.]+$/g, "") || `${cleanPrefix}-${hash}`;
}

export function getAppwriteApiKey() {
  return (process.env.APPWRITE_API_KEY ?? process.env.APPWRITE_SERVER_API_KEY ?? "").trim();
}

async function ensureTable(databaseId: string, table: AppwriteTableDefinition) {
  const existingTable = await appwriteRequest<unknown>(`/tablesdb/${databaseId}/tables/${table.tableId}`, {
    method: "GET",
    allowNotFound: true
  });
  const tableStatus: "exists" | "created" = existingTable ? "exists" : "created";

  if (!existingTable) {
    await appwriteRequest(`/tablesdb/${databaseId}/tables`, {
      method: "POST",
      body: {
        tableId: table.tableId,
        name: table.name,
        permissions: [],
        rowSecurity: false,
        enabled: true,
        columns: table.columns.map((column) => ({
          ...column,
          array: column.array ?? false
        })),
        indexes: (table.indexes ?? []).map((index) => ({
          ...index,
          orders: index.orders ?? [],
          lengths: index.lengths ?? []
        }))
      }
    });
  }

  const indexes = [];
  if (existingTable) {
    for (const index of table.indexes ?? []) {
      indexes.push(await ensureIndex(databaseId, table.tableId, index));
    }
  } else {
    indexes.push(...(table.indexes ?? []).map((index) => ({ key: index.key, status: "created" as const })));
  }

  return {
    tableId: table.tableId,
    status: tableStatus,
    indexes
  };
}

async function ensureIndex(databaseId: string, tableId: string, index: AppwriteIndexDefinition) {
  const existingIndex = await appwriteRequest<unknown>(
    `/tablesdb/${databaseId}/tables/${tableId}/indexes/${index.key}`,
    {
      method: "GET",
      allowNotFound: true
    }
  );

  if (existingIndex) {
    return { key: index.key, status: "exists" as const };
  }

  await appwriteRequest(`/tablesdb/${databaseId}/tables/${tableId}/indexes`, {
    method: "POST",
    body: {
      key: index.key,
      type: index.type,
      columns: index.attributes,
      orders: index.orders ?? [],
      lengths: index.lengths ?? []
    }
  });

  return { key: index.key, status: "created" as const };
}

export async function appwriteRequest<T>(path: string, options: AppwriteRequestOptions = {}): Promise<T> {
  const config = getAppwriteServerConfig();
  const apiKey = getAppwriteApiKey();
  if (options.requireApiKey !== false && !config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  if (!config.projectId) {
    throw new Error("Appwrite server configuration is missing: NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  }

  const response = await fetch(`${config.endpoint}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": config.projectId,
      ...(options.requireApiKey === false ? {} : { "X-Appwrite-Key": apiKey }),
      "X-Appwrite-Response-Format": "1.9.5"
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  if (response.status === 404 && options.allowNotFound) {
    return null as T;
  }

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `Appwrite request failed with HTTP ${response.status}`;
    throw new AppwriteRestError(message, response.status, payload);
  }

  return payload as T;
}

function normalizeEndpoint(value: string) {
  const trimmed = value.trim().replace(/\/+$/g, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function compactRecord(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null)
  );
}
