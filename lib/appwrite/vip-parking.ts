import type { UserRole, VipPlate } from "@/lib/types";
import type { SessionContext } from "@/lib/appwrite/session-context";
import {
  appwriteDeleteRow,
  appwriteInsertRow,
  appwriteUpsertRow,
  ensureAppwriteTablesExist,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";
import { getAppwriteEvent } from "@/lib/appwrite/events";
import { APPWRITE_LBSVIEW_ESTATE_ID } from "@/lib/appwrite/server";

/**
 * VIP Parking (per-workspace optional module, toggle key `plate_capture`).
 * Organizer registers expected VIP plates per event; gate staff log arrivals
 * at the car gate. Follows rules 6A/6C: proxy-only access via our API routes,
 * identity (`loggedBy`) from the session — never the request body.
 */

type AppwriteVipPlateRow = {
  $id?: string;
  estateId?: string;
  eventId?: string;
  plate?: string;
  label?: string;
  status?: VipPlate["status"];
  arrivedAt?: string;
  arrivedGate?: string;
  loggedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

const organizerRoles = new Set<UserRole>(["estate_admin", "super_admin"]);
const gateRoles = new Set<UserRole>(["security_guard", "estate_admin", "super_admin"]);

type SessionInput = Pick<SessionContext, "userId" | "profileId" | "role" | "estateId">;

async function ensureVipSchema() {
  await ensureAppwriteTablesExist(["vip_plates"]);
}

export function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function requireOrganizer(context: SessionInput) {
  if (!organizerRoles.has(context.role)) {
    throw new Error("Only organizer admins can manage VIP plates.");
  }
}

function requireGateStaff(context: SessionInput) {
  if (!gateRoles.has(context.role)) {
    throw new Error("This account cannot log VIP arrivals.");
  }
}

function scopeForContext(context: SessionInput): AppwriteEstateScope {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId || APPWRITE_LBSVIEW_ESTATE_ID };
}

export async function listAppwriteVipPlates(context: SessionInput, eventId: string): Promise<VipPlate[]> {
  requireGateStaff(context);
  await ensureVipSchema();
  await getAppwriteEvent(context, eventId);

  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteVipPlateRow>("vip_plates", scope);
  return rows
    .filter((row) => row.eventId === eventId)
    .map(mapVipPlateRow)
    .sort((left, right) => left.plate.localeCompare(right.plate));
}

export async function addAppwriteVipPlate(
  context: SessionInput,
  eventId: string,
  input: { plate: string; label?: string }
): Promise<VipPlate> {
  requireOrganizer(context);
  await ensureVipSchema();
  const event = await getAppwriteEvent(context, eventId);

  const plate = normalizePlate(input.plate);
  if (plate.length < 3 || plate.length > 16) {
    throw new Error("Enter a valid plate number (3-16 letters and digits).");
  }

  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteVipPlateRow>("vip_plates", scope);
  if (rows.some((row) => row.eventId === eventId && row.plate === plate)) {
    throw new Error(`Plate ${plate} is already on this event's VIP list.`);
  }

  const now = new Date().toISOString();
  const row = await appwriteInsertRow<AppwriteVipPlateRow>(
    "vip_plates",
    safeAppwriteId("vip", `${eventId}:${plate}`),
    {
      estateId: event.estateId,
      eventId,
      plate,
      label: (input.label ?? "").trim(),
      status: "expected",
      createdAt: now,
      updatedAt: now
    }
  );

  return mapVipPlateRow(row);
}

export async function removeAppwriteVipPlate(context: SessionInput, eventId: string, plateId: string): Promise<void> {
  requireOrganizer(context);
  await ensureVipSchema();
  await getAppwriteEvent(context, eventId);

  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteVipPlateRow>("vip_plates", scope);
  const row = rows.find((item) => (item.$id ?? "") === plateId && item.eventId === eventId);
  if (!row) {
    throw new Error("That VIP plate was not found on this event.");
  }

  await appwriteDeleteRow("vip_plates", plateId);
}

export async function markAppwriteVipPlateArrived(
  context: SessionInput,
  eventId: string,
  plateInput: string,
  gateName: string
): Promise<VipPlate> {
  requireGateStaff(context);
  await ensureVipSchema();
  await getAppwriteEvent(context, eventId);

  const plate = normalizePlate(plateInput);
  if (!plate) {
    throw new Error("Enter the vehicle's plate number.");
  }

  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteVipPlateRow>("vip_plates", scope);
  const row = rows.find((item) => item.eventId === eventId && item.plate === plate);
  if (!row) {
    throw new Error(`Plate ${plate} is not on this event's VIP list.`);
  }

  const record = mapVipPlateRow(row);
  if (record.status === "arrived") {
    throw new Error(`${record.plate} already arrived at ${formatArrivalTime(record.arrivedAt)}.`);
  }

  const now = new Date().toISOString();
  const updated = await appwriteUpsertRow<AppwriteVipPlateRow>("vip_plates", record.id, {
    estateId: record.estateId,
    eventId: record.eventId,
    plate: record.plate,
    label: record.label,
    status: "arrived",
    arrivedAt: now,
    arrivedGate: gateName.trim() || "Car gate",
    loggedBy: context.profileId,
    createdAt: record.createdAt,
    updatedAt: now
  });

  return mapVipPlateRow(updated);
}

function mapVipPlateRow(row: AppwriteVipPlateRow): VipPlate {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    eventId: row.eventId ?? "",
    plate: row.plate ?? "",
    label: row.label ?? "",
    status: row.status === "arrived" ? "arrived" : "expected",
    arrivedAt: row.arrivedAt,
    arrivedGate: row.arrivedGate,
    loggedBy: row.loggedBy,
    createdAt: row.createdAt
  };
}

function formatArrivalTime(value?: string) {
  if (!value) return "an earlier time";
  try {
    return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
  } catch {
    return value;
  }
}
