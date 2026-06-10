import type { HouseholdMember } from "@/lib/types";
import { APPWRITE_TABLE_HOUSEHOLD_MEMBERS } from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";
import { resolveResidentComplaintSession } from "@/lib/appwrite/complaints";

type Relationship = HouseholdMember["relationship"];
type IdType = NonNullable<HouseholdMember["idType"]>;

type HouseholdRow = {
  $id?: string;
  estateId?: string;
  residentId?: string;
  unitCode?: string;
  propertyCode?: string;
  fullName?: string;
  relationship?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  photoFileId?: string;
  hasEstateAccess?: boolean;
  accessNote?: string;
  addedBy?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type HouseholdInput = {
  fullName: string;
  relationship: Relationship;
  phone?: string;
  idType?: IdType;
  idNumber?: string;
  hasEstateAccess?: boolean;
  accessNote?: string;
};

export type HouseholdUpdateInput = Partial<HouseholdInput> & {
  status?: HouseholdMember["status"];
};

export type AdminHouseholdFilters = {
  residentId?: string;
  unitCode?: string;
  hasEstateAccess?: string;
};

export async function resolveHouseholdSession(userId: string) {
  return resolveResidentComplaintSession(userId);
}

export async function listResidentHouseholdMembers(session: Awaited<ReturnType<typeof resolveHouseholdSession>>) {
  return (await listHouseholdRows())
    .map(mapHouseholdRow)
    .filter((member) => member.residentId === session.resident.id)
    .filter((member) => member.status === "active")
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function createHouseholdMember(input: HouseholdInput, session: Awaited<ReturnType<typeof resolveHouseholdSession>>) {
  const now = new Date().toISOString();
  const memberId = safeAppwriteId("hh", `${session.resident.id}:${input.fullName}:${now}`);
  const row = await appwriteUpsertRow<HouseholdRow>(APPWRITE_TABLE_HOUSEHOLD_MEMBERS, memberId, {
    estateId: session.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    residentId: session.resident.id,
    unitCode: session.unitCode,
    propertyCode: session.propertyCode,
    fullName: requiredText(input.fullName, "Full name"),
    relationship: normalizeRelationship(input.relationship),
    phone: input.phone?.trim() ?? "",
    idType: input.idType ? normalizeIdType(input.idType) : "none",
    idNumber: input.idNumber?.trim() ?? "",
    hasEstateAccess: Boolean(input.hasEstateAccess),
    accessNote: input.accessNote?.trim() ?? "",
    addedBy: session.resident.id,
    status: "active",
    createdAt: now,
    updatedAt: now
  });

  return mapHouseholdRow(row);
}

export async function updateHouseholdMember(
  memberId: string,
  input: HouseholdUpdateInput,
  session: Awaited<ReturnType<typeof resolveHouseholdSession>>
) {
  const existing = await getHouseholdRow(memberId);
  assertOwnHouseholdMember(existing, session.resident.id);
  const now = new Date().toISOString();
  const row = await appwriteUpsertRow<HouseholdRow>(APPWRITE_TABLE_HOUSEHOLD_MEMBERS, memberId, {
    estateId: existing.estateId ?? session.estateId,
    residentId: existing.residentId ?? session.resident.id,
    unitCode: existing.unitCode ?? session.unitCode,
    propertyCode: existing.propertyCode ?? session.propertyCode,
    fullName: input.fullName === undefined ? existing.fullName : requiredText(input.fullName, "Full name"),
    relationship: input.relationship === undefined ? existing.relationship : normalizeRelationship(input.relationship),
    phone: input.phone === undefined ? existing.phone ?? "" : input.phone.trim(),
    idType: input.idType === undefined ? existing.idType ?? "none" : normalizeIdType(input.idType),
    idNumber: input.idNumber === undefined ? existing.idNumber ?? "" : input.idNumber.trim(),
    photoFileId: existing.photoFileId ?? "",
    hasEstateAccess: input.hasEstateAccess === undefined ? Boolean(existing.hasEstateAccess) : Boolean(input.hasEstateAccess),
    accessNote: input.accessNote === undefined ? existing.accessNote ?? "" : input.accessNote.trim(),
    addedBy: existing.addedBy ?? session.resident.id,
    status: input.status === "inactive" ? "inactive" : "active",
    createdAt: existing.createdAt ?? now,
    updatedAt: now
  });

  return mapHouseholdRow(row);
}

export async function deleteHouseholdMember(memberId: string, session: Awaited<ReturnType<typeof resolveHouseholdSession>>) {
  return updateHouseholdMember(memberId, { status: "inactive" }, session);
}

export async function listAdminHouseholdMembers(filters: AdminHouseholdFilters = {}) {
  const residentId = filters.residentId?.trim();
  const unitCode = filters.unitCode?.trim().toLowerCase();
  const hasEstateAccess = filters.hasEstateAccess === undefined || filters.hasEstateAccess === ""
    ? null
    : filters.hasEstateAccess === "true";

  return (await listHouseholdRows())
    .map(mapHouseholdRow)
    .filter((member) => member.estateId === APPWRITE_LBSVIEW_ESTATE_ID)
    .filter((member) => !residentId || member.residentId === residentId)
    .filter((member) => !unitCode || member.unitCode.toLowerCase() === unitCode)
    .filter((member) => hasEstateAccess === null || member.hasEstateAccess === hasEstateAccess)
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export class ForbiddenHouseholdError extends Error {
  constructor() {
    super("You are not allowed to update this household member.");
    this.name = "ForbiddenHouseholdError";
  }
}

async function listHouseholdRows() {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return listAppwriteTableRows<HouseholdRow>(APPWRITE_TABLE_HOUSEHOLD_MEMBERS);
}

async function getHouseholdRow(memberId: string) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return appwriteRequest<HouseholdRow>(
    `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_HOUSEHOLD_MEMBERS}/rows/${encodeURIComponent(memberId)}`,
    { method: "GET" }
  );
}

function assertOwnHouseholdMember(row: HouseholdRow, residentId: string) {
  if (row.residentId !== residentId) {
    throw new ForbiddenHouseholdError();
  }
}

function mapHouseholdRow(row: HouseholdRow): HouseholdMember {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    residentId: row.residentId ?? "",
    unitCode: row.unitCode ?? "",
    propertyCode: row.propertyCode ?? "",
    fullName: row.fullName ?? "Unnamed member",
    relationship: normalizeRelationship(row.relationship ?? "other"),
    phone: optionalText(row.phone),
    idType: normalizeIdType(row.idType ?? "none"),
    idNumber: optionalText(row.idNumber),
    photoFileId: optionalText(row.photoFileId),
    hasEstateAccess: Boolean(row.hasEstateAccess),
    accessNote: optionalText(row.accessNote),
    addedBy: row.addedBy ?? "",
    status: row.status === "inactive" ? "inactive" : "active",
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? ""
  };
}

function normalizeRelationship(value: string): Relationship {
  if (value === "spouse" || value === "child" || value === "parent" || value === "sibling" || value === "relative" || value === "domestic_staff" || value === "driver" || value === "guard" || value === "vendor" || value === "other") {
    return value;
  }

  return "other";
}

function normalizeIdType(value: string): IdType {
  if (value === "nin" || value === "bvn" || value === "passport" || value === "drivers_license" || value === "other" || value === "none") {
    return value;
  }

  return "none";
}

function requiredText(value: string, label: string) {
  const text = value.trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function optionalText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}
