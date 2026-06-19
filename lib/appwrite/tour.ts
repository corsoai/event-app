import type { CsoReview, GuardCheckpoint, GuardPatrolEvent, SecurityIncident } from "@/lib/types";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteUpsertRow,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";

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

type AppwriteSecurityIncidentRow = {
  $id?: string;
  estateId?: string;
  incidentType?: string;
  alertType?: string;
  severity?: string;
  status?: string;
  reportedByRole?: string;
  reportedByProfileId?: string;
  assignedToProfileId?: string;
  residentName?: string;
  unitCode?: string;
  locationLabel?: string;
  summary?: string;
  details?: string;
  openedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  respondingAt?: string;
  resolvedAt?: string;
};

type AppwriteCsoReviewRow = {
  $id?: string;
  estateId?: string;
  incidentId?: string;
  csoProfileId?: string;
  decision?: string;
  note?: string;
  reviewedAt?: string;
  followUpDate?: string;
  status?: string;
};

export type PatrolCreateInput = {
  qrToken: string;
  guardId: string;
  guardName: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
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
  estateId?: string | null;
  includeAllEstates?: boolean;
};

export type CheckpointRenameInput = {
  checkpointId: string;
  checkpointName: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
};

export async function listGuardCheckpoints(scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteCheckpointRow>("guard_checkpoints", scope);

  return rows
    .map(mapCheckpointRow)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.checkpointCode.localeCompare(right.checkpointCode));
}

export async function findGuardCheckpointByToken(qrToken: string, scope: AppwriteEstateScope = {}) {
  const normalizedToken = normalizeCheckpointToken(qrToken);
  const checkpoints = await listGuardCheckpoints(scope);

  return checkpoints.find((checkpoint) => normalizeCheckpointToken(checkpoint.qrToken) === normalizedToken) ?? null;
}

export async function createGuardCheckpoint(input: CheckpointCreateInput) {
  const now = new Date().toISOString();
  const checkpointName = input.checkpointName.trim();
  const qrToken = ensureCheckpointQrToken(input.qrToken || input.checkpointCode || checkpointName);
  const checkpointCode = (input.checkpointCode || normalizeCheckpointToken(qrToken))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");

  if (!checkpointCode || !checkpointName || !qrToken) {
    throw new Error("Checkpoint code, name, and QR token are required.");
  }

  const rowId = safeAppwriteId("checkpoint", qrToken);
  const estateId = input.includeAllEstates ? APPWRITE_LBSVIEW_ESTATE_ID : input.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID;
  const payload = {
    estateId,
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

export async function renameGuardCheckpoint(input: CheckpointRenameInput) {
  const checkpointName = input.checkpointName.trim();
  if (!input.checkpointId || !checkpointName) {
    throw new Error("Checkpoint ID and new name are required.");
  }

  const checkpoints = await listGuardCheckpoints(input);
  const checkpoint = checkpoints.find((item) => item.id === input.checkpointId || item.checkpointId === input.checkpointId);
  if (!checkpoint) {
    throw new Error("Checkpoint was not found.");
  }

  const row = await appwriteUpsertRow<AppwriteCheckpointRow>("guard_checkpoints", checkpoint.id, {
    estateId: checkpoint.estateId,
    checkpointId: checkpoint.checkpointId || checkpoint.id,
    checkpointCode: checkpoint.checkpointCode,
    checkpointName,
    name: checkpointName,
    gateName: checkpoint.gateName,
    locationLabel: checkpoint.locationLabel,
    qrToken: checkpoint.qrToken,
    latitude: checkpoint.latitude,
    longitude: checkpoint.longitude,
    allowedRadius: checkpoint.allowedRadius,
    status: checkpoint.status,
    sortOrder: checkpoint.sortOrder ?? 0,
    updatedAt: new Date().toISOString()
  });

  return mapCheckpointRow(row);
}

export async function listGuardPatrolEvents(limit = 100, scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwritePatrolRow>("guard_patrol_events", scope);

  return rows
    .map(mapPatrolRow)
    .sort((left, right) => right.scannedAt.localeCompare(left.scannedAt))
    .slice(0, limit);
}

export async function createGuardPatrolEvent(input: PatrolCreateInput) {
  const qrToken = ensureCheckpointQrToken(input.qrToken);
  const checkpoint = await findGuardCheckpointByToken(qrToken, input);
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
    estateId: checkpoint?.estateId ?? input.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    checkpointId: checkpoint?.id ?? safeAppwriteId("missing", qrToken),
    checkpointCode: checkpoint?.checkpointCode ?? qrToken,
    checkpointName: checkpoint?.checkpointName ?? "Unknown checkpoint",
    qrToken: checkpoint?.qrToken ?? qrToken,
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

export async function listSecurityIncidents(limit = 100, scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteSecurityIncidentRow>("security_incidents", scope);

  return rows
    .map(mapSecurityIncidentRow)
    .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
    .slice(0, limit);
}

export async function listCsoReviews(limit = 100, scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteCsoReviewRow>("cso_reviews", scope);

  return rows
    .map(mapCsoReviewRow)
    .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt))
    .slice(0, limit);
}

export function normalizeCheckpointToken(value: string) {
  return value.trim().replace(/^CP_/i, "").trim();
}

export function ensureCheckpointQrToken(value: string) {
  const normalized = normalizeCheckpointToken(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);

  return normalized ? `CP_${normalized}` : "";
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
    qrToken: ensureCheckpointQrToken(row.qrToken ?? checkpointCode),
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

function mapSecurityIncidentRow(row: AppwriteSecurityIncidentRow): SecurityIncident {
  return {
    id: row.$id ?? safeAppwriteId("incident", `${row.summary}:${row.openedAt}`),
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    incidentType: row.incidentType ?? "security",
    alertType: mapIncidentAlertType(row.alertType),
    severity: mapIncidentSeverity(row.severity),
    status: mapIncidentStatus(row.status),
    reportedByRole: row.reportedByRole ?? "security_guard",
    reportedByProfileId: optionalText(row.reportedByProfileId),
    assignedToProfileId: optionalText(row.assignedToProfileId),
    residentName: optionalText(row.residentName),
    unitCode: optionalText(row.unitCode),
    locationLabel: optionalText(row.locationLabel),
    summary: row.summary ?? "Security incident",
    details: optionalText(row.details),
    openedAt: row.openedAt ?? "",
    acknowledgedAt: optionalText(row.acknowledgedAt),
    acknowledgedBy: optionalText(row.acknowledgedBy),
    respondingAt: optionalText(row.respondingAt),
    resolvedAt: optionalText(row.resolvedAt)
  };
}

function mapCsoReviewRow(row: AppwriteCsoReviewRow): CsoReview {
  return {
    id: row.$id ?? safeAppwriteId("review", `${row.incidentId}:${row.reviewedAt}`),
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    incidentId: row.incidentId ?? "",
    csoProfileId: row.csoProfileId ?? "",
    decision: row.decision ?? "pending",
    note: optionalText(row.note),
    reviewedAt: row.reviewedAt ?? "",
    followUpDate: optionalText(row.followUpDate),
    status: mapCsoReviewStatus(row.status)
  };
}

function mapIncidentSeverity(value?: string): SecurityIncident["severity"] {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  return "medium";
}

function mapIncidentStatus(value?: string): SecurityIncident["status"] {
  if (value === "acknowledged" || value === "responding" || value === "resolved" || value === "false_alarm" || value === "closed") {
    return value;
  }

  return "open";
}

function mapIncidentAlertType(value?: string): SecurityIncident["alertType"] {
  if (value === "panic" || value === "medical" || value === "fire" || value === "security" || value === "other") {
    return value;
  }

  return undefined;
}

function mapCsoReviewStatus(value?: string): CsoReview["status"] {
  if (value === "open" || value === "approved" || value === "rejected" || value === "closed" || value === "completed") {
    return value;
  }

  return "pending";
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
