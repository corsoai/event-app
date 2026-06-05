import type { Property, Resident, Unit } from "@/lib/types";
import {
  appwriteRequest,
  getAppwriteServerConfig,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";

type AppwriteRowList<T> = {
  rows?: T[];
  documents?: T[];
  total?: number;
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

export async function listAppwriteResidentDirectory(): Promise<AppwriteResidentDirectory> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  await setupAppwriteOnboardingSchema();

  const [propertyRows, unitRows, residentRows] = await Promise.all([
    listAppwriteRows<AppwritePropertyRow>("properties"),
    listAppwriteRows<AppwriteUnitRow>("units"),
    listAppwriteRows<AppwriteResidentRow>("residents")
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

async function listAppwriteRows<T>(tableId: string) {
  const config = getAppwriteServerConfig();
  const rows: T[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const payload = await listAppwriteRowsPage<T>(config.databaseId, tableId, limit, offset);
    const pageRows = payload.rows ?? payload.documents ?? [];
    rows.push(...pageRows);

    const total = payload.total ?? rows.length;
    if (!pageRows.length || rows.length >= total || pageRows.length < limit) {
      break;
    }

    offset += limit;
  }

  return rows;
}

async function listAppwriteRowsPage<T>(databaseId: string, tableId: string, limit: number, offset: number) {
  const query = new URLSearchParams();
  query.append("queries[0]", JSON.stringify({ method: "limit", values: [limit] }));
  query.append("queries[1]", JSON.stringify({ method: "offset", values: [offset] }));

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
    legacyAddress: optionalText(row.legacyAddress)
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
