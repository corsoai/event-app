import { randomInt } from "crypto";
import type { Resident, UserRole, Visitor } from "@/lib/types";
import { getVisitorExpiresAtIso, getVisitorWindowState, VISITOR_CODE_VALIDITY_HOURS } from "@/lib/visitor-window";
import { DEFAULT_ESTATE_NAME, normalizePhoneNumber } from "@/lib/utils";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  safeAppwriteId,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

type AppwriteProfileRow = {
  $id?: string;
  userId?: string;
  estateId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  status?: string;
  houseNumber?: string;
};

type AppwriteResidentRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  residentType?: string;
  status?: string;
  moveInDate?: string;
  legacyName?: string;
  legacyAddress?: string;
  openingOutstanding?: number;
  expectedMonthly?: number;
  onboardingStatus?: string;
  reviewReasons?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AppwriteUnitRow = {
  $id?: string;
  unitCode?: string;
};

type AppwriteVisitorRow = {
  $id?: string;
  estateId?: string;
  residentId?: string;
  visitorName?: string;
  phone?: string;
  visitDate?: string;
  arrivalTime?: string;
  purpose?: string;
  count?: number;
  code?: string;
  expiresAt?: string;
  status?: Visitor["status"];
  createdAt?: string;
  updatedAt?: string;
};

type AppwriteVisitorLogRow = {
  $id?: string;
  estateId?: string;
  visitorId?: string;
  visitorName?: string;
  code?: string;
  gateName?: string;
  guardName?: string;
  entryTime?: string;
  exitTime?: string;
  decision?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type VisitorCreateInput = Pick<
  Visitor,
  "visitorName" | "phone" | "visitDate" | "arrivalTime" | "purpose" | "count"
>;

const verifierRoles = new Set<UserRole>(["security_guard", "estate_admin", "super_admin"]);

export async function createAppwriteResidentVisitor(appwriteUserId: string, input: VisitorCreateInput) {
  const profile = await requireProfile(appwriteUserId, "resident");
  const visitorName = input.visitorName.trim();
  const visitDate = input.visitDate.trim();
  const arrivalTime = input.arrivalTime.trim();
  const purpose = input.purpose.trim();
  const count = Number(input.count);

  if (!visitorName || !visitDate || !arrivalTime || !purpose) {
    throw new Error("Visitor name, visit date, arrival time, and purpose are required.");
  }
  if (!Number.isFinite(count) || count < 1 || count > 20) {
    throw new Error("Number of visitors must be between 1 and 20.");
  }

  const resident = await findOrCreateResidentForProfile(profile);
  const createdAt = new Date().toISOString();
  const code = await makeUniqueAccessCode(profile.estateId ?? resident.estateId);
  const visitor = await appwriteUpsertRow<AppwriteVisitorRow>("visitors", safeAppwriteId("vis", `${resident.id}:${code}`), {
    estateId: profile.estateId ?? resident.estateId,
    residentId: resident.id,
    visitorName,
    phone: input.phone.trim(),
    visitDate,
    arrivalTime,
    purpose,
    count,
    code,
    expiresAt: getVisitorExpiresAtIso({ createdAt, visitDate, arrivalTime }),
    status: "pending",
    createdAt,
    updatedAt: createdAt
  });

  return mapVisitorRow(visitor);
}

export async function findAppwriteVisitorByCode(appwriteUserId: string, code: string) {
  const profile = await requireProfile(appwriteUserId);
  if (!verifierRoles.has(profile.role ?? "resident")) {
    throw new Error("This account cannot verify visitor codes.");
  }

  const targetCode = code.replace(/\D/g, "").slice(0, 6);
  if (targetCode.length !== 6) {
    throw new Error("Enter a valid 6-digit visitor code.");
  }

  const rows = await listAppwriteTableRows<AppwriteVisitorRow>("visitors");
  const row = rows.find((visitor) =>
    visitor.code === targetCode &&
    (profile.role === "super_admin" || visitor.estateId === profile.estateId)
  );

  if (!row) {
    throw new Error("No valid visitor invitation found for this code.");
  }

  let visitor = mapVisitorRow(row);
  await assertVisitorLookupWindow(visitor);

  if (visitor.status === "pending") {
    visitor = await updateVisitorStatusRow(visitor, "verified");
    await writeVisitorLog(profile, visitor, "verified");
  }

  return {
    visitor,
    resident: await findResidentView(visitor.residentId)
  };
}

export async function updateAppwriteVisitorStatus(appwriteUserId: string, visitorId: string, status: Visitor["status"]) {
  const profile = await requireProfile(appwriteUserId);
  if (!verifierRoles.has(profile.role ?? "resident")) {
    throw new Error("This account cannot update visitor codes.");
  }

  const allowedStatuses: Visitor["status"][] = ["verified", "checked-in", "checked-out", "cancelled", "expired"];
  if (!visitorId || !allowedStatuses.includes(status)) {
    throw new Error("Choose a valid visitor status.");
  }

  const row = (await listAppwriteTableRows<AppwriteVisitorRow>("visitors")).find((visitor) =>
    visitor.$id === visitorId &&
    (profile.role === "super_admin" || visitor.estateId === profile.estateId)
  );

  if (!row) {
    throw new Error("Visitor invitation was not found.");
  }

  const visitor = mapVisitorRow(row);
  assertVisitorStatusChange(visitor, status);
  const updated = await updateVisitorStatusRow(visitor, status);
  await writeVisitorLog(profile, updated, status);

  return updated;
}

async function requireProfile(appwriteUserId: string, expectedRole?: UserRole) {
  if (!appwriteUserId) {
    throw new Error("Your login session has expired. Sign in again.");
  }

  await setupAppwriteOnboardingSchema();
  const profile = (await listAppwriteTableRows<AppwriteProfileRow>("profiles")).find((row) => row.userId === appwriteUserId);
  if (!profile) {
    throw new Error("No active profile was found for this account.");
  }
  if (profile.status === "inactive") {
    throw new Error("This account is suspended.");
  }
  if (expectedRole && profile.role !== expectedRole) {
    throw new Error(`Only ${expectedRole.replaceAll("_", " ")} accounts can perform this action.`);
  }

  return profile;
}

async function findOrCreateResidentForProfile(profile: AppwriteProfileRow): Promise<Resident> {
  const residents = await listAppwriteTableRows<AppwriteResidentRow>("residents");
  const normalizedPhone = normalizePhoneNumber(profile.phone ?? "");
  const normalizedEmail = String(profile.email ?? "").trim().toLowerCase();
  const existing = residents.find((resident) =>
    (!!normalizedPhone && normalizePhoneNumber(resident.phone ?? "") === normalizedPhone) ||
    (!!normalizedEmail && String(resident.email ?? "").trim().toLowerCase() === normalizedEmail)
  );

  if (existing) {
    return mapResidentRow(existing);
  }

  const now = new Date().toISOString();
  const created = await appwriteUpsertRow<AppwriteResidentRow>("residents", safeAppwriteId("res", `${profile.userId}:${profile.email}:${profile.phone}`), {
    estateId: profile.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    fullName: profile.fullName ?? "Resident",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    residentType: "tenant",
    status: "active",
    moveInDate: now.slice(0, 10),
    openingOutstanding: 0,
    expectedMonthly: 0,
    onboardingStatus: "needs_review",
    reviewReasons: "Resident account created before property/unit assignment.",
    createdAt: now,
    updatedAt: now
  });

  return mapResidentRow(created);
}

async function makeUniqueAccessCode(estateId: string) {
  const visitors = await listAppwriteTableRows<AppwriteVisitorRow>("visitors");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(100000, 1000000));
    if (!visitors.some((visitor) => visitor.estateId === estateId && visitor.code === code)) {
      return code;
    }
  }

  throw new Error("Could not generate a unique visitor code.");
}

async function assertVisitorLookupWindow(visitor: Visitor) {
  if (visitor.status === "cancelled") {
    throw new Error("This visitor code has been cancelled.");
  }
  if (visitor.status === "expired") {
    throw new Error("This visitor code has expired.");
  }
  if (visitor.status === "checked-in" || visitor.status === "checked-out") {
    return;
  }

  const windowState = getVisitorWindowState(visitor);
  if (windowState.canVerifyOrCheckIn) {
    return;
  }

  if (windowState.status === "expired") {
    await updateVisitorStatusRow(visitor, "expired");
  }

  throw new Error(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`);
}

function assertVisitorStatusChange(visitor: Visitor, nextStatus: Visitor["status"]) {
  if (nextStatus === "verified" || nextStatus === "checked-in") {
    if (visitor.status === "cancelled" || visitor.status === "expired" || visitor.status === "checked-out") {
      throw new Error("This visitor code cannot be verified or checked in again.");
    }

    const windowState = getVisitorWindowState(visitor);
    if (!windowState.canVerifyOrCheckIn) {
      throw new Error(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`);
    }
  }

  if (nextStatus === "checked-out" && visitor.status !== "checked-in") {
    throw new Error("Only checked-in visitors can be checked out.");
  }
  if (nextStatus === "cancelled" && visitor.status === "checked-out") {
    throw new Error("Checked-out visitors cannot be rejected.");
  }
}

async function updateVisitorStatusRow(visitor: Visitor, status: Visitor["status"]) {
  const now = new Date().toISOString();
  const row = await appwriteUpsertRow<AppwriteVisitorRow>("visitors", visitor.id, {
    estateId: visitor.estateId,
    residentId: visitor.residentId,
    visitorName: visitor.visitorName,
    phone: visitor.phone,
    visitDate: visitor.visitDate,
    arrivalTime: visitor.arrivalTime,
    purpose: visitor.purpose,
    count: visitor.count,
    code: visitor.code,
    expiresAt: visitor.expiresAt,
    status,
    createdAt: visitor.createdAt,
    updatedAt: now
  });

  return mapVisitorRow(row);
}

async function writeVisitorLog(profile: AppwriteProfileRow, visitor: Visitor, status: Visitor["status"]) {
  const now = new Date().toISOString();
  const decision = status === "cancelled" ? "rejected" : status;
  const logs = await listAppwriteTableRows<AppwriteVisitorLogRow>("visitor_logs");

  if (status === "checked-out") {
    const latest = logs
      .filter((log) => log.visitorId === visitor.id)
      .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")))[0];
    if (latest?.$id) {
      await appwriteUpsertRow<AppwriteVisitorLogRow>("visitor_logs", latest.$id, {
        ...latest,
        exitTime: now,
        decision,
        updatedAt: now
      });
      return;
    }
  }

  await appwriteUpsertRow<AppwriteVisitorLogRow>("visitor_logs", safeAppwriteId("vlog", `${visitor.id}:${status}:${now}`), {
    estateId: visitor.estateId,
    visitorId: visitor.id,
    visitorName: visitor.visitorName,
    code: visitor.code,
    gateName: "Main Gate A",
    guardName: profile.fullName ?? "Security",
    entryTime: status === "checked-in" ? now : "",
    exitTime: status === "checked-out" ? now : "",
    decision,
    createdAt: now,
    updatedAt: now
  });
}

async function findResidentView(residentId: string) {
  const row = (await listAppwriteTableRows<AppwriteResidentRow>("residents")).find((resident) => resident.$id === residentId);
  return row ? mapResidentRow(row) : null;
}

function mapVisitorRow(row: AppwriteVisitorRow): Visitor {
  return {
    id: row.$id ?? "",
    residentId: row.residentId ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    visitorName: row.visitorName ?? "Visitor",
    phone: row.phone ?? "",
    visitDate: row.visitDate ?? "",
    arrivalTime: String(row.arrivalTime ?? "").slice(0, 5),
    purpose: row.purpose ?? "",
    count: Number(row.count ?? 1),
    code: row.code ?? "",
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    status: row.status ?? "pending"
  };
}

function mapResidentRow(row: AppwriteResidentRow): Resident {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    propertyId: row.propertyId,
    unitId: row.unitId,
    name: row.fullName ?? "Resident",
    houseNumber: row.unitId ?? "Pending assignment",
    phone: row.phone ?? "",
    email: row.email ?? "",
    type: row.residentType === "owner" || row.residentType === "family member" ? row.residentType : "tenant",
    status: row.status === "inactive" || row.status === "moved out" || row.status === "moved_out" ? row.status.replace("_", " ") as Resident["status"] : "active",
    moveInDate: row.moveInDate,
    legacyName: row.legacyName,
    legacyAddress: row.legacyAddress,
    openingOutstanding: row.openingOutstanding,
    expectedMonthly: row.expectedMonthly,
    onboardingStatus: row.onboardingStatus,
    reviewReasons: row.reviewReasons
  };
}
