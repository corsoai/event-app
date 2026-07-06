import type { VehicleLog } from "@/lib/types";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteUpsertRow,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";

const VEHICLE_LOGS_TABLE = "vehicle_logs";

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function finiteNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

type AppwriteVehicleLogRow = {
  $id?: string;
  estateId?: string;
  plate?: string;
  vehicleClass?: string;
  direction?: string;
  postLabel?: string;
  guardId?: string;
  guardName?: string;
  scannedAt?: string;
  visitorId?: string;
  visitorCode?: string;
  residentId?: string;
  knownVehicleId?: string;
  matchStatus?: string;
  region?: string;
  score?: number;
  rawRead?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type VehicleLogSaveInput = {
  plate: string;
  vehicleClass?: string;
  direction?: VehicleLog["direction"];
  postLabel?: string;
  guardId?: string;
  guardName?: string;
  scannedAt?: string;
  visitorId?: string;
  visitorCode?: string;
  residentId?: string;
  knownVehicleId?: string;
  matchStatus?: string;
  region?: string;
  score?: number;
  rawRead?: string;
  note?: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
};

function mapVehicleLogRow(row: AppwriteVehicleLogRow): VehicleLog {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    plate: text(row.plate),
    vehicleClass: text(row.vehicleClass),
    direction: row.direction === "out" ? "out" : "in",
    postLabel: text(row.postLabel),
    guardId: text(row.guardId),
    guardName: text(row.guardName),
    scannedAt: text(row.scannedAt),
    visitorId: text(row.visitorId),
    visitorCode: text(row.visitorCode),
    residentId: text(row.residentId),
    knownVehicleId: text(row.knownVehicleId),
    matchStatus: text(row.matchStatus) || "unknown",
    region: text(row.region),
    score: finiteNumber(row.score),
    rawRead: text(row.rawRead),
    note: text(row.note),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt)
  };
}

export async function listVehicleLogs(limit = 100, scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteVehicleLogRow>(VEHICLE_LOGS_TABLE, scope);
  return rows
    .map(mapVehicleLogRow)
    .sort((left, right) => (right.scannedAt || right.createdAt || "").localeCompare(left.scannedAt || left.createdAt || ""))
    .slice(0, limit);
}

export async function saveVehicleLog(input: VehicleLogSaveInput) {
  const plate = input.plate.trim().toUpperCase();
  if (!plate) {
    throw new Error("Plate is required.");
  }

  const estateId = input.includeAllEstates ? APPWRITE_LBSVIEW_ESTATE_ID : input.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID;
  const now = new Date().toISOString();
  const scannedAt = input.scannedAt?.trim() || now;
  const rowId = safeAppwriteId("vehlog", `${plate}-${scannedAt}`);

  const payload = {
    estateId,
    plate,
    vehicleClass: input.vehicleClass?.trim() ?? "",
    direction: input.direction === "out" ? "out" : "in",
    postLabel: input.postLabel?.trim() ?? "",
    guardId: input.guardId?.trim() ?? "",
    guardName: input.guardName?.trim() ?? "",
    scannedAt,
    visitorId: input.visitorId?.trim() ?? "",
    visitorCode: input.visitorCode?.trim() ?? "",
    residentId: input.residentId?.trim() ?? "",
    knownVehicleId: input.knownVehicleId?.trim() ?? "",
    matchStatus: input.matchStatus?.trim() ?? "unknown",
    region: input.region?.trim() ?? "",
    score: finiteNumber(input.score),
    rawRead: input.rawRead?.trim() ?? "",
    note: input.note?.trim() ?? "",
    createdAt: now,
    updatedAt: now
  };

  const row = await appwriteUpsertRow<AppwriteVehicleLogRow>(VEHICLE_LOGS_TABLE, rowId, payload);
  return mapVehicleLogRow(row);
}
