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
  sessionSecret?: string;
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
    columns?: Array<{ key: string; status: "created" | "exists" | "skipped" }>;
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

let appwriteSetupPromise: Promise<AppwriteSetupResult> | null = null;

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
    apiKey ? "" : "CORSO_APPWRITE_API_KEY",
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
  if (!appwriteSetupPromise) {
    appwriteSetupPromise = setupAppwriteOnboardingSchemaUncached().catch((error) => {
      appwriteSetupPromise = null;
      throw error;
    });
  }

  return appwriteSetupPromise;
}

let appwriteSchemaReadyPromise: Promise<void> | null = null;

/**
 * Cheap request-path guard for hot API routes. The full
 * setupAppwriteOnboardingSchema verifies all tables/columns/indexes (dozens of
 * REST round-trips) and belongs in the explicit setup flow, not on every
 * request. This checks once per server instance that the database exists and
 * only falls back to the full setup on a fresh environment.
 */
export async function ensureAppwriteSchemaReady(): Promise<void> {
  if (!appwriteSchemaReadyPromise) {
    appwriteSchemaReadyPromise = (async () => {
      const config = getAppwriteServerConfig();
      if (!config.configured) {
        return;
      }

      const database = await appwriteRequest<unknown>(`/tablesdb/${config.databaseId}`, {
        method: "GET",
        allowNotFound: true
      });

      if (!database) {
        await setupAppwriteOnboardingSchema();
      }
    })().catch((error) => {
      appwriteSchemaReadyPromise = null;
      throw error;
    });
  }

  return appwriteSchemaReadyPromise;
}

const appwriteTargetedEnsurePromises = new Map<string, Promise<void>>();

/**
 * Targeted provisioning for tables added AFTER an environment's database was
 * first bootstrapped. The full setupAppwriteOnboardingSchema sweep walks ~30
 * estate-era tables (dozens of REST round-trips) before ever reaching newer
 * tables at the end of the list — on a serverless cold start that exceeds the
 * function time limit, so the new tables were never created (found live on
 * 2026-07-21: events/guests/checkins missing from eventng_db). This ensures
 * ONLY the named tables: ~2 quick calls per already-existing table, real
 * creation (including missing columns on existing tables) when absent.
 * Memoized per instance; the memo clears on failure so the next request
 * retries. Falls back to the full setup only when the database itself is
 * missing (brand-new environment).
 */
export async function ensureAppwriteTablesExist(tableIds: string[]): Promise<void> {
  const memoKey = tableIds.join(",");
  const cached = appwriteTargetedEnsurePromises.get(memoKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const config = getAppwriteServerConfig();
    if (!config.configured) {
      return;
    }

    const database = await appwriteRequest<unknown>(`/tablesdb/${config.databaseId}`, {
      method: "GET",
      allowNotFound: true
    });

    if (!database) {
      await setupAppwriteOnboardingSchema();
      return;
    }

    for (const tableId of tableIds) {
      const table = appwriteOnboardingTables.find((definition) => definition.tableId === tableId);
      if (!table) {
        throw new Error(`Unknown Appwrite table definition: ${tableId}`);
      }
      validateTableDefinition(table);
      await ensureTable(config.databaseId, table);
    }
  })().catch((error) => {
    appwriteTargetedEnsurePromises.delete(memoKey);
    throw error;
  });

  appwriteTargetedEnsurePromises.set(memoKey, promise);
  return promise;
}

async function setupAppwriteOnboardingSchemaUncached(): Promise<AppwriteSetupResult> {
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
      columns: table.columns.map((column) => ({ key: column.key, status: "skipped" })),
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
    validateTableDefinition(table);
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

  const existingRow = await appwriteRequest<unknown>(
    `/tablesdb/${config.databaseId}/tables/${tableId}/rows/${rowId}`,
    {
      method: "GET",
      allowNotFound: true
    }
  );
  const payload = {
    data: compactRecord(data),
    permissions: []
  };

  if (existingRow) {
    return appwriteRequest<T>(
      `/tablesdb/${config.databaseId}/tables/${tableId}/rows/${rowId}`,
      {
        method: "PATCH",
        body: payload
      }
    );
  }

  try {
    return await appwriteRequest<T>(
      `/tablesdb/${config.databaseId}/tables/${tableId}/rows`,
      {
        method: "POST",
        body: {
          rowId,
          ...payload
        }
      }
    );
  } catch (error) {
    // The existence check above can miss (e.g. a stale/cached 404 from the API
    // proxy). If the create collides with an existing row, update it instead so
    // the upsert stays idempotent.
    if (error instanceof AppwriteRestError && error.status === 409) {
      return appwriteRequest<T>(
        `/tablesdb/${config.databaseId}/tables/${tableId}/rows/${rowId}`,
        {
          method: "PATCH",
          body: payload
        }
      );
    }
    throw error;
  }
}

/**
 * Insert a brand-new row without the exists-check round trip that
 * appwriteUpsertRow performs. Falls back to an update if the ID already
 * exists, so retries stay safe.
 */
export async function appwriteInsertRow<T>(
  tableId: string,
  rowId: string,
  data: Record<string, unknown>
): Promise<T> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  const payload = {
    data: compactRecord(data),
    permissions: []
  };

  try {
    return await appwriteRequest<T>(
      `/tablesdb/${config.databaseId}/tables/${tableId}/rows`,
      {
        method: "POST",
        body: {
          rowId,
          ...payload
        }
      }
    );
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 409) {
      return appwriteRequest<T>(
        `/tablesdb/${config.databaseId}/tables/${tableId}/rows/${rowId}`,
        {
          method: "PATCH",
          body: payload
        }
      );
    }
    throw error;
  }
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
  return (
    process.env.CORSO_APPWRITE_API_KEY ??
    process.env.APPWRITE_RUNTIME_API_KEY ??
    process.env.APPWRITE_SERVER_API_KEY ??
    process.env.APPWRITE_API_KEY ??
    ""
  ).trim();
}

async function ensureTable(databaseId: string, table: AppwriteTableDefinition) {
  const existingTable = await appwriteRequest<unknown>(`/tablesdb/${databaseId}/tables/${table.tableId}`, {
    method: "GET",
    allowNotFound: true
  });
  const tableStatus: "exists" | "created" = existingTable ? "exists" : "created";

  let columns: Array<{ key: string; status: "created" | "exists" }> = [];

  if (!existingTable) {
    await appwriteRequest(`/tablesdb/${databaseId}/tables`, {
      method: "POST",
      body: {
        tableId: table.tableId,
        name: table.name,
        permissions: [],
        rowSecurity: false,
        enabled: true,
        columns: table.columns.map(buildColumnPayload)
      }
    });
    columns = table.columns.map((column) => ({ key: column.key, status: "created" as const }));
  } else {
    columns = await ensureMissingColumns(databaseId, table);
  }

  const indexes = [];
  for (const index of table.indexes ?? []) {
    indexes.push(await ensureIndex(databaseId, table.tableId, index));
  }

  return {
    tableId: table.tableId,
    status: tableStatus,
    columns,
    indexes
  };
}

async function ensureMissingColumns(databaseId: string, table: AppwriteTableDefinition) {
  const columns = [];

  for (const column of table.columns) {
    const existingColumn = await appwriteRequest<unknown>(
      `/tablesdb/${databaseId}/tables/${table.tableId}/columns/${column.key}`,
      {
        method: "GET",
        allowNotFound: true
      }
    );

    if (existingColumn) {
      columns.push({ key: column.key, status: "exists" as const });
      continue;
    }

    await appwriteRequest(`/tablesdb/${databaseId}/tables/${table.tableId}/columns/${columnCreateType(column)}`, {
      method: "POST",
      body: buildColumnCreatePayload(column)
    });
    columns.push({ key: column.key, status: "created" as const });
  }

  return columns;
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
    if (isFailedIndex(existingIndex)) {
      await appwriteRequest(`/tablesdb/${databaseId}/tables/${tableId}/indexes/${index.key}`, {
        method: "DELETE",
        allowNotFound: true
      });
    } else {
      return { key: index.key, status: "exists" as const };
    }
  }

  await appwriteRequest(`/tablesdb/${databaseId}/tables/${tableId}/indexes`, {
    method: "POST",
    body: buildIndexPayload(index)
  });

  return { key: index.key, status: "created" as const };
}

export async function appwriteRequest<T>(path: string, options: AppwriteRequestOptions = {}): Promise<T> {
  const config = getAppwriteServerConfig();
  const apiKey = getAppwriteApiKey();
  assertValidAppwriteApiKey(apiKey);
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
      ...(options.sessionSecret ? { "X-Appwrite-Session": options.sessionSecret } : {}),
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
    const baseMessage = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `Appwrite request failed with HTTP ${response.status}`;
    const message = `${baseMessage} (${options.method ?? "GET"} ${path})`;
    throw new AppwriteRestError(message, response.status, payload);
  }

  return payload as T;
}

function normalizeEndpoint(value: string) {
  const trimmed = value.trim().replace(/\/+$/g, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function assertValidAppwriteApiKey(value: string) {
  if (!value) {
    return;
  }

  const hasNonAscii = [...value].some((char) => char.charCodeAt(0) > 127);
  const looksLikeCopiedLabel = /\b(API secret|Verify|Copy API key|Appwrite)\b/i.test(value);

  if (hasNonAscii || looksLikeCopiedLabel) {
    throw new Error(
      "Appwrite API key is not a valid key value. Create a fresh API key and copy the one-time 'Copy API key' value into CORSO_APPWRITE_API_KEY."
    );
  }
}

function normalizeIndexOrders(index: AppwriteIndexDefinition) {
  return index.orders?.length ? index.orders : index.attributes.map(() => "ASC" as const);
}

function buildIndexPayload(index: AppwriteIndexDefinition) {
  return {
    key: index.key,
    type: index.type,
    columns: index.attributes,
    orders: normalizeIndexOrders(index),
    ...(index.lengths?.length ? { lengths: index.lengths } : {})
  };
}

function buildColumnPayload(column: AppwriteTableDefinition["columns"][number]) {
  return {
    ...column,
    type: column.type === "float" ? "double" : column.type,
    array: column.array ?? false
  };
}

function buildColumnCreatePayload(column: AppwriteTableDefinition["columns"][number]) {
  const { type: _type, ...payload } = buildColumnPayload(column);
  return payload;
}

function columnCreateType(column: AppwriteTableDefinition["columns"][number]) {
  return column.type;
}

function isFailedIndex(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    "status" in value &&
    String((value as { status?: unknown }).status).toLowerCase() === "failed"
  );
}

function validateTableDefinition(table: AppwriteTableDefinition) {
  const columnKeys = new Set(table.columns.map((column) => column.key));

  for (const index of table.indexes ?? []) {
    const missingColumns = index.attributes.filter((attribute) => !columnKeys.has(attribute));
    if (missingColumns.length) {
      throw new Error(`${table.tableId}.${index.key} indexes missing columns: ${missingColumns.join(", ")}`);
    }

    if (index.orders?.length && index.orders.length !== index.attributes.length) {
      throw new Error(`${table.tableId}.${index.key} orders length must match indexed columns.`);
    }

    if (index.lengths?.length && index.lengths.length !== index.attributes.length) {
      throw new Error(`${table.tableId}.${index.key} lengths length must match indexed columns.`);
    }
  }
}

function compactRecord(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null)
  );
}
