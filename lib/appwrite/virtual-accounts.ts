import {
  APPWRITE_TABLE_PROPERTIES,
  APPWRITE_TABLE_RESIDENTS,
  APPWRITE_TABLE_RESIDENT_VIRTUAL_ACCOUNTS,
  APPWRITE_TABLE_UNITS
} from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";
import { createReservedAccount } from "@/lib/monnify/client";

export type VirtualAccountRow = {
  $id?: string;
  estateId?: string;
  residentId?: string;
  propertyId?: string;
  unitId?: string;
  propertyCode?: string;
  unitCode?: string;
  provider?: string;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  bankCode?: string;
  providerReference?: string;
  status?: string;
  assignedAt?: string;
  deactivatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ResidentRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
};

type UnitRow = {
  $id?: string;
  propertyId?: string;
  unitCode?: string;
  currentResidentId?: string;
};

type PropertyRow = {
  $id?: string;
  propertyCode?: string;
};

export type VirtualAccountDetails = {
  id: string;
  residentId: string;
  propertyId?: string;
  unitId?: string;
  propertyCode?: string;
  unitCode?: string;
  provider: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode?: string;
  providerReference?: string;
  status: string;
  assignedAt?: string;
};

let virtualAccountSchemaReady = false;

export async function getVirtualAccountForResident(residentId: string) {
  await ensureVirtualAccountSchema();
  const rows = await listAppwriteTableRows<VirtualAccountRow>(APPWRITE_TABLE_RESIDENT_VIRTUAL_ACCOUNTS);
  const row = rows.find((item) => item.residentId === residentId && item.provider === "monnify" && item.status !== "inactive");
  return row ? enrichVirtualAccount(row) : null;
}

export async function findVirtualAccountByAccountNumber(accountNumber: string) {
  await ensureVirtualAccountSchema();
  const normalized = accountNumber.replace(/\D/g, "");
  if (!normalized) {
    return null;
  }

  const rows = await listAppwriteTableRows<VirtualAccountRow>(APPWRITE_TABLE_RESIDENT_VIRTUAL_ACCOUNTS);
  const row = rows.find((item) => item.accountNumber?.replace(/\D/g, "") === normalized);
  return row ? enrichVirtualAccount(row) : null;
}

export async function findResidentIdByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const rows = await listAppwriteTableRows<ResidentRow>(APPWRITE_TABLE_RESIDENTS);
  return rows.find((row) => row.email?.trim().toLowerCase() === normalized)?.$id ?? "";
}

export async function assignMonnifyVirtualAccount(residentId: string) {
  await ensureVirtualAccountSchema();
  const existing = await getVirtualAccountForResident(residentId);
  if (existing) {
    return existing;
  }

  const resident = await getResidentRow(residentId);
  const identity = await resolveResidentIdentity(resident);
  const unitCode = identity.unitCode || resident.unitId || residentId;
  const accountReference = `LBSV-${unitCode.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase()}`;
  const reservedAccount = await createReservedAccount({
    accountReference,
    accountName: `${resident.fullName ?? "Resident"} - ${unitCode}`.slice(0, 100),
    customerEmail: customerEmail(resident),
    customerName: resident.fullName ?? "LBS View Resident",
    metadata: {
      residentId,
      unitCode,
      estateId: resident.estateId || APPWRITE_LBSVIEW_ESTATE_ID
    }
  });
  const now = new Date().toISOString();
  const rowId = safeAppwriteId("vacct", `${residentId}:${reservedAccount.accountNumber}`);
  const row = await appwriteUpsertRow<VirtualAccountRow>(APPWRITE_TABLE_RESIDENT_VIRTUAL_ACCOUNTS, rowId, {
    estateId: resident.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    residentId,
    propertyId: identity.propertyId,
    unitId: identity.unitId,
    propertyCode: identity.propertyCode,
    unitCode: identity.unitCode,
    provider: "monnify",
    accountNumber: reservedAccount.accountNumber,
    accountName: reservedAccount.accountName,
    bankName: reservedAccount.bankName,
    bankCode: reservedAccount.bankCode,
    providerReference: reservedAccount.reservationReference || reservedAccount.accountReference,
    status: "active",
    assignedAt: now,
    createdAt: now,
    updatedAt: now
  });

  return enrichVirtualAccount(row);
}

async function getResidentRow(residentId: string) {
  const config = getAppwriteServerConfig();
  return appwriteRequest<ResidentRow>(
    `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_RESIDENTS}/rows/${encodeURIComponent(residentId)}`,
    { method: "GET" }
  );
}

async function resolveResidentIdentity(resident: ResidentRow) {
  const [units, properties] = await Promise.all([
    listAppwriteTableRows<UnitRow>(APPWRITE_TABLE_UNITS),
    listAppwriteTableRows<PropertyRow>(APPWRITE_TABLE_PROPERTIES)
  ]);
  const unit = units.find((item) => item.$id === resident.unitId || item.currentResidentId === resident.$id);
  const property = properties.find((item) => item.$id === (resident.propertyId ?? unit?.propertyId));

  return {
    propertyId: resident.propertyId ?? unit?.propertyId,
    unitId: resident.unitId ?? unit?.$id,
    propertyCode: property?.propertyCode,
    unitCode: unit?.unitCode
  };
}

async function enrichVirtualAccount(row: VirtualAccountRow): Promise<VirtualAccountDetails> {
  const identity = await resolveVirtualAccountIdentity(row);
  return {
    id: row.$id ?? "",
    residentId: row.residentId ?? "",
    propertyId: row.propertyId,
    unitId: row.unitId,
    propertyCode: row.propertyCode ?? identity.propertyCode,
    unitCode: row.unitCode ?? identity.unitCode,
    provider: row.provider ?? "monnify",
    accountNumber: row.accountNumber ?? "",
    accountName: row.accountName ?? "",
    bankName: row.bankName ?? "",
    bankCode: row.bankCode,
    providerReference: row.providerReference,
    status: row.status ?? "active",
    assignedAt: row.assignedAt
  };
}

async function resolveVirtualAccountIdentity(row: VirtualAccountRow) {
  const [units, properties] = await Promise.all([
    listAppwriteTableRows<UnitRow>(APPWRITE_TABLE_UNITS),
    listAppwriteTableRows<PropertyRow>(APPWRITE_TABLE_PROPERTIES)
  ]);
  const unit = units.find((item) => item.$id === row.unitId || item.currentResidentId === row.residentId);
  const property = properties.find((item) => item.$id === (row.propertyId ?? unit?.propertyId));

  return {
    unitCode: unit?.unitCode,
    propertyCode: property?.propertyCode
  };
}

async function ensureVirtualAccountSchema() {
  if (virtualAccountSchemaReady) {
    return;
  }

  await setupAppwriteOnboardingSchema();
  virtualAccountSchemaReady = true;
}

function customerEmail(resident: ResidentRow) {
  const email = resident.email?.trim() ?? "";
  return email.includes("@") ? email : "payments@corso.ng";
}
