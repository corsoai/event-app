import { randomBytes } from "crypto";
import type { UserRole } from "@/lib/types";
import { DEMO_PASSWORD, getPasswordQualityError } from "@/lib/password-policy";
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
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";
import { corsoEmailHtml, isCorsoEmailEnabled, sendCorsoEmail } from "@/lib/email/resend";

const APP_LOGIN_URL = "https://app.corso.ng/login";

async function sendLoginDetailsEmail(input: {
  email: string;
  fullName: string;
  estateName: string;
  loginIdentifier: string;
  temporaryPassword: string;
  heading: string;
  intro: string;
}) {
  return sendCorsoEmail({
    to: input.email,
    subject: `${input.heading} — Corso`,
    html: corsoEmailHtml({
      heading: input.heading,
      greeting: `Hello ${input.fullName},`,
      lines: [input.intro, "Use the details below to sign in. You will be able to change your password after logging in."],
      details: [
        { label: "Estate", value: input.estateName },
        { label: "Login (phone or email)", value: input.loginIdentifier },
        { label: "Temporary password", value: input.temporaryPassword }
      ],
      ctaLabel: "Open Corso",
      ctaUrl: APP_LOGIN_URL,
      footerNote: "If you did not expect this email, please contact your estate administrator."
    })
  });
}

const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  estate_admin: "Estate Admin",
  cso: "Chief Security Officer",
  resident: "Resident",
  security_guard: "Security Guard",
  vendor: "Vendor / Domestic Staff"
};

// Display names for estates that are not the default. Used for user prefs so
// demo-estate users see their own estate name instead of LBS View.
const ESTATE_DISPLAY_NAMES: Record<string, string> = {
  "corso-demo-estate": "Africa Secured Estate"
};

function estateDisplayName(role: UserRole, estateId: string) {
  if (role === "super_admin") {
    return "All estates";
  }
  return ESTATE_DISPLAY_NAMES[estateId] ?? DEFAULT_ESTATE_NAME;
}

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
  $id?: string;
  userId: string;
  secret?: string;
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
  sourceRow?: number;
  openingOutstanding?: number;
  expectedMonthly?: number;
  onboardingStatus?: string;
  reviewReasons?: string;
  createdAt?: string;
  updatedAt?: string;
};

const defaultAppwriteUsers: AppwriteManagedUserInput[] = [
  {
    fullName: "Corso Platform Admin",
    email: "super@corso.ng",
    phone: "2348000000001",
    password: DEMO_PASSWORD,
    role: "super_admin",
    estateId: "platform",
    houseNumber: ""
  },
  {
    fullName: "LBS View Estate Manager",
    email: "admin@corso.ng",
    phone: "2348011112040",
    password: DEMO_PASSWORD,
    role: "estate_admin",
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    houseNumber: ""
  },
  {
    fullName: "Resident User",
    email: "resident@corso.ng",
    phone: "2348039204412",
    password: DEMO_PASSWORD,
    role: "resident",
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    houseNumber: "LDI-03-A"
  },
  {
    fullName: "Gate Officer Musa",
    email: "security@corso.ng",
    phone: "2348060001122",
    password: DEMO_PASSWORD,
    role: "security_guard",
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    houseNumber: ""
  },
  {
    fullName: "LBS View CSO",
    email: "cso@corso.ng",
    phone: "2348060001123",
    password: DEMO_PASSWORD,
    role: "cso",
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    houseNumber: ""
  }
];

export async function listAppwriteManagedUsers(
  scope: "admin" | "super-admin",
  estateScope: AppwriteEstateScope = {}
): Promise<ManagedAppwriteUser[]> {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  await setupAppwriteOnboardingSchema();
  const profileRows = await listAppwriteTableRows<AppwriteProfileRow>("profiles", estateScope);
  const allowedRoles = scope === "super-admin"
    ? new Set<UserRole>(["super_admin", "estate_admin", "cso", "security_guard", "resident", "vendor"])
    : new Set<UserRole>(["cso", "security_guard", "resident", "vendor"]);

  return profileRows
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
  const passwordWasGenerated = !input.password.trim();
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
    estateName: estateDisplayName(role, estateId),
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

  let emailNote = "";
  if (rawEmail && passwordWasGenerated && isCorsoEmailEnabled()) {
    const emailResult = await sendLoginDetailsEmail({
      email: rawEmail,
      fullName,
      estateName: estateDisplayName(role, estateId),
      loginIdentifier: rawEmail || phone,
      temporaryPassword: password,
      heading: "Welcome to Corso",
      intro: `Your ${roleLabels[role]} account for ${estateDisplayName(role, estateId)} has been created.`
    });
    emailNote = emailResult.sent ? ` A welcome email with login details was sent to ${rawEmail}.` : "";
  }

  return {
    message: `${fullName} has been created as ${roleLabels[role]} in Corso.${emailNote}`,
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
      estate: estateDisplayName(role, estateId),
      houseNumber,
      active: true,
      createdAt: now
    }
  };
}

export async function ensureDefaultAppwriteLoginUser(identifier: string, password: string) {
  const normalizedEmail = identifier.trim().toLowerCase();
  const normalizedPhone = normalizePhoneNumber(identifier);
  const account = defaultAppwriteUsers.find((user) =>
    user.email.toLowerCase() === normalizedEmail ||
    (!!normalizedPhone && normalizePhoneNumber(user.phone) === normalizedPhone)
  );

  if (!account || password !== account.password) {
    return null;
  }

  return ensureAppwriteDefaultUser(account);
}

async function ensureAppwriteDefaultUser(input: AppwriteManagedUserInput) {
  const fullName = input.fullName.trim();
  const rawEmail = input.email.trim().toLowerCase();
  const phone = normalizePhoneNumber(input.phone);
  const role = input.role;
  const estateId = role === "super_admin" ? "platform" : canonicalEstateId(input.estateId);
  const houseNumber = normalizeUnitCode(input.houseNumber);
  const password = input.password;
  const now = new Date().toISOString();

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
    createdAt: now,
    updatedAt: now
  });

  const existing = await findAuthUserByEmailOrPhone(rawEmail, phone);
  const user = existing ?? await createAuthUser({
    fullName,
    email: rawEmail,
    phone,
    password,
    role,
    estateId,
    houseNumber
  });

  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(user.$id)}/password`, {
    method: "PATCH",
    body: { password }
  });
  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(user.$id)}/name`, {
    method: "PATCH",
    body: { name: fullName.slice(0, 128) }
  });
  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(user.$id)}/status`, {
    method: "PATCH",
    body: { status: true }
  });
  await updateUserPrefs(user.$id, {
    fullName,
    phone,
    role,
    estateId,
    estateName: estateDisplayName(role, estateId),
    houseNumber,
    loginIdentifier: rawEmail
  });
  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(user.$id)}/phone`, {
    method: "PATCH",
    body: { number: appwritePhone(phone) }
  }).catch(() => null);

  await appwriteUpsertRow("profiles", profileIdFor(user.$id), {
    estateId,
    userId: user.$id,
    fullName,
    email: rawEmail,
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
      email: rawEmail,
      phone,
      estateId,
      unitCode: houseNumber,
      now
    });
  }

  await appwriteUpsertRow("audit_logs", safeAppwriteId("audit", `ensure-default-user:${user.$id}:${now}`), {
    estateId,
    actor: "corso-system",
    action: "ensured_default_appwrite_user",
    entityType: "system",
    entityId: user.$id,
    metadata: JSON.stringify({ role, email: rawEmail, phone }),
    createdAt: now,
    updatedAt: now
  });

  return {
    email: rawEmail,
    role,
    userId: user.$id
  };
}

export async function updateAppwriteManagedUser(
  input: AppwriteManagedUserUpdateInput,
  scope: AppwriteEstateScope = {}
) {
  const target = await getProfileRow(input.profileId, scope);
  const userId = target.userId;
  if (!userId) {
    throw new Error("This profile is missing an Appwrite Auth user ID.");
  }

  if (input.action === "send_setup_email") {
    const email = target.email && !isPhoneAuthEmail(target.email) ? target.email : "";
    if (!email) {
      return {
        message: "This user has no email address on file. Add their email first, or use Reset password and share the temporary password privately.",
        setupLink: ""
      };
    }
    if (!isCorsoEmailEnabled()) {
      return {
        message: "Email is not configured yet. Use Reset password and share the temporary password privately.",
        setupLink: ""
      };
    }

    const password = makeTemporaryPassword();
    await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/password`, {
      method: "PATCH",
      body: { password }
    });
    const loginIdentifier = target.phone || email;
    const emailResult = await sendLoginDetailsEmail({
      email,
      fullName: target.fullName ?? "there",
      estateName: estateDisplayName(target.role ?? "resident", String(target.estateId ?? "")),
      loginIdentifier,
      temporaryPassword: password,
      heading: "Your Corso login details",
      intro: "Your estate administrator has sent you fresh login details for Corso."
    });

    if (!emailResult.sent) {
      return {
        message: `The email could not be sent (${emailResult.error ?? "unknown error"}). Share the temporary password below privately instead.`,
        temporaryPassword: password,
        loginIdentifier,
        setupLink: "",
        user: profileRowToManagedUser(target)
      };
    }

    return {
      message: `Setup email sent to ${email}. It contains their login and a temporary password.`,
      loginIdentifier,
      setupLink: "",
      user: profileRowToManagedUser(target)
    };
  }

  if (input.action === "reset_password") {
    const password = makeTemporaryPassword();
    await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/password`, {
      method: "PATCH",
      body: { password }
    });

    const resetEmail = target.email && !isPhoneAuthEmail(target.email) ? target.email : "";
    let resetEmailNote = "";
    if (resetEmail && isCorsoEmailEnabled()) {
      const emailResult = await sendLoginDetailsEmail({
        email: resetEmail,
        fullName: target.fullName ?? "there",
        estateName: estateDisplayName(target.role ?? "resident", String(target.estateId ?? "")),
        loginIdentifier: target.phone || resetEmail,
        temporaryPassword: password,
        heading: "Your Corso password was reset",
        intro: "Your estate administrator has reset your Corso password."
      });
      resetEmailNote = emailResult.sent ? ` A copy was also emailed to ${resetEmail}.` : "";
    }

    return {
      message: `${target.fullName ?? "This user's"} password has been reset. Give the temporary password privately.${resetEmailNote}`,
      temporaryPassword: password,
      loginIdentifier: target.phone || resetEmail,
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
  // Only push the phone to Appwrite Auth when it actually changed —
  // re-applying the same number trips Appwrite's duplicate-target check.
  if (appwritePhone(phone) !== appwritePhone(String(target.phone ?? ""))) {
    try {
      await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/phone`, {
        method: "PATCH",
        body: { number: appwritePhone(phone) }
      });
    } catch (error) {
      if (!(error instanceof AppwriteRestError && error.status === 409)) {
        throw error;
      }
    }
  }
  await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: { status: active }
  });
  await updateUserPrefs(userId, {
    fullName,
    phone,
    role,
    estateId,
    estateName: estateDisplayName(role, estateId),
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

export async function deleteAppwriteManagedUser(profileId: string, scope: AppwriteEstateScope = {}) {
  const target = await getProfileRow(profileId, scope);
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
  const session = await createEmailSession(email, password);
  if (!session.secret) {
    throw new Error("Appwrite did not return a session secret for this login.");
  }
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
    appwriteUserId: user.$id,
    appwriteSessionSecret: session.secret
  };
}

async function createEmailSession(email: string, password: string) {
  const config = getAppwriteServerConfig();
  if (!config.projectId) {
    throw new Error("Appwrite server configuration is missing: NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  }

  const response = await fetch(`${config.endpoint}/account/sessions/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Response-Format": "1.9.5"
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as AppwriteSession | Record<string, unknown> | null;

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message)
      : `Appwrite request failed with HTTP ${response.status}`;
    throw new AppwriteRestError(`${message} (POST /account/sessions/email)`, response.status, payload);
  }

  const session = payload as AppwriteSession;
  return {
    ...session,
    secret: session.secret || sessionSecretFromSetCookie(response.headers.get("set-cookie"), config.projectId)
  };
}

function sessionSecretFromSetCookie(header: string | null, projectId: string) {
  if (!header) {
    return "";
  }

  const escapedProjectId = projectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...header.matchAll(new RegExp(`a_session_${escapedProjectId}(?:_legacy)?=([^;]+)`, "g"))];
  for (const match of matches.reverse()) {
    const encoded = match[1];
    try {
      const decoded = decodeURIComponent(encoded);
      if (decoded.trim()) {
        return decoded.trim();
      }
    } catch {
      // Try the next matching cookie value.
    }
  }

  return "";
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

async function findAuthUserByEmailOrPhone(email: string, phone: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = normalizePhoneNumber(phone);
  const searches = [normalizedEmail, normalizedPhone].filter(Boolean);

  for (const search of searches) {
    const payload = await appwriteRequest<AppwriteUserList>(`/users?search=${encodeURIComponent(search)}`);
    const user = (payload.users ?? []).find((item) =>
      (!!normalizedEmail && String(item.email ?? "").trim().toLowerCase() === normalizedEmail) ||
      (!!normalizedPhone && normalizePhoneNumber(item.phone ?? "") === normalizedPhone)
    );

    if (user) {
      return user;
    }
  }

  return undefined;
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
      throw new Error("This email or phone already exists in Corso. Use another login contact or reset that user's password.");
    }

    throw error;
  }
}

async function getAuthUser(userId: string) {
  return appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`);
}

async function getProfileRow(profileId: string, scope: AppwriteEstateScope = {}) {
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

  assertEstateScope(row.estateId, scope, "The selected user profile does not belong to your estate.");
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
  const existingResident = await findExistingResidentForLogin(input, unitId);
  const residentId = existingResident?.$id ?? safeAppwriteId("res", `${input.email}:${input.phone}:${input.unitCode}`);

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
    estateId: existingResident?.estateId ?? input.estateId,
    propertyId: existingResident?.propertyId ?? propertyId,
    unitId: existingResident?.unitId ?? unitId,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    residentType: existingResident?.residentType ?? "tenant",
    status: existingResident?.status ?? "active",
    moveInDate: existingResident?.moveInDate ?? input.now.slice(0, 10),
    legacyName: existingResident?.legacyName ?? "",
    legacyAddress: existingResident?.legacyAddress ?? "",
    sourceRow: existingResident?.sourceRow,
    openingOutstanding: existingResident?.openingOutstanding ?? 0,
    expectedMonthly: existingResident?.expectedMonthly ?? 0,
    onboardingStatus: existingResident?.onboardingStatus ?? "verified",
    reviewReasons: existingResident?.reviewReasons ?? "",
    createdAt: existingResident?.createdAt ?? input.now,
    updatedAt: input.now,
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

async function findExistingResidentForLogin(
  input: {
    fullName: string;
    email: string;
    phone: string;
    estateId: string;
    unitCode: string;
  },
  unitId: string
) {
  const normalizedPhone = normalizePhoneNumber(input.phone);
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedFullName = normalizeName(input.fullName);
  const residents = await listAppwriteTableRows<AppwriteResidentRow>("residents", { estateId: input.estateId });

  return residents.find((resident) => {
    const sameUnit = resident.unitId === unitId;
    const samePhone = Boolean(normalizedPhone) && normalizePhoneNumber(resident.phone ?? "") === normalizedPhone;
    const sameEmail = Boolean(normalizedEmail) && String(resident.email ?? "").trim().toLowerCase() === normalizedEmail;
    const sameName = Boolean(normalizedFullName) && normalizeName(resident.fullName ?? "") === normalizedFullName;

    return sameUnit && (samePhone || sameEmail || sameName);
  }) ?? residents.find((resident) => {
    const samePhone = Boolean(normalizedPhone) && normalizePhoneNumber(resident.phone ?? "") === normalizedPhone;
    const sameEmail = Boolean(normalizedEmail) && String(resident.email ?? "").trim().toLowerCase() === normalizedEmail;

    return samePhone || sameEmail;
  });
}

// Estates that user accounts may be assigned to. Everything else falls back
// to the primary estate so junk/legacy form values cannot orphan a user.
// TODO(multi-estate): validate against the live estates table instead.
const ASSIGNABLE_ESTATE_IDS = new Set([APPWRITE_LBSVIEW_ESTATE_ID, "platform", "corso-demo-estate"]);

function canonicalEstateId(estateId: string) {
  return ASSIGNABLE_ESTATE_IDS.has(estateId) ? estateId : APPWRITE_LBSVIEW_ESTATE_ID;
}

function assertEstateScope(rowEstateId: string | undefined, scope: AppwriteEstateScope, message: string) {
  if (scope.includeAllEstates) {
    return;
  }

  const estateId = String(scope.estateId ?? "").trim();
  if (estateId && rowEstateId !== estateId) {
    throw new Error(message);
  }
}

function normalizeUnitCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
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
    estate: estateDisplayName(row.role ?? "resident", row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID),
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
  return typeof value === "string" && ["super_admin", "estate_admin", "cso", "resident", "security_guard", "vendor"].includes(value);
}
