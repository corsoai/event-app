import { randomBytes } from "crypto";
import type { UserRole } from "@/lib/types";
import { getPasswordQualityError } from "@/lib/password-policy";
import {
  DEFAULT_ESTATE_NAME,
  isPhoneAuthEmail,
  loginIdentifierToEmail,
  normalizePhoneNumber,
  phoneAuthEmail
} from "@/lib/utils";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  AppwriteRestError,
  appwriteDeleteRow,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  estate_admin: "Estate Admin",
  resident: "Resident",
  security_guard: "Security Guard",
  vendor: "Vendor / Domestic Staff"
};

export type AppwriteManagedUserInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  estateId: string;
  houseNumber: string;
};

export type AppwriteManagedUserUpdateInput = {
  profileId: string;
  action: string;
  fullName?: string;
  phone?: string;
  role?: UserRole;
  estateId?: string;
  houseNumber?: string;
  active?: boolean;
};

export type ManagedAppwriteUser = {
  id: string;
  authUserId: string;
  estateId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  estate: string;
  houseNumber: string;
  active: boolean;
  createdAt: string;
};

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: boolean;
  prefs?: Record<string, unknown>;
};

type AppwriteSession = {
  userId: string;
};

type AppwriteRowList<T> = {
  rows?: T[];
  documents?: T[];
  total?: number;
};

type AppwriteUserList = {
  users?: AppwriteUser[];
  total?: number;
};

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
  createdAt?: string;
  updatedAt?: string;
};

export async function listAppwriteManagedUsers(scope: "admin" | "super-admin"): Promise<ManagedAppwriteUser[]> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  await setupAppwriteOnboardingSchema();
  const payload = await appwriteRequest<AppwriteRowList<AppwriteProfileRow>>(
    `/tablesdb/${config.databaseId}/tables/profiles/rows`
  );
  const allowedRoles = scope === "super-admin"
    ? new Set<UserRole>(["super_admin", "estate_admin", "security_guard", "resident", "vendor"])
    : new Set<UserRole>(["security_guard", "resident", "vendor"]);

  return (payload.rows ?? payload.documents ?? [])
    .filter((row) => row.role && allowedRoles.has(row.role))
    .map(profileRowToManagedUser)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createAppwriteManagedUser(input: AppwriteManagedUserInput) {
  const fullName = input.fullName.trim();
  const rawEmail = input.email.trim().toLowerCase();
  const phone = normalizePhoneNumber(input.phone);
  const role = input.role;
  const estateId = role === "super_admin" ? "platform" : canonicalEstateId(input.estateId);
  const houseNumber = normalizeUnitCode(input.houseNumber);
  const email = rawEmail || phoneAuthEmail(phone);
  const password = input.password.trim() || makeTemporaryPassword();
  const passwordError = getPasswordQualityError(password);

  if (!fullName || !phone) {
    throw new Error("Full name and phone number are required.");
  }

  if (rawEmail && !rawEmail.includes("@")) {
    throw new Error("Enter a valid email address or leave email empty.");
  }

  if (role === "resident" && !houseNumber) {
    throw new Error("Property / unit ID is required for residents.");
  }

  if (passwordError) {
    throw new Error(passwordError);
  }

  const schema = await setupAppwriteOnboardingSchema();
  if (!schema.ok) {
    throw new Error(`Appwrite server configuration is missing: ${schema.missing.join(", ")}`);
  }

  await appwriteUpsertRow("estates", APPWRITE_LBSVIEW_ESTATE_ID, {
    name: DEFAULT_ESTATE_NAME,
    address: "LBS View Estate, Lagos",
    contactEmail: "admin@lbsviewestate.example",
    contactPhone: "+2348011112040",
    gateName: "Main Gate",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const user = await createAuthUser({
    fullName,
    email,
    phone,
    password,
    role,
    estateId,
    houseNumber
  });
  await updateUserPrefs(user.$id, {
    fullName,
    phone,
    role,
    estateId,
    estateName: role === "super_admin" ? "All estates" : DEFAULT_ESTATE_NAME,
    houseNumber,
    loginIdentifier: rawEmail || phone
  });

  const now = new Date().toISOString();
  await appwriteUpsertRow("profiles", profileIdFor(user.$id), {
    estateId,
    userId: user.$id,
    fullName,
    email,
    phone,
    role,
    status: "active",
    houseNumber,
    createdAt: now,
    updatedAt: now
  });

  if (role === "resident") {
    await syncResidentRows({
      fullName,
      email,
      phone,
      estateId,
      unitCode: houseNumber,
      now
    });
  }

  await appwriteUpsertRow("audit_logs", safeAppwriteId("audit", `create-user:${user.$id}:${now}`), {
    estateId,
    actor: "corso-admin",
    action: "created_appwrite_user",
    entityType: "system",
    entityId: user.$id,
    metadata: JSON.stringify({ role, email, phone, houseNumber }),
    createdAt: now,
    updatedAt: now
  });

  return {
    message: `${fullName} has been created as ${roleLabels[role]} in Appwrite.`,
    temporaryPassword: password,
    loginIdentifier: rawEmail || phone,
    user: {
      id: profileIdFor(user.$id),
      authUserId: user.$id,
      estateId: role === "super_admin" ? null : estateId,
      fullName,
      email,
      phone,
      role,
      estate: role === "super_admin" ? "All estates" : DEFAULT_ESTATE_NAME,
      houseNumber,
      active: true,
      createdAt: now
    }
  };
}

export async function updateAppwriteManagedUser(input: AppwriteManagedUserUpdateInput) {
  const target = await getProfileRow(input.profileId);
  const userId = target.userId;
  if (!userId) {
    throw new Error("This profile is missing an Appwrite Auth user ID.");
  }

  if (input.action === "send_setup_email") {
    return {
      message: "Appwrite email setup is not connected yet. Use Reset password and share the temporary password privately.",
      setupLink: ""
    };
  }

  if (input.action === "reset_password") {
    const password = makeTemporaryPassword();
    await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/password`, {
      method: "PATCH",
      body: { password }
    });

    return {
      message: `${target.fullName ?? "This user's"} password has been reset. Give the temporary password privately.`,
      temporaryPassword: password,
      loginIdentifier: target.phone || (target.email && !isPhoneAuthEmail(target.email) ? target.email : ""),
      user: profileRowToManagedUser(target)
    };
  }

  const active = input.action === "suspend"
    ? false
    : input.action === "reactivate"
      ? true
      : Boolean(input.active ?? target.status !== "inactive");
  const fullName = String(input.fullName ?? target.fullName ?? "").trim();
  const phone = normalizePhoneNumber(String(input.phone ?? target.phone ?? ""));
  const role = input.role ?? target.role ?? "resident";
  const estateId = role === "super_admin" ? "platform" : canonicalEstateId(String(input.estateId ?? target.estateId ?? ""));
  const houseNumber = role === "resident" ? normalizeUnitCode(String(input.houseNumber ?? target.houseNumber ?? "")) : "";
  const now = new Date().toISOString();

  if (!fullName || !phone) {
    throw new Error("Full name and phone number are required.");
  }

  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/name`, {
    method: "PATCH",
    body: { name: fullName.slice(0, 128) }
  });
  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/phone`, {
    method: "PATCH",
    body: { number: appwritePhone(phone) }
  });
  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: { status: active }
  });
  await updateUserPrefs(userId, {
    fullName,
    phone,
    role,
    estateId,
    estateName: role === "super_admin" ? "All estates" : DEFAULT_ESTATE_NAME,
    houseNumber,
    loginIdentifier: target.email && !isPhoneAuthEmail(target.email) ? target.email : phone
  });

  const updatedProfile: AppwriteProfileRow = {
    ...target,
    estateId,
    userId,
    fullName,
    email: target.email ?? phoneAuthEmail(phone),
    phone,
    role,
    status: active ? "active" : "inactive",
    houseNumber,
    updatedAt: now
  };
  await appwriteUpsertRow("profiles", input.profileId, {
    estateId: updatedProfile.estateId,
    userId: updatedProfile.userId,
    fullName: updatedProfile.fullName,
    email: updatedProfile.email,
    phone: updatedProfile.phone,
    role: updatedProfile.role,
    status: updatedProfile.status,
    houseNumber: updatedProfile.houseNumber,
    createdAt: target.createdAt ?? now,
    updatedAt: now
  });

  if (role === "resident" && houseNumber) {
    await syncResidentRows({
      fullName,
      email: updatedProfile.email ?? phoneAuthEmail(phone),
      phone,
      estateId,
      unitCode: houseNumber,
      now
    });
  }

  const verb = input.action === "suspend" ? "suspended" : input.action === "reactivate" ? "reactivated" : "updated";
  return {
    message: `${fullName} has been ${verb}.`,
    user: profileRowToManagedUser(updatedProfile)
  };
}

export async function deleteAppwriteManagedUser(profileId: string) {
  const target = await getProfileRow(profileId);
  if (target.userId) {
    await appwriteRequest<null>(`/users/${encodeURIComponent(target.userId)}`, {
      method: "DELETE"
    });
  }

  await appwriteDeleteRow("profiles", profileId);

  return {
    message: `${target.fullName ?? "User"} has been deleted.`
  };
}

export async function loginWithAppwrite(identifier: string, password: string) {
  const email = await resolveLoginEmail(identifier);
  const session = await appwriteRequest<AppwriteSession>("/account/sessions/email", {
    method: "POST",
    requireApiKey: false,
    body: {
      email,
      password
    }
  });
  const user = await getAuthUser(session.userId);
  const prefs = user.prefs ?? {};
  const role = isUserRole(prefs.role) ? prefs.role : "resident";
  const phone = typeof prefs.phone === "string" ? prefs.phone : normalizePhoneNumber(user.phone ?? "");
  const fullName = typeof prefs.fullName === "string" ? prefs.fullName : user.name ?? "Corso user";
  const estate = typeof prefs.estateName === "string"
    ? prefs.estateName
    : role === "super_admin"
      ? "All estates"
      : DEFAULT_ESTATE_NAME;

  return {
    email: isPhoneAuthEmail(user.email ?? "") ? "" : user.email ?? email,
    phone,
    name: fullName,
    role,
    estate,
    appwriteUserId: user.$id
  };
}

async function resolveLoginEmail(identifier: string) {
  const trimmed = identifier.trim().toLowerCase();
  if (trimmed.includes("@")) {
    return trimmed;
  }

  const phone = normalizePhoneNumber(trimmed);
  if (!phone) {
    return loginIdentifierToEmail(trimmed);
  }

  const payload = await appwriteRequest<AppwriteUserList>(`/users?search=${encodeURIComponent(phone)}`);
  const user = (payload.users ?? []).find((item) => normalizePhoneNumber(item.phone ?? "") === phone);

  return user?.email ?? phoneAuthEmail(phone);
}

async function createAuthUser(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  estateId: string;
  houseNumber: string;
}) {
  try {
    return await appwriteRequest<AppwriteUser>("/users", {
      method: "POST",
      body: {
        userId: safeAppwriteId("usr", input.email || input.phone),
        email: input.email,
        phone: appwritePhone(input.phone),
        password: input.password,
        name: input.fullName.slice(0, 128)
      }
    });
  } catch (error) {
    if (error instanceof AppwriteRestError && error.status === 409) {
      throw new Error("This email or phone already exists in Appwrite. Use another login contact or reset that user's password.");
    }

    throw error;
  }
}

async function getAuthUser(userId: string) {
  return appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`);
}

async function getProfileRow(profileId: string) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  const row = await appwriteRequest<AppwriteProfileRow>(
    `/tablesdb/${config.databaseId}/tables/profiles/rows/${encodeURIComponent(profileId)}`
  );
  if (!row) {
    throw new Error("User profile was not found.");
  }

  return row;
}

async function updateUserPrefs(userId: string, prefs: Record<string, unknown>) {
  return appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/prefs`, {
    method: "PATCH",
    body: { prefs }
  });
}

async function syncResidentRows(input: {
  fullName: string;
  email: string;
  phone: string;
  estateId: string;
  unitCode: string;
  now: string;
}) {
  const propertyCode = propertyCodeFromUnitCode(input.unitCode);
  const propertyId = safeAppwriteId("prop", `${input.estateId}:${propertyCode}`);
  const unitId = safeAppwriteId("unit", `${input.estateId}:${input.unitCode}`);
  const residentId = safeAppwriteId("res", `${input.email}:${input.phone}:${input.unitCode}`);

  await appwriteUpsertRow("properties", propertyId, {
    estateId: input.estateId,
    propertyCode,
    name: propertyCode,
    description: `${propertyCode} property inside ${DEFAULT_ESTATE_NAME}`,
    street: "LBS View Estate",
    status: "active",
    createdAt: input.now,
    updatedAt: input.now
  });

  await appwriteUpsertRow("units", unitId, {
    estateId: input.estateId,
    propertyId,
    unitCode: input.unitCode,
    label: unitLabelFromUnitCode(input.unitCode),
    apartmentType: "",
    status: "occupied",
    currentResidentId: residentId,
    createdAt: input.now,
    updatedAt: input.now
  });

  await appwriteUpsertRow("residents", residentId, {
    estateId: input.estateId,
    propertyId,
    unitId,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    residentType: "tenant",
    status: "active",
    moveInDate: input.now.slice(0, 10),
    createdAt: input.now,
    updatedAt: input.now,
    openingOutstanding: 0,
    expectedMonthly: 0
  });

  await appwriteUpsertRow("resident_unit_history", safeAppwriteId("hist", `${residentId}:${unitId}`), {
    estateId: input.estateId,
    residentId,
    propertyId,
    unitId,
    unitCode: input.unitCode,
    residentStatus: "active",
    moveInDate: input.now.slice(0, 10),
    source: "admin_create_user",
    createdAt: input.now,
    updatedAt: input.now
  });
}

function canonicalEstateId(estateId: string) {
  return estateId === APPWRITE_LBSVIEW_ESTATE_ID || estateId === "platform" ? estateId : APPWRITE_LBSVIEW_ESTATE_ID;
}

function normalizeUnitCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function propertyCodeFromUnitCode(unitCode: string) {
  const normalized = normalizeUnitCode(unitCode);
  const ldiMatch = normalized.match(/^([A-Z]+-\d+)-[A-Z0-9]+$/);
  if (ldiMatch) {
    return ldiMatch[1];
  }

  const dashNumberMatch = normalized.match(/^([A-Z]+)-\d+[A-Z]?$/);
  if (dashNumberMatch) {
    return dashNumberMatch[1];
  }

  const compactMatch = normalized.match(/^([A-Z]+)\d+[A-Z]?$/);
  if (compactMatch) {
    return compactMatch[1];
  }

  const parts = normalized.split("-").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join("-") : normalized;
}

function unitLabelFromUnitCode(unitCode: string) {
  const normalized = normalizeUnitCode(unitCode);
  const parts = normalized.split("-").filter(Boolean);
  return parts.at(-1) ?? normalized;
}

function profileIdFor(userId: string) {
  return safeAppwriteId("profile", userId);
}

function profileRowToManagedUser(row: AppwriteProfileRow): ManagedAppwriteUser {
  return {
    id: row.$id ?? safeAppwriteId("profile", row.userId ?? row.email ?? row.fullName ?? "user"),
    authUserId: row.userId ?? "",
    estateId: row.role === "super_admin" ? null : row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    fullName: row.fullName ?? "Unnamed user",
    email: row.email ?? "",
    phone: row.phone ?? "",
    role: row.role ?? "resident",
    estate: row.role === "super_admin" ? "All estates" : DEFAULT_ESTATE_NAME,
    houseNumber: row.houseNumber ?? "",
    active: row.status !== "inactive",
    createdAt: row.createdAt ?? ""
  };
}

function appwritePhone(phone: string) {
  const digits = normalizePhoneNumber(phone);
  return digits ? `+${digits}` : undefined;
}

function makeTemporaryPassword() {
  return `Corso${randomBytes(4).toString("hex")}#1`;
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && ["super_admin", "estate_admin", "resident", "security_guard", "vendor"].includes(value);
}
