import type { SecurityIncident, UserRole } from "@/lib/types";
import {
  APPWRITE_TABLE_AUDIT_LOGS,
  APPWRITE_TABLE_CSO_REVIEWS,
  APPWRITE_TABLE_SECURITY_INCIDENTS
} from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { resolveComplaintActor, resolveResidentComplaintSession } from "@/lib/appwrite/complaints";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

export type SosAlertType = "panic" | "medical" | "fire" | "security" | "other";
export type SosIncidentStatus = "open" | "acknowledged" | "responding" | "resolved" | "false_alarm" | "closed";

type SosIncidentRow = {
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
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSosInput = {
  alertType: SosAlertType;
  locationLabel?: string;
  details?: string;
};

export type UpdateSosInput = {
  incidentId: string;
  status: SosIncidentStatus;
  note?: string;
  assignedToProfileId?: string;
};

type SosActor = {
  profileId: string;
  fullName: string;
  estateId: string;
  role: UserRole;
};

export async function createResidentSosIncident(userId: string, input: CreateSosInput) {
  const session = await resolveResidentComplaintSession(userId);
  const now = new Date().toISOString();
  const alertType = normalizeAlertType(input.alertType);
  const details = optionalText(input.details);
  const unitCode = session.unitCode || session.resident.houseNumber || "Resident unit";
  const locationLabel = [unitCode, optionalText(input.locationLabel)].filter(Boolean).join(" - ");
  const summary = `${alertTypeLabel(alertType)} alert from ${session.resident.name} at ${unitCode}`;
  const incidentId = safeAppwriteId("sos", `${session.resident.id}:${alertType}:${now}`);

  const row = await writeSosIncidentRow(incidentId, {
    estateId: session.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    incidentType: "sos",
    alertType,
    severity: "critical",
    status: "open",
    reportedByRole: "resident",
    reportedByProfileId: session.profileId,
    residentName: session.resident.name,
    unitCode,
    locationLabel,
    summary,
    details,
    openedAt: now,
    createdAt: now,
    updatedAt: now
  });
  const incident = mapSosIncidentRow(row);

  await writeSosAudit({
    estateId: incident.estateId,
    actor: session.fullName || session.resident.name,
    action: "sos_alert_created",
    entityId: incident.id,
    metadata: {
      alertType,
      residentId: session.resident.id,
      unitCode
    }
  });

  return incident;
}

export async function listResidentSosIncidents(userId: string) {
  const session = await resolveResidentComplaintSession(userId);

  return (await listSosIncidentRows())
    .map(mapSosIncidentRow)
    .filter((incident) => incident.reportedByProfileId === session.profileId)
    .sort(sortIncidentsNewestFirst);
}

export async function getResidentSosIncident(userId: string, incidentId: string) {
  const session = await resolveResidentComplaintSession(userId);
  const incident = mapSosIncidentRow(await getSosIncidentRow(incidentId));
  if (incident.reportedByProfileId !== session.profileId) {
    throw new Error("You are not allowed to view this SOS alert.");
  }

  return incident;
}

export async function listAdminSosIncidents(userId: string, role: UserRole) {
  const actor = await resolveSosActor(userId, role);

  return (await listSosIncidentRows())
    .map(mapSosIncidentRow)
    .filter((incident) => incident.estateId === actor.estateId || role === "super_admin")
    .sort(sortIncidentsNewestFirst);
}

export async function updateSosIncident(userId: string, role: UserRole, input: UpdateSosInput) {
  const actor = await resolveSosActor(userId, role);
  const incidentId = input.incidentId.trim();
  if (!incidentId) {
    throw new Error("Incident ID is required.");
  }

  const existing = await getSosIncidentRow(incidentId);
  const existingIncident = mapSosIncidentRow(existing);
  if (role !== "super_admin" && existingIncident.estateId !== actor.estateId) {
    throw new Error("You are not allowed to update this SOS alert.");
  }

  const now = new Date().toISOString();
  const status = normalizeSosStatus(input.status);
  const patch: Record<string, unknown> = {
    ...existing,
    status,
    assignedToProfileId: optionalText(input.assignedToProfileId) ?? existing.assignedToProfileId,
    updatedAt: now
  };

  if (status === "acknowledged") {
    patch.acknowledgedAt = existing.acknowledgedAt || now;
    patch.acknowledgedBy = actor.fullName;
  }

  if (status === "responding") {
    patch.respondingAt = existing.respondingAt || now;
    patch.acknowledgedAt = existing.acknowledgedAt || now;
    patch.acknowledgedBy = existing.acknowledgedBy || actor.fullName;
  }

  if (status === "resolved" || status === "false_alarm" || status === "closed") {
    patch.resolvedAt = existing.resolvedAt || now;
  }

  const row = await writeSosIncidentRow(incidentId, patch);
  const incident = mapSosIncidentRow(row);

  if (role === "cso") {
    await appwriteUpsertRow(APPWRITE_TABLE_CSO_REVIEWS, safeAppwriteId("review", `${incidentId}:${actor.profileId}:${status}:${now}`), {
      estateId: actor.estateId,
      incidentId,
      csoProfileId: actor.profileId,
      decision: status,
      note: optionalText(input.note),
      reviewedAt: now,
      status: "completed",
      createdAt: now,
      updatedAt: now
    });
  }

  await writeSosAudit({
    estateId: incident.estateId,
    actor: actor.fullName,
    action: `sos_alert_${status}`,
    entityId: incident.id,
    metadata: {
      status,
      note: optionalText(input.note) ?? "",
      role
    }
  });

  return incident;
}

function mapSosIncidentRow(row: SosIncidentRow): SecurityIncident {
  const openedAt = row.openedAt ?? row.createdAt ?? "";

  return {
    id: row.$id ?? safeAppwriteId("sos", `${row.summary}:${openedAt}`),
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    incidentType: row.incidentType ?? "sos",
    alertType: normalizeAlertType(row.alertType),
    severity: row.severity === "low" || row.severity === "medium" || row.severity === "high" || row.severity === "critical" ? row.severity : "critical",
    status: normalizeSosStatus(row.status),
    reportedByRole: row.reportedByRole ?? "resident",
    reportedByProfileId: optionalText(row.reportedByProfileId),
    assignedToProfileId: optionalText(row.assignedToProfileId),
    residentName: optionalText(row.residentName),
    unitCode: optionalText(row.unitCode),
    locationLabel: optionalText(row.locationLabel),
    summary: row.summary ?? "SOS alert",
    details: optionalText(row.details),
    openedAt,
    acknowledgedAt: optionalText(row.acknowledgedAt),
    acknowledgedBy: optionalText(row.acknowledgedBy),
    respondingAt: optionalText(row.respondingAt),
    resolvedAt: optionalText(row.resolvedAt)
  };
}

async function resolveSosActor(userId: string, role: UserRole): Promise<SosActor> {
  const actor = await resolveComplaintActor(userId, role);

  return {
    ...actor,
    role
  };
}

async function listSosIncidentRows() {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return (await listAppwriteTableRows<SosIncidentRow>(APPWRITE_TABLE_SECURITY_INCIDENTS))
    .filter((row) => (row.incidentType ?? "").toLowerCase() === "sos");
}

async function getSosIncidentRow(incidentId: string) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return appwriteRequest<SosIncidentRow>(
    `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_SECURITY_INCIDENTS}/rows/${encodeURIComponent(incidentId)}`,
    { method: "GET" }
  );
}

async function writeSosIncidentRow(rowId: string, data: Record<string, unknown>) {
  try {
    return await appwriteUpsertRow<SosIncidentRow>(APPWRITE_TABLE_SECURITY_INCIDENTS, rowId, data);
  } catch (error) {
    if (error instanceof Error && /attribute|column|unknown|invalid/i.test(error.message)) {
      return appwriteUpsertRow<SosIncidentRow>(APPWRITE_TABLE_SECURITY_INCIDENTS, rowId, compactLegacyIncidentPayload(data));
    }

    throw error;
  }
}

function compactLegacyIncidentPayload(data: Record<string, unknown>) {
  const allowed = new Set([
    "estateId",
    "incidentType",
    "severity",
    "status",
    "reportedByRole",
    "reportedByProfileId",
    "assignedToProfileId",
    "locationLabel",
    "summary",
    "details",
    "openedAt",
    "resolvedAt",
    "createdAt",
    "updatedAt"
  ]);

  return Object.fromEntries(Object.entries(data).filter(([key, value]) => allowed.has(key) && value !== undefined && value !== null));
}

async function writeSosAudit(input: {
  estateId: string;
  actor: string;
  action: string;
  entityId: string;
  metadata: Record<string, string | number | boolean>;
}) {
  const now = new Date().toISOString();
  await appwriteUpsertRow(APPWRITE_TABLE_AUDIT_LOGS, safeAppwriteId("audit", `${input.action}:${input.entityId}:${now}`), {
    estateId: input.estateId,
    actor: input.actor,
    action: input.action,
    entityType: "security_incident",
    entityId: input.entityId,
    metadata: JSON.stringify(input.metadata),
    createdAt: now,
    updatedAt: now
  });
}

function sortIncidentsNewestFirst(left: SecurityIncident, right: SecurityIncident) {
  return right.openedAt.localeCompare(left.openedAt);
}

function normalizeAlertType(value: unknown): SosAlertType {
  if (value === "panic" || value === "medical" || value === "fire" || value === "security" || value === "other") {
    return value;
  }

  return "panic";
}

function normalizeSosStatus(value: unknown): SosIncidentStatus {
  if (value === "open" || value === "acknowledged" || value === "responding" || value === "resolved" || value === "false_alarm" || value === "closed") {
    return value;
  }

  return "open";
}

function alertTypeLabel(value: SosAlertType) {
  if (value === "panic") return "Panic / intruder";
  if (value === "medical") return "Medical emergency";
  if (value === "fire") return "Fire";
  if (value === "security") return "Security concern";
  return "Emergency";
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}
