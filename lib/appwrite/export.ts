import { appwriteOnboardingTables } from "@/lib/appwrite/schema";
import { listAppwriteResidentDirectory, listAppwriteTableRows } from "@/lib/appwrite/residents";

type AppwriteGenericRow = Record<string, unknown> & {
  $id?: string;
};

export async function buildResidentsCsvExport() {
  const directory = await listAppwriteResidentDirectory();
  const unitById = new Map(directory.units.map((unit) => [unit.id, unit]));
  const propertyById = new Map(directory.properties.map((property) => [property.id, property]));
  const rows = directory.residents.map((resident) => {
    const unit = resident.unitId ? unitById.get(resident.unitId) : undefined;
    const property = resident.propertyId ? propertyById.get(resident.propertyId) : undefined;

    return {
      residentId: resident.id,
      fullName: resident.name,
      phone: resident.phone,
      email: resident.email,
      residentType: resident.type,
      status: resident.status,
      propertyId: resident.propertyId ?? "",
      propertyCode: property?.propertyCode ?? "",
      propertyName: property?.name ?? "",
      unitId: resident.unitId ?? "",
      unitCode: unit?.unitCode ?? resident.houseNumber,
      apartmentType: unit?.apartmentType ?? "",
      openingOutstanding: resident.openingOutstanding ?? 0,
      expectedMonthly: resident.expectedMonthly ?? 0,
      moveInDate: resident.moveInDate ?? "",
      legacyName: resident.legacyName ?? "",
      legacyAddress: resident.legacyAddress ?? ""
    };
  });

  return toCsv(rows);
}

export async function buildAllTablesCsvExport() {
  const schemaKeys = appwriteOnboardingTables.flatMap((table) => table.columns.map((column) => column.key));
  const orderedKeys = unique(["tableId", "rowId", "createdAt", "updatedAt", "estateId", ...schemaKeys]);
  const rows: AppwriteGenericRow[] = [];

  for (const table of appwriteOnboardingTables) {
    const tableRows = await listAppwriteTableRows<AppwriteGenericRow>(table.tableId);
    for (const row of tableRows) {
      rows.push({
        tableId: table.tableId,
        rowId: row.$id ?? "",
        ...row
      });
    }
  }

  return toCsv(rows, orderedKeys);
}

export function csvFilename(scope: "residents" | "all") {
  const date = new Date().toISOString().slice(0, 10);
  return scope === "residents"
    ? `corso-residents-${date}.csv`
    : `corso-appwrite-all-data-${date}.csv`;
}

function toCsv(rows: Array<Record<string, unknown>>, preferredKeys?: string[]) {
  const keys = preferredKeys?.length ? preferredKeys : unique(rows.flatMap((row) => Object.keys(row)));
  const lines = [
    keys.map(csvCell).join(","),
    ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(","))
  ];

  return `${lines.join("\r\n")}\r\n`;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
