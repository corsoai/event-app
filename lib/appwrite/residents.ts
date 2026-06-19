import type { Property, Resident, Unit } from "@/lib/types";
import {
  appwriteUpsertRow,
  appwriteRequest,
  getAppwriteServerConfig,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";

type AppwriteRowList<T> = {
  rows?: T[];
  documents?: T[];
  total?: number;
};

export type AppwriteEstateScope = {
  estateId?: string | null;
  includeAllEstates?: boolean;
};

type AppwritePropertyRow = {
  $id?: string;
  estateId?: string;
  propertyCode?: string;
  name?: string;
  description?: string;
  street?: string;
  legacyName?: string;
  status?: string;
};

type AppwriteUnitRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitCode?: string;
  label?: string;
  apartmentType?: string;
  status?: string;
  currentResidentId?: string;
  moveInDate?: string;
  legacyName?: string;
};

type AppwriteResidentRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  residentType?: string;
  status?: string;
  moveInDate?: string;
  legacyName?: string;
  legacyAddress?: string;
  sourceRow?: number;
  openingOutstanding?: number;
  expectedMonthly?: number;
  onboardingStatus?: string;
  reviewReasons?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AppwriteResidentUpdateInput = {
  residentId: string;
  name: string;
  propertyId?: string;
  unitId?: string;
  phone?: string;
  email?: string;
  type: Resident["type"];
  status: Resident["status"];
  moveInDate?: string;
  legacyName?: string;
  legacyAddress?: string;
  openingOutstanding?: number;
  expectedMonthly?: number;
  onboardingStatus?: string;
  reviewReasons?: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
};

export type AppwriteResidentDirectory = {
  properties: Property[];
  units: Unit[];
  residents: Resident[];
  total: {
    properties: number;
    units: number;
    residents: number;
  };
};

export async function listAppwriteResidentDirectory(
  options: { ensureSchema?: boolean } & AppwriteEstateScope = {}
): Promise<AppwriteResidentDirectory> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  if (options.ensureSchema) {
    await setupAppwriteOnboardingSchema();
  }

  const [propertyRows, unitRows, residentRows] = await Promise.all([
    listAppwriteTableRows<AppwritePropertyRow>("properties", options),
    listAppwriteTableRows<AppwriteUnitRow>("units", options),
    listAppwriteTableRows<AppwriteResidentRow>("residents", options)
  ]);

  const properties = propertyRows.map(mapPropertyRow);
  const units = unitRows.map(mapUnitRow);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  const residents = residentRows
    .map((row) => mapResidentRow(row, unitById.get(row.unitId ?? "")))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    properties: properties.sort((left, right) => left.propertyCode.localeCompare(right.propertyCode)),
    units: units.sort((left, right) => left.unitCode.localeCompare(right.unitCode)),
    residents,
    total: {
      properties: properties.length,
      units: units.length,
      residents: residents.length
    }
  };
}

export async function updateAppwriteResident(input: AppwriteResidentUpdateInput): Promise<Resident> {
  const residentId = input.residentId.trim();
  const fullName = input.name.trim();
  if (!residentId || !fullName) {
    throw new Error("Resident ID and full name are required.");
  }

  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  const existing = await appwriteRequest<AppwriteResidentRow>(
    `/tablesdb/${config.databaseId}/tables/residents/rows/${encodeURIComponent(residentId)}`,
    { method: "GET" }
  );
  assertEstateScope(existing.estateId, input);
  const units = await listAppwriteTableRows<AppwriteUnitRow>("units", input);
  const selectedUnit = units.find((unit) => unit.$id === (input.unitId ?? existing.unitId));
  const now = new Date().toISOString();

  const payload: AppwriteResidentRow = {
    estateId: existing.estateId ?? selectedUnit?.estateId ?? "",
    propertyId: input.propertyId ?? selectedUnit?.propertyId ?? existing.propertyId,
    unitId: input.unitId ?? existing.unitId,
    fullName,
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    residentType: input.type,
    status: appwriteResidentStatus(input.status),
    moveInDate: input.moveInDate?.trim() ?? "",
    legacyName: input.legacyName?.trim() ?? "",
    legacyAddress: input.legacyAddress?.trim() ?? "",
    sourceRow: existing.sourceRow,
    openingOutstanding: input.openingOutstanding ?? existing.openingOutstanding,
    expectedMonthly: input.expectedMonthly ?? existing.expectedMonthly,
    onboardingStatus: input.onboardingStatus ?? existing.onboardingStatus,
    reviewReasons: input.reviewReasons ?? existing.reviewReasons,
    createdAt: existing.createdAt,
    updatedAt: now
  };

  const row = await appwriteUpsertRow<AppwriteResidentRow>("residents", residentId, payload);
  return mapResidentRow(row, selectedUnit ? mapUnitRow(selectedUnit) : undefined);
}

export async function listAppwriteTableRows<T>(tableId: string, scope: AppwriteEstateScope = {}) {
  const config = getAppwriteServerConfig();
  const rows: T[] = [];
  let offset = 0;
  const limit = 100;
  const estateId = scopedEstateId(scope);

  while (true) {
    const payload = await listAppwriteRowsPage<T>(config.databaseId, tableId, limit, offset, estateId);
    const pageRows = payload.rows ?? payload.documents ?? [];
    rows.push(...filterRowsByEstate(pageRows, estateId));

    const total = payload.total ?? rows.length;
    if (!pageRows.length || rows.length >= total || pageRows.length < limit) {
      break;
    }

    offset += limit;
  }

  return rows;
}

async function listAppwriteRowsPage<T>(
  databaseId: string,
  tableId: string,
  limit: number,
  offset: number,
  estateId: string
) {
  const query = new URLSearchParams();
  let index = 0;
  if (estateId) {
    query.append(`queries[${index}]`, JSON.stringify({ method: "equal", attribute: "estateId", values: [estateId] }));
    index += 1;
  }
  query.append(`queries[${index}]`, JSON.stringify({ method: "limit", values: [limit] }));
  query.append(`queries[${index + 1}]`, JSON.stringify({ method: "offset", values: [offset] }));

  try {
    return await appwriteRequest<AppwriteRowList<T>>(
      `/tablesdb/${databaseId}/tables/${tableId}/rows?${query.toString()}`
    );
  } catch (error) {
    if (offset === 0 && error instanceof Error && error.message.toLowerCase().includes("invalid query")) {
      return appwriteRequest<AppwriteRowList<T>>(`/tablesdb/${databaseId}/tables/${tableId}/rows`);
    }

    throw error;
  }
}

function scopedEstateId(scope: AppwriteEstateScope) {
  if (scope.includeAllEstates) {
    return "";
  }

  return typeof scope.estateId === "string" ? scope.estateId.trim() : "";
}

function filterRowsByEstate<T>(rows: T[], estateId: string) {
  if (!estateId) {
    return rows;
  }

  return rows.filter((row) => String((row as { estateId?: unknown }).estateId ?? "") === estateId);
}

function assertEstateScope(rowEstateId: string | undefined, scope: AppwriteEstateScope) {
  const estateId = scopedEstateId(scope);
  if (estateId && rowEstateId !== estateId) {
    throw new Error("The selected resident does not belong to your estate.");
  }
}

function mapPropertyRow(row: AppwritePropertyRow): Property {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    propertyCode: row.propertyCode ?? row.$id ?? "",
    name: row.name ?? row.propertyCode ?? "Property",
    description: row.description ?? "",
    street: row.street ?? "",
    legacyName: optionalText(row.legacyName),
    status: row.status === "inactive" ? "inactive" : "active"
  };
}

function mapUnitRow(row: AppwriteUnitRow): Unit {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    propertyId: row.propertyId ?? "",
    unitCode: row.unitCode ?? row.$id ?? "",
    label: row.label ?? row.unitCode ?? "Unit",
    apartmentType: row.apartmentType ?? "Unit",
    status: mapUnitStatus(row.status),
    currentResidentId: optionalText(row.currentResidentId),
    moveInDate: optionalText(row.moveInDate),
    legacyName: optionalText(row.legacyName)
  };
}

function mapResidentRow(row: AppwriteResidentRow, unit?: Unit): Resident {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? unit?.estateId ?? "",
    propertyId: optionalText(row.propertyId) ?? unit?.propertyId,
    unitId: optionalText(row.unitId) ?? unit?.id,
    name: row.fullName ?? "Unnamed resident",
    houseNumber: unit?.unitCode ?? row.unitId ?? "Pending assignment",
    phone: row.phone ?? "",
    email: row.email ?? "",
    type: mapResidentType(row.residentType),
    status: mapResidentStatus(row.status),
    moveInDate: optionalText(row.moveInDate),
    legacyName: optionalText(row.legacyName),
    legacyAddress: optionalText(row.legacyAddress),
    openingOutstanding: numberOrUndefined(row.openingOutstanding),
    expectedMonthly: numberOrUndefined(row.expectedMonthly),
    onboardingStatus: optionalText(row.onboardingStatus),
    reviewReasons: optionalText(row.reviewReasons)
  };
}

function mapResidentType(value?: string): Resident["type"] {
  if (value === "owner" || value === "family member") {
    return value;
  }

  return "tenant";
}

function mapResidentStatus(value?: string): Resident["status"] {
  if (value === "inactive") {
    return "inactive";
  }

  if (value === "moved out" || value === "moved_out") {
    return "moved out";
  }

  return "active";
}

function appwriteResidentStatus(value: Resident["status"]) {
  return value === "moved out" ? "moved_out" : value;
}

function mapUnitStatus(value?: string): Unit["status"] {
  if (value === "occupied" || value === "moved out") {
    return value;
  }

  if (value === "moved_out") {
    return "moved out";
  }

  return "vacant";
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function numberOrUndefined(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}
