import type { GuardCheckpoint, GuardPatrolEvent } from "@/lib/types";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteUpsertRow,
  safeAppwriteId,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

type AppwriteCheckpointRow = {
  $id?: string;
  estateId?: string;
  checkpointId?: string;
  checkpointCode?: string;
  checkpointName?: string;
  name?: string;
  gateName?: string;
  locationLabel?: string;
  qrToken?: string;
  latitude?: number;
  longitude?: number;
  allowedRadius?: number;
  status?: string;
  sortOrder?: number;
};

type AppwritePatrolRow = {
  $id?: string;
  estateId?: string;
  checkpointId?: string;
  checkpointCode?: string;
  checkpointName?: string;
  qrToken?: string;
  guardId?: string;
  guardProfileId?: string;
  guardName?: string;
  scanType?: string;
  scannedAt?: string;
  status?: string;
  deviceLatitude?: number;
  deviceLongitude?: number;
  checkpointLatitude?: number;
  checkpointLongitude?: number;
  allowedRadius?: number;
  distanceMeters?: number;
  isGpsVerified?: boolean;
  isOfflineLog?: boolean;
  deviceLabel?: string;
  note?: string;
};

export type PatrolCreateInput = {
  qrToken: string;
  guardId: string;
  guardName: string;
  deviceLatitude?: number;
  deviceLongitude?: number;
  scannedAt?: string;
  isOfflineLog?: boolean;
  deviceLabel?: string;
};

export type CheckpointCreateInput = {
  checkpointCode: string;
  checkpointName: string;
  gateName?: string;
  locationLabel?: string;
  qrToken: string;
  latitude?: number;
  longitude?: number;
  allowedRadius?: number;
  status?: GuardCheckpoint["status"];
};

export async function listGuardCheckpoints() {
  await setupAppwriteOnboardingSchema();
  const rows = await listAppwriteTableRows<AppwriteCheckpointRow>("guard_checkpoints");

  return rows
    .map(mapCheckpointRow)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.checkpointCode.localeCompare(right.checkpointCode));
}

export async function findGuardCheckpointByToken(qrToken: string) {
  const normalizedToken = normalizeCheckpointToken(qrToken);
  const checkpoints = await listGuardCheckpoints();

  return checkpoints.find((checkpoint) => checkpoint.qrToken === normalizedToken) ?? null;
}

export async function createGuardCheckpoint(input: CheckpointCreateInput) {
  await setupAppwriteOnboardingSchema();
  const now = new Date().toISOString();
  const checkpointCode = input.checkpointCode.trim().toUpperCase().replace(/\s+/g, "-");
  const checkpointName = input.checkpointName.trim();
  const qrToken = normalizeCheckpointToken(input.qrToken || checkpointCode);

  if (!checkpointCode || !checkpointName || !qrToken) {
    throw new Error("Checkpoint code, name, and QR token are required.");
  }

  const rowId = safeAppwriteId("checkpoint", qrToken);
  const payload = {
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    checkpointId: rowId,
    checkpointCode,
    checkpointName,
    name: checkpointName,
    gateName: input.gateName?.trim() ?? "",
    locationLabel: input.locationLabel?.trim() ?? "",
    qrToken,
    latitude: finiteNumber(input.latitude),
    longitude: finiteNumber(input.longitude),
    allowedRadius: Math.max(5, Math.round(finiteNumber(input.allowedRadius) ?? 25)),
    status: input.status ?? "active",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  };

  const row = await appwriteUpsertRow<AppwriteCheckpointRow>("guard_checkpoints", rowId, payload);
  return mapCheckpointRow(row);
}

export async function listGuardPatrolEvents(limit = 100) {
  await setupAppwriteOnboardingSchema();
  const rows = await listAppwriteTableRows<AppwritePatrolRow>("guard_patrol_events");

  return rows
    .map(mapPatrolRow)
    .sort((left, right) => right.scannedAt.localeCompare(left.scannedAt))
    .slice(0, limit);
}

export async function createGuardPatrolEvent(input: PatrolCreateInput) {
  await setupAppwriteOnboardingSchema();
  const qrToken = normalizeCheckpointToken(input.qrToken);
  const checkpoint = await findGuardCheckpointByToken(qrToken);
  const scannedAt = input.scannedAt || new Date().toISOString();
  const guardId = input.guardId.trim() || "unknown-guard";
  const guardName = input.guardName.trim() || "Security Guard";
  const deviceLatitude = finiteNumber(input.deviceLatitude);
  const deviceLongitude = finiteNumber(input.deviceLongitude);
  const hasDeviceLocation = deviceLatitude !== undefined && deviceLongitude !== undefined;
  const hasCheckpointLocation = checkpoint?.latitude !== undefined && checkpoint.longitude !== undefined;
  const distanceMeters = checkpoint && hasDeviceLocation && hasCheckpointLocation
    ? haversineMeters(deviceLatitude, deviceLongitude, checkpoint.latitude!, checkpoint.longitude!)
    : undefined;
  const allowedRadius = checkpoint?.allowedRadius ?? 25;
  const isGpsVerified = Boolean(distanceMeters !== undefined && distanceMeters <= allowedRadius);
  const status: GuardPatrolEvent["status"] = checkpoint
    ? isGpsVerified
      ? "verified"
      : "gps_violation"
    : "checkpoint_missing";
  const rowId = safeAppwriteId("patrol", `${guardId}:${qrToken}:${scannedAt}`);

  const row = await appwriteUpsertRow<AppwritePatrolRow>("guard_patrol_events", rowId, {
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    checkpointId: checkpoint?.id ?? safeAppwriteId("missing", qrToken),
    checkpointCode: checkpoint?.checkpointCode ?? qrToken,
    checkpointName: checkpoint?.checkpointName ?? "Unknown checkpoint",
    qrToken,
    guardId,
    guardProfileId: guardId,
    guardName,
    scanType: "checkpoint",
    scannedAt,
    status,
    deviceLatitude,
    deviceLongitude,
    checkpointLatitude: checkpoint?.latitude,
    checkpointLongitude: checkpoint?.longitude,
    allowedRadius,
    distanceMeters,
    isGpsVerified,
    isOfflineLog: Boolean(input.isOfflineLog),
    deviceLabel: input.deviceLabel?.trim() || "Mobile guard device",
    note: checkpoint
      ? isGpsVerified
        ? "Checkpoint scan verified."
        : "GPS distance is outside allowed checkpoint radius."
      : "Scanned checkpoint token did not match a configured checkpoint.",
    createdAt: scannedAt,
    updatedAt: new Date().toISOString()
  });

  return mapPatrolRow(row);
}

export function normalizeCheckpointToken(value: string) {
  return value.trim().replace(/^CP_/i, "").trim();
}

export function haversineMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);

  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function mapCheckpointRow(row: AppwriteCheckpointRow): GuardCheckpoint {
  const id = row.$id ?? row.checkpointId ?? safeAppwriteId("checkpoint", row.qrToken ?? row.checkpointCode ?? "checkpoint");
  const checkpointCode = row.checkpointCode ?? row.checkpointId ?? id;
  const checkpointName = row.checkpointName ?? row.name ?? checkpointCode;

  return {
    id,
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    checkpointId: row.checkpointId ?? id,
    checkpointCode,
    checkpointName,
    name: row.name ?? checkpointName,
    gateName: row.gateName ?? "",
    locationLabel: row.locationLabel ?? "",
    qrToken: normalizeCheckpointToken(row.qrToken ?? checkpointCode),
    latitude: finiteNumber(row.latitude),
    longitude: finiteNumber(row.longitude),
    allowedRadius: Math.max(5, Math.round(finiteNumber(row.allowedRadius) ?? 25)),
    status: row.status === "inactive" ? "inactive" : "active",
    sortOrder: row.sortOrder ?? 0
  };
}

function mapPatrolRow(row: AppwritePatrolRow): GuardPatrolEvent {
  const id = row.$id ?? safeAppwriteId("patrol", `${row.guardProfileId}:${row.qrToken}:${row.scannedAt}`);
  const status = mapPatrolStatus(row.status);

  return {
    id,
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    checkpointId: row.checkpointId ?? "",
    checkpointCode: row.checkpointCode ?? "",
    checkpointName: row.checkpointName ?? row.checkpointCode ?? "Checkpoint",
    qrToken: row.qrToken ?? "",
    guardId: row.guardId ?? row.guardProfileId ?? "",
    guardProfileId: row.guardProfileId ?? row.guardId ?? "",
    guardName: row.guardName ?? "Security Guard",
    scanType: "checkpoint",
    scannedAt: row.scannedAt ?? "",
    status,
    deviceLatitude: finiteNumber(row.deviceLatitude),
    deviceLongitude: finiteNumber(row.deviceLongitude),
    checkpointLatitude: finiteNumber(row.checkpointLatitude),
    checkpointLongitude: finiteNumber(row.checkpointLongitude),
    allowedRadius: finiteNumber(row.allowedRadius),
    distanceMeters: finiteNumber(row.distanceMeters),
    isGpsVerified: Boolean(row.isGpsVerified),
    isOfflineLog: Boolean(row.isOfflineLog),
    deviceLabel: row.deviceLabel ?? "",
    note: row.note ?? ""
  };
}

function mapPatrolStatus(value?: string): GuardPatrolEvent["status"] {
  if (value === "verified" || value === "gps_violation" || value === "offline_pending" || value === "checkpoint_missing") {
    return value;
  }

  return "gps_violation";
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
