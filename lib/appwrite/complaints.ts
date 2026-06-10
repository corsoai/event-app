import type { AppwriteComplaint, Resident, UserRole } from "@/lib/types";
import {
  APPWRITE_TABLE_AUDIT_LOGS,
  APPWRITE_TABLE_COMPLAINTS,
  APPWRITE_TABLE_PROFILES
} from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory, listAppwriteTableRows } from "@/lib/appwrite/residents";
import { normalizePhoneNumber } from "@/lib/utils";

type ComplaintCategory = AppwriteComplaint["category"];
type ComplaintPriority = AppwriteComplaint["priority"];
type ComplaintStatus = AppwriteComplaint["status"];

type AppwriteComplaintRow = {
  $id?: string;
  estateId?: string;
  residentId?: string;
  residentName?: string;
  unitCode?: string;
  propertyCode?: string;
  category?: string;
  priority?: string;
  subject?: string;
  description?: string;
  status?: string;
  assignedTo?: string;
  assignedToName?: string;
  adminResponse?: string;
  resolvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AppwriteProfileRow = {
  $id?: string;
  userId?: string;
  estateId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  houseNumber?: string;
  status?: string;
};

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  prefs?: Record<string, unknown>;
};

export type ComplaintFilters = {
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
};

export type ComplaintCreateInput = {
  category: ComplaintCategory;
  priority: ComplaintPriority;
  subject: string;
  description: string;
};

export type ComplaintUpdateInput = {
  status?: ComplaintStatus;
  assignedTo?: string;
  assignedToName?: string;
  adminResponse?: string;
  resolvedAt?: string;
  priority?: ComplaintPriority;
};

type ComplaintActor = {
  profileId: string;
  fullName: string;
  estateId: string;
};

type ResidentComplaintSession = ComplaintActor & {
  resident: Resident;
  unitCode: string;
  propertyCode: string;
};

export async function listAdminComplaints(filters: ComplaintFilters = {}) {
  const status = filters.status ? normalizeStatus(filters.status) : null;
  const priority = filters.priority ? normalizePriority(filters.priority) : null;
  const category = filters.category ? normalizeCategory(filters.category) : null;
  const search = filters.search?.trim().toLowerCase() ?? "";

  return (await listComplaintRows())
    .map(mapComplaintRow)
    .filter((complaint) => complaint.estateId === APPWRITE_LBSVIEW_ESTATE_ID)
    .filter((complaint) => !status || complaint.status === status)
    .filter((complaint) => !priority || complaint.priority === priority)
    .filter((complaint) => !category || complaint.category === category)
    .filter((complaint) => {
      if (!search) return true;
      return complaint.residentName.toLowerCase().includes(search)
        || complaint.subject.toLowerCase().includes(search);
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getAdminComplaint(complaintId: string) {
  return mapComplaintRow(await getComplaintRow(complaintId));
}

export async function updateComplaint(complaintId: string, input: ComplaintUpdateInput, actor: ComplaintActor) {
  const id = complaintId.trim();
  if (!id) {
    throw new Error("Complaint ID is required.");
  }

  const existing = await getComplaintRow(id);
  const now = new Date().toISOString();
  const nextStatus = input.status === undefined ? normalizeStatus(existing.status ?? "open") : normalizeStatus(input.status);
  const row = await appwriteUpsertRow<AppwriteComplaintRow>(APPWRITE_TABLE_COMPLAINTS, id, {
    ...existing,
    status: nextStatus,
    assignedTo: input.assignedTo === undefined ? existing.assignedTo : input.assignedTo.trim(),
    assignedToName: input.assignedToName === undefined ? existing.assignedToName : input.assignedToName.trim(),
    adminResponse: input.adminResponse === undefined ? existing.adminResponse : input.adminResponse.trim(),
    resolvedAt: resolveResolvedAt(input.resolvedAt, existing.resolvedAt, nextStatus, now),
    priority: input.priority === undefined ? existing.priority : normalizePriority(input.priority),
    updatedAt: now
  });
  const complaint = mapComplaintRow(row);

  await writeComplaintAudit(actor, "updated complaint", complaint.id, {
    status: complaint.status,
    priority: complaint.priority,
    residentId: complaint.residentId
  });

  return complaint;
}

export async function resolveComplaintActor(userId: string, role: string): Promise<ComplaintActor> {
  if (!userId) {
    throw new Error("Authenticated Appwrite user is required.");
  }

  const { user, profile } = await resolveUserAndProfile(userId);
  const prefs = user.prefs ?? {};

  return {
    profileId: profile?.$id ?? userId,
    fullName: profile?.fullName ?? stringPref(prefs.fullName) ?? user.name ?? user.email ?? "Estate admin",
    estateId: role === "super_admin"
      ? (profile?.estateId || stringPref(prefs.estateId) || APPWRITE_LBSVIEW_ESTATE_ID)
      : (profile?.estateId || stringPref(prefs.estateId) || APPWRITE_LBSVIEW_ESTATE_ID)
  };
}

export async function resolveResidentComplaintSession(userId: string): Promise<ResidentComplaintSession> {
  if (!userId) {
    throw new Error("Authenticated Appwrite user is required.");
  }

  const [{ user, profile }, directory] = await Promise.all([
    resolveUserAndProfile(userId),
    listAppwriteResidentDirectory({ ensureSchema: false })
  ]);
  const prefs = user.prefs ?? {};
  const identity = {
    email: profile?.email ?? stringPref(prefs.email) ?? user.email ?? "",
    phone: profile?.phone ?? stringPref(prefs.phone) ?? normalizePhoneNumber(user.phone ?? ""),
    fullName: profile?.fullName ?? stringPref(prefs.fullName) ?? user.name ?? "",
    houseNumber: profile?.houseNumber ?? stringPref(prefs.houseNumber) ?? ""
  };
  const resident = findResidentForSession(directory.residents, identity);
  if (!resident) {
    throw new Error("No resident record matched this login.");
  }

  const unit = directory.units.find((item) => item.id === resident.unitId || item.unitCode === identity.houseNumber);
  const property = directory.properties.find((item) => item.id === (resident.propertyId ?? unit?.propertyId));

  return {
    profileId: profile?.$id ?? userId,
    fullName: identity.fullName || resident.name,
    estateId: resident.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    resident,
    unitCode: unit?.unitCode ?? resident.houseNumber,
    propertyCode: property?.propertyCode ?? resident.propertyId ?? ""
  };
}

export async function listResidentComplaints(session: ResidentComplaintSession) {
  return (await listComplaintRows())
    .map(mapComplaintRow)
    .filter((complaint) => complaint.residentId === session.resident.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createResidentComplaint(input: ComplaintCreateInput, session: ResidentComplaintSession) {
  const now = new Date().toISOString();
  const subject = requiredText(input.subject, "Subject");
  const description = requiredText(input.description, "Description");
  const complaintId = safeAppwriteId("comp", `${session.resident.id}:${subject}:${now}`);
  const row = await appwriteUpsertRow<AppwriteComplaintRow>(APPWRITE_TABLE_COMPLAINTS, complaintId, {
    estateId: session.estateId,
    residentId: session.resident.id,
    residentName: session.resident.name,
    unitCode: session.unitCode,
    propertyCode: session.propertyCode,
    category: normalizeCategory(input.category),
    priority: normalizePriority(input.priority),
    subject,
    description,
    status: "open",
    createdAt: now,
    updatedAt: now
  });
  const complaint = mapComplaintRow(row);

  await writeComplaintAudit(session, "created complaint", complaint.id, {
    residentId: complaint.residentId,
    category: complaint.category,
    priority: complaint.priority
  });

  return complaint;
}

export async function getResidentComplaint(complaintId: string, session: ResidentComplaintSession) {
  const complaint = mapComplaintRow(await getComplaintRow(complaintId));
  if (complaint.residentId !== session.resident.id) {
    throw new ForbiddenComplaintError();
  }

  return complaint;
}

export class ForbiddenComplaintError extends Error {
  constructor() {
    super("You are not allowed to view this complaint.");
    this.name = "ForbiddenComplaintError";
  }
}

async function resolveUserAndProfile(userId: string) {
  const [user, profiles] = await Promise.all([
    appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`),
    listAppwriteTableRows<AppwriteProfileRow>(APPWRITE_TABLE_PROFILES)
  ]);

  return {
    user,
    profile: profiles.find((item) => item.userId === userId)
  };
}

async function listComplaintRows() {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return listAppwriteTableRows<AppwriteComplaintRow>(APPWRITE_TABLE_COMPLAINTS);
}

async function getComplaintRow(complaintId: string) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return appwriteRequest<AppwriteComplaintRow>(
    `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_COMPLAINTS}/rows/${encodeURIComponent(complaintId)}`,
    { method: "GET" }
  );
}

function mapComplaintRow(row: AppwriteComplaintRow): AppwriteComplaint {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    residentId: row.residentId ?? "",
    residentName: row.residentName ?? "Resident",
    unitCode: row.unitCode ?? "",
    propertyCode: row.propertyCode ?? "",
    category: normalizeCategory(row.category ?? "other"),
    priority: normalizePriority(row.priority ?? "medium"),
    subject: row.subject ?? "Untitled complaint",
    description: row.description ?? "",
    status: normalizeStatus(row.status ?? "open"),
    assignedTo: optionalText(row.assignedTo),
    assignedToName: optionalText(row.assignedToName),
    adminResponse: optionalText(row.adminResponse),
    resolvedAt: optionalText(row.resolvedAt),
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? ""
  };
}

async function writeComplaintAudit(
  actor: ComplaintActor,
  action: string,
  complaintId: string,
  metadata: Record<string, string | number | boolean>
) {
  const now = new Date().toISOString();
  await appwriteUpsertRow(APPWRITE_TABLE_AUDIT_LOGS, safeAppwriteId("audit", `${action}:${complaintId}:${now}`), {
    estateId: actor.estateId,
    actor: actor.fullName,
    action,
    entityType: "complaint",
    entityId: complaintId,
    metadata: JSON.stringify(metadata),
    createdAt: now
  });
}

function findResidentForSession(
  residents: Resident[],
  identity: { email: string; phone: string; fullName: string; houseNumber: string }
) {
  const phone = normalizePhoneNumber(identity.phone);
  const email = identity.email.trim().toLowerCase();
  const fullName = identity.fullName.trim().toLowerCase();
  const houseNumber = identity.houseNumber.trim().toLowerCase();

  if (phone) {
    const byPhone = residents.find((resident) => normalizePhoneNumber(resident.phone) === phone);
    if (byPhone) return byPhone;
  }

  if (email) {
    const byEmail = residents.find((resident) => resident.email.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  if (houseNumber) {
    const byUnit = residents.find((resident) => resident.houseNumber.trim().toLowerCase() === houseNumber);
    if (byUnit) return byUnit;
  }

  if (fullName) {
    const byName = residents.find((resident) => resident.name.trim().toLowerCase() === fullName);
    if (byName) return byName;
  }

  return undefined;
}

function resolveResolvedAt(input: string | undefined, existing: string | undefined, status: ComplaintStatus, now: string) {
  if (input !== undefined) {
    return optionalText(input);
  }

  if (status === "resolved" && !existing) {
    return now;
  }

  return existing;
}

function requiredText(value: string, label: string) {
  const text = value.trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function normalizeCategory(value: string): ComplaintCategory {
  if (value === "security" || value === "power" || value === "water" || value === "waste" || value === "noise" || value === "road" || value === "facility" || value === "other") {
    return value;
  }

  return "other";
}

function normalizePriority(value: string): ComplaintPriority {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return "medium";
}

function normalizeStatus(value: string): ComplaintStatus {
  if (value === "open" || value === "in_progress" || value === "resolved" || value === "closed") {
    return value;
  }

  if (value === "in progress") {
    return "in_progress";
  }

  return "open";
}

function optionalText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function stringPref(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
