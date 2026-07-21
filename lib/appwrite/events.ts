import { randomInt } from "crypto";
import type { CheckinRecord, CheckinResult, EventRecord, Guest, GuestCategory, UserRole } from "@/lib/types";
import type { SessionContext } from "@/lib/appwrite/session-context";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteInsertRow,
  appwriteUpsertRow,
  setupAppwriteOnboardingSchema,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";

/**
 * The `events` and `guests` tables were added to schema.ts after the estate's
 * Appwrite database was already provisioned. setupAppwriteOnboardingSchema()
 * is memoized per server instance (see server.ts), so this only pays the full
 * dozens-of-REST-calls cost once per cold start — every later call in the
 * same warm instance just reuses the cached promise. Safe to call on every
 * entry point below until the tables are confirmed created everywhere.
 */
async function ensureEventsSchema() {
  await setupAppwriteOnboardingSchema();
}

type AppwriteEventRow = {
  $id?: string;
  estateId?: string;
  name?: string;
  venue?: string;
  address?: string;
  startAt?: string;
  endAt?: string;
  gates?: string;
  status?: EventRecord["status"];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AppwriteGuestRow = {
  $id?: string;
  estateId?: string;
  eventId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  category?: GuestCategory;
  code?: string;
  status?: Guest["status"];
  checkedInAt?: string;
  checkedInGate?: string;
  checkedInBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AppwriteCheckinRow = {
  $id?: string;
  estateId?: string;
  eventId?: string;
  guestId?: string;
  guestName?: string;
  category?: GuestCategory;
  code?: string;
  gate?: string;
  scannedBy?: string;
  scannedAt?: string;
  capturedAt?: string;
  result?: CheckinResult;
  createdAt?: string;
};

const organizerRoles = new Set<UserRole>(["estate_admin", "super_admin"]);
const gateRoles = new Set<UserRole>(["security_guard", "estate_admin", "super_admin"]);

type SessionInput = Pick<SessionContext, "userId" | "profileId" | "role" | "estateId">;

export type EventCreateInput = {
  name: string;
  venue: string;
  address: string;
  startAt: string;
  endAt?: string;
  gates?: string;
};

export type GuestCreateInput = {
  fullName: string;
  phone?: string;
  email?: string;
  category?: GuestCategory;
  code?: string;
};

function requireOrganizer(context: SessionInput) {
  if (!organizerRoles.has(context.role)) {
    throw new Error("Only organizer admins can manage events.");
  }
}

function requireGateStaff(context: SessionInput) {
  if (!gateRoles.has(context.role)) {
    throw new Error("This account cannot check guests in.");
  }
}

function scopeForContext(context: SessionInput): AppwriteEstateScope {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId || APPWRITE_LBSVIEW_ESTATE_ID };
}

export async function createAppwriteEvent(context: SessionInput, input: EventCreateInput): Promise<EventRecord> {
  requireOrganizer(context);
  await ensureEventsSchema();

  const name = input.name.trim();
  const startAt = input.startAt.trim();
  if (!name) {
    throw new Error("Event name is required.");
  }
  if (!startAt || Number.isNaN(new Date(startAt).getTime())) {
    throw new Error("A valid event start date/time is required.");
  }

  const now = new Date().toISOString();
  const estateId = context.estateId || APPWRITE_LBSVIEW_ESTATE_ID;
  const row = await appwriteInsertRow<AppwriteEventRow>("events", safeAppwriteId("evt", `${estateId}:${name}:${now}`), {
    estateId,
    name,
    venue: input.venue?.trim() ?? "",
    address: input.address?.trim() ?? "",
    startAt: new Date(startAt).toISOString(),
    endAt: input.endAt ? new Date(input.endAt).toISOString() : undefined,
    gates: input.gates?.trim() ?? "",
    status: "draft",
    createdBy: context.profileId,
    createdAt: now,
    updatedAt: now
  });

  return mapEventRow(row);
}

export async function listAppwriteEvents(context: SessionInput): Promise<EventRecord[]> {
  await ensureEventsSchema();
  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteEventRow>("events", scope);
  return rows
    .map(mapEventRow)
    .sort((left, right) => (right.startAt ?? "").localeCompare(left.startAt ?? ""));
}

export async function getAppwriteEvent(context: SessionInput, eventId: string): Promise<EventRecord> {
  await ensureEventsSchema();
  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteEventRow>("events", scope);
  const row = rows.find((item) => item.$id === eventId);
  if (!row) {
    throw new Error("Event was not found.");
  }
  return mapEventRow(row);
}

export async function updateAppwriteEventStatus(context: SessionInput, eventId: string, status: EventRecord["status"]): Promise<EventRecord> {
  requireOrganizer(context);
  const event = await getAppwriteEvent(context, eventId);
  const now = new Date().toISOString();
  const row = await appwriteUpsertRow<AppwriteEventRow>("events", eventId, {
    estateId: event.estateId,
    name: event.name,
    venue: event.venue,
    address: event.address,
    startAt: event.startAt,
    endAt: event.endAt,
    gates: event.gates,
    status,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: now
  });
  return mapEventRow(row);
}

export async function listAppwriteEventGuests(context: SessionInput, eventId: string): Promise<Guest[]> {
  await getAppwriteEvent(context, eventId);
  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteGuestRow>("guests", scope);
  return rows
    .filter((row) => row.eventId === eventId)
    .map(mapGuestRow)
    .sort((left, right) => (left.fullName ?? "").localeCompare(right.fullName ?? ""));
}

export async function createAppwriteGuest(context: SessionInput, eventId: string, input: GuestCreateInput): Promise<Guest> {
  requireOrganizer(context);
  const event = await getAppwriteEvent(context, eventId);

  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new Error("Guest name is required.");
  }

  const category: GuestCategory = input.category === "vip" || input.category === "staff" ? input.category : "regular";
  const now = new Date().toISOString();
  const code = await makeUniqueGuestCode(eventId, input.code);
  const row = await appwriteInsertRow<AppwriteGuestRow>("guests", safeAppwriteId("gst", `${eventId}:${code}`), {
    estateId: event.estateId,
    eventId,
    fullName,
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    category,
    code,
    status: "invited",
    createdAt: now,
    updatedAt: now
  });

  return mapGuestRow(row);
}

export async function bulkCreateAppwriteGuests(context: SessionInput, eventId: string, guests: GuestCreateInput[]): Promise<{ created: Guest[]; errors: string[] }> {
  requireOrganizer(context);
  if (!guests.length) {
    throw new Error("No guests were provided to import.");
  }
  if (guests.length > 500) {
    throw new Error("Import at most 500 guests at a time.");
  }

  const created: Guest[] = [];
  const errors: string[] = [];

  for (const [index, guestInput] of guests.entries()) {
    try {
      created.push(await createAppwriteGuest(context, eventId, guestInput));
    } catch (error) {
      errors.push(`Row ${index + 1} (${guestInput.fullName || "unnamed"}): ${error instanceof Error ? error.message : "could not be saved."}`);
    }
  }

  return { created, errors };
}

export async function checkInAppwriteGuestByCode(
  context: SessionInput,
  eventId: string,
  code: string,
  gateName: string,
  capturedAt?: string
): Promise<Guest> {
  requireGateStaff(context);
  await getAppwriteEvent(context, eventId);

  const targetCode = code.replace(/\D/g, "").slice(0, 6);
  if (targetCode.length !== 6) {
    throw new Error("Enter a valid 6-digit guest code.");
  }

  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteGuestRow>("guests", scope);
  const row = rows.find((item) => item.eventId === eventId && item.code === targetCode);
  if (!row) {
    throw new Error("No guest found with that code for this event.");
  }

  const guest = mapGuestRow(row);
  const gate = gateName.trim() || "Main gate";
  const now = new Date().toISOString();
  const arrivalAt = normalizeCapturedAt(capturedAt) ?? now;

  if (guest.status === "checked-in") {
    // Rule 6C: every scan is recorded, including duplicate attempts.
    await recordCheckinScan(context, guest, gate, now, arrivalAt, "duplicate");
    throw new Error(`${guest.fullName} already checked in at ${formatCheckInTime(guest.checkedInAt)}.`);
  }
  if (guest.status === "cancelled") {
    throw new Error(`${guest.fullName}'s invitation was cancelled.`);
  }

  const updated = await appwriteUpsertRow<AppwriteGuestRow>("guests", guest.id, {
    estateId: guest.estateId,
    eventId: guest.eventId,
    fullName: guest.fullName,
    phone: guest.phone,
    email: guest.email,
    category: guest.category,
    code: guest.code,
    status: "checked-in",
    checkedInAt: arrivalAt,
    checkedInGate: gate,
    checkedInBy: context.profileId,
    createdAt: guest.createdAt,
    updatedAt: now
  });

  await recordCheckinScan(context, guest, gate, now, arrivalAt, "checked-in");

  return mapGuestRow(updated);
}

/**
 * Offline-synced scans send the honest capture time from the gate device.
 * Accept it only if it parses and is not in the future (small clock-skew
 * allowance) and no older than 48h — otherwise fall back to server time.
 */
function normalizeCapturedAt(value?: string) {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return undefined;
  const nowMs = Date.now();
  if (time > nowMs + 5 * 60 * 1000) return undefined;
  if (time < nowMs - 48 * 60 * 60 * 1000) return undefined;
  return new Date(time).toISOString();
}

/**
 * One row per scan (rule 6C): scannedBy from the session, gate label,
 * server timestamp. Logging must never break the check-in itself.
 */
async function recordCheckinScan(
  context: SessionInput,
  guest: Guest,
  gate: string,
  scannedAt: string,
  capturedAt: string,
  result: CheckinResult
) {
  try {
    await appwriteInsertRow<AppwriteCheckinRow>(
      "checkins",
      safeAppwriteId("chk", `${guest.eventId}:${guest.code}:${scannedAt}`),
      {
        estateId: guest.estateId,
        eventId: guest.eventId,
        guestId: guest.id,
        guestName: guest.fullName,
        category: guest.category,
        code: guest.code,
        gate,
        scannedBy: context.profileId,
        scannedAt,
        capturedAt,
        result,
        createdAt: scannedAt
      }
    );
  } catch {
    // Non-fatal: the guest row is the source of truth for state; the log is auxiliary.
  }
}

export async function listAppwriteEventCheckins(context: SessionInput, eventId: string, limit = 200): Promise<CheckinRecord[]> {
  requireGateStaff(context);
  await ensureEventsSchema();
  await getAppwriteEvent(context, eventId);

  const scope = scopeForContext(context);
  const rows = await listAppwriteTableRows<AppwriteCheckinRow>("checkins", scope);
  return rows
    .filter((row) => row.eventId === eventId)
    .map(mapCheckinRow)
    .sort((left, right) => new Date(right.scannedAt).getTime() - new Date(left.scannedAt).getTime())
    .slice(0, limit);
}

function mapCheckinRow(row: AppwriteCheckinRow): CheckinRecord {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    eventId: row.eventId ?? "",
    guestId: row.guestId ?? "",
    guestName: row.guestName ?? "",
    category: row.category ?? "regular",
    code: row.code ?? "",
    gate: row.gate ?? "",
    scannedBy: row.scannedBy ?? "",
    scannedAt: row.scannedAt ?? row.createdAt ?? "",
    capturedAt: row.capturedAt,
    result: row.result ?? "checked-in",
    createdAt: row.createdAt
  };
}

async function makeUniqueGuestCode(eventId: string, preferredCode?: string) {
  const guests = await listAppwriteTableRows<AppwriteGuestRow>("guests");
  const cleanedPreferredCode = String(preferredCode ?? "").replace(/\D/g, "").slice(0, 6);
  if (
    cleanedPreferredCode.length === 6 &&
    !guests.some((guest) => guest.eventId === eventId && guest.code === cleanedPreferredCode)
  ) {
    return cleanedPreferredCode;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(100000, 1000000));
    if (!guests.some((guest) => guest.eventId === eventId && guest.code === code)) {
      return code;
    }
  }

  throw new Error("Could not generate a unique guest code.");
}

function formatCheckInTime(value?: string) {
  if (!value) return "an earlier time";
  try {
    return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
  } catch {
    return value;
  }
}

function mapEventRow(row: AppwriteEventRow): EventRecord {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    name: row.name ?? "Untitled event",
    venue: row.venue ?? "",
    address: row.address ?? "",
    startAt: row.startAt ?? "",
    endAt: row.endAt,
    gates: row.gates ?? "",
    status: row.status === "live" || row.status === "ended" ? row.status : "draft",
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapGuestRow(row: AppwriteGuestRow): Guest {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    eventId: row.eventId ?? "",
    fullName: row.fullName ?? "Guest",
    phone: row.phone ?? "",
    email: row.email ?? "",
    category: row.category === "vip" || row.category === "staff" ? row.category : "regular",
    code: row.code ?? "",
    status: row.status === "checked-in" || row.status === "checked-out" || row.status === "cancelled" ? row.status : "invited",
    checkedInAt: row.checkedInAt,
    checkedInGate: row.checkedInGate,
    checkedInBy: row.checkedInBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
