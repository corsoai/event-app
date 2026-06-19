import type { UserRole } from "@/lib/types";
import { DEMO_PASSWORD, getPasswordQualityError } from "@/lib/password-policy";
import { DEFAULT_ESTATE_NAME, normalizePhoneNumber, phoneAuthEmail } from "@/lib/utils";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  AppwriteRestError,
  appwriteRequest,
  appwriteUpsertRow,
  safeAppwriteId,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";

export type AppwriteAccessRequestStatus = "pending" | "approved" | "rejected";

export type AppwriteAccessRequestView = {
  id: string;
  auth_user_id: string | null;
  estate_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  requested_role: UserRole;
  status: AppwriteAccessRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
  estates: { name: string } | null;
};

type AppwriteAccessRequestRow = {
  $id?: string;
  estateId?: string;
  authUserId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  requestedRole?: UserRole;
  status?: AppwriteAccessRequestStatus;
  requestedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  estateName?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AppwriteEstateRow = {
  $id?: string;
  name?: string;
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

type AppwriteUser = {
  $id: string;
  email?: string;
  phone?: string;
};

type AppwriteUserList = {
  users?: AppwriteUser[];
};

const publicRequestRoles = new Set<UserRole>(["resident"]);

export async function submitAppwriteAccessRequest(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  estate: string;
  estateId?: string;
}) {
  const fullName = input.fullName.trim();
  const phone = normalizePhoneNumber(input.phone);
  const optionalEmail = input.email.trim().toLowerCase();
  const email = phoneAuthEmail(phone);
  const password = input.password.trim();
  const role = input.role;
  const now = new Date().toISOString();

  if (!fullName || !phone) {
    throw new Error("Full name and phone number are required.");
  }
  if (phone.length < 10) {
    throw new Error("Enter a valid phone number.");
  }
  if (optionalEmail && !optionalEmail.includes("@")) {
    throw new Error("Enter a valid email address or leave email empty.");
  }
  const passwordError = getPasswordQualityError(password);
  if (passwordError) {
    throw new Error(passwordError);
  }
  if (!publicRequestRoles.has(role)) {
    throw new Error("Residents should request access here. Admin can create other roles after login.");
  }

  await setupAppwriteOnboardingSchema();
  const estate = await resolveEstate(input.estateId, input.estate);
  const profiles = await listAppwriteTableRows<AppwriteProfileRow>("profiles");
  const existingProfile = profiles.find((profile) =>
    profile.status === "active" &&
    (normalizePhoneNumber(profile.phone ?? "") === phone || profile.email === email || profile.email === optionalEmail)
  );

  if (existingProfile) {
    return {
      status: "already-approved" as const,
      estateId: estate.id,
      estateName: estate.name,
      message: "This phone number is already approved. Go back to login and sign in."
    };
  }

  const existingPending = (await listAppwriteTableRows<AppwriteAccessRequestRow>("access_requests"))
    .filter((request) => request.status === "pending")
    .find((request) => normalizePhoneNumber(request.phone ?? "") === phone || request.email === email);
  const authUser = await findOrCreatePendingAuthUser({
    fullName,
    email,
    phone,
    password,
    role,
    estateId: estate.id,
    estateName: estate.name,
    existingAuthUserId: existingPending?.authUserId
  });
  const rowId = existingPending?.$id ?? safeAppwriteId("access", `${estate.id}:${phone}`);

  await appwriteUpsertRow<AppwriteAccessRequestRow>("access_requests", rowId, {
    estateId: estate.id,
    authUserId: authUser.$id,
    fullName,
    email,
    phone,
    requestedRole: role,
    status: "pending",
    requestedAt: now,
    estateName: estate.name,
    createdAt: existingPending?.createdAt ?? now,
    updatedAt: now
  });

  return {
    status: existingPending ? "already-pending" as const : "created" as const,
    estateId: estate.id,
    estateName: estate.name,
    message: existingPending
      ? `This phone number already has a pending access request for ${estate.name}. Ask admin to approve it.`
      : `Access request submitted to ${estate.name}. An estate admin must approve this account before login.`
  };
}

export async function listAppwriteAccessRequests(options: { adminRole?: string; estateId?: string | null } = {}) {
  await setupAppwriteOnboardingSchema();
  const scope = accessRequestScope(options);
  const requests = await listAppwriteTableRows<AppwriteAccessRequestRow>("access_requests", scope);
  const estates = await listAppwriteTableRows<AppwriteEstateRow>("estates").catch(() => []);
  const estateNames = new Map(estates.map((estate) => [estate.$id ?? "", estate.name ?? DEFAULT_ESTATE_NAME]));

  return requests
    .filter((request) => request.status === "pending")
    .map((request) => mapAccessRequestRow(request, estateNames.get(request.estateId ?? "")))
    .sort((left, right) => right.requested_at.localeCompare(left.requested_at));
}

export async function reviewAppwriteAccessRequest(input: {
  requestId: string;
  action: "approve" | "reject";
  reviewerUserId: string;
  adminRole: string;
  adminEstateId?: string | null;
}) {
  const scope = accessRequestScope({ adminRole: input.adminRole, estateId: input.adminEstateId });
  const row = (await listAppwriteTableRows<AppwriteAccessRequestRow>("access_requests", scope))
    .find((request) => request.$id === input.requestId);

  if (!row || row.status !== "pending") {
    return {
      message: "This access request has already been reviewed and removed from the approval queue.",
      requests: await listAppwriteAccessRequests({ adminRole: input.adminRole, estateId: input.adminEstateId })
    };
  }

  if (input.adminRole !== "super_admin" && row.estateId !== input.adminEstateId) {
    throw new Error("Estate admins can only manage access requests for their assigned estate.");
  }

  const reviewedAt = new Date().toISOString();
  if (input.action === "reject") {
    await appwriteUpsertRow<AppwriteAccessRequestRow>("access_requests", input.requestId, {
      ...row,
      status: "rejected",
      reviewedAt,
      reviewedBy: input.reviewerUserId,
      updatedAt: reviewedAt
    });
    if (row.authUserId) {
      await appwriteRequest(`/users/${encodeURIComponent(row.authUserId)}/status`, {
        method: "PATCH",
        body: { status: false }
      }).catch(() => null);
    }

    return {
      message: `${row.fullName ?? "Resident"}'s access request has been rejected.`,
      requests: await listAppwriteAccessRequests({ adminRole: input.adminRole, estateId: input.adminEstateId })
    };
  }

  if (!row.authUserId) {
    throw new Error("This request is missing its login account. Ask the resident to submit a fresh access request.");
  }

  await activatePendingUser(row.authUserId, row, reviewedAt);
  await appwriteUpsertRow<AppwriteAccessRequestRow>("access_requests", input.requestId, {
    ...row,
    status: "approved",
    reviewedAt,
    reviewedBy: input.reviewerUserId,
    updatedAt: reviewedAt
  });

  return {
    message: `${row.fullName ?? "Resident"}'s access request has been approved.`,
    requests: await listAppwriteAccessRequests({ adminRole: input.adminRole, estateId: input.adminEstateId })
  };
}

function accessRequestScope(options: { adminRole?: string; estateId?: string | null }): AppwriteEstateScope {
  return options.adminRole === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: options.estateId ?? "" };
}

export async function readAppwriteAccessRequestStatus(identifier: string) {
  const phone = normalizePhoneNumber(identifier);
  const email = identifier.trim().toLowerCase().includes("@") ? identifier.trim().toLowerCase() : phoneAuthEmail(phone);
  const requests = await listAppwriteTableRows<AppwriteAccessRequestRow>("access_requests").catch(() => []);
  const latest = requests
    .filter((request) => request.email === email || normalizePhoneNumber(request.phone ?? "") === phone)
    .sort((left, right) => String(right.requestedAt ?? "").localeCompare(String(left.requestedAt ?? "")))[0];

  return latest?.status ? { status: latest.status } : null;
}

async function resolveEstate(estateId?: string, estateName?: string) {
  await appwriteUpsertRow<AppwriteEstateRow>("estates", APPWRITE_LBSVIEW_ESTATE_ID, {
    name: DEFAULT_ESTATE_NAME,
    address: "LBS View Estate, Lagos",
    contactEmail: "admin@lbsviewestate.example",
    contactPhone: "+2348011112040",
    gateName: "Main Gate",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const estates = await listAppwriteTableRows<AppwriteEstateRow>("estates");
  const normalizedName = estateName?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  const selected = estates.find((estate) => estate.$id === estateId)
    ?? estates.find((estate) => String(estate.name ?? "").trim().toLowerCase().replace(/\s+/g, " ") === normalizedName)
    ?? estates.find((estate) => estate.$id === APPWRITE_LBSVIEW_ESTATE_ID)
    ?? estates[0];

  if (!selected?.$id) {
    throw new Error("No estate has been created yet. Create an estate before residents request access.");
  }

  return {
    id: selected.$id,
    name: selected.name ?? DEFAULT_ESTATE_NAME
  };
}

async function findOrCreatePendingAuthUser(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  estateId: string;
  estateName: string;
  existingAuthUserId?: string;
}) {
  const existing = input.existingAuthUserId
    ? await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(input.existingAuthUserId)}`, {
        allowNotFound: true
      }).catch(() => null)
    : await findAuthUser(input.email, input.phone);
  const user = existing ?? await appwriteRequest<AppwriteUser>("/users", {
    method: "POST",
    body: {
      userId: safeAppwriteId("usr", input.email || input.phone),
      email: input.email,
      phone: appwritePhone(input.phone),
      password: input.password,
      name: input.fullName.slice(0, 128)
    }
  });

  await appwriteRequest(`/users/${encodeURIComponent(user.$id)}/password`, {
    method: "PATCH",
    body: { password: input.password }
  }).catch((error) => {
    if (input.password !== DEMO_PASSWORD) {
      throw error;
    }
  });
  await appwriteRequest(`/users/${encodeURIComponent(user.$id)}/prefs`, {
    method: "PATCH",
    body: {
      prefs: {
        fullName: input.fullName,
        phone: input.phone,
        role: input.role,
        estateId: input.estateId,
        estateName: input.estateName,
        loginIdentifier: input.phone,
        accessStatus: "pending"
      }
    }
  });
  await appwriteRequest(`/users/${encodeURIComponent(user.$id)}/status`, {
    method: "PATCH",
    body: { status: false }
  });

  return user;
}

async function activatePendingUser(userId: string, request: AppwriteAccessRequestRow, now: string) {
  const estateId = request.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID;
  const role = request.requestedRole ?? "resident";
  const fullName = request.fullName ?? "Resident";
  const email = request.email ?? "";
  const phone = request.phone ?? "";

  await appwriteRequest(`/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: { status: true }
  });
  await appwriteRequest(`/users/${encodeURIComponent(userId)}/prefs`, {
    method: "PATCH",
    body: {
      prefs: {
        fullName,
        phone,
        role,
        estateId,
        estateName: request.estateName ?? DEFAULT_ESTATE_NAME,
        loginIdentifier: phone || email,
        accessStatus: "approved"
      }
    }
  });

  const profileId = safeAppwriteId("profile", userId);
  await appwriteUpsertRow<AppwriteProfileRow>("profiles", profileId, {
    estateId,
    userId,
    fullName,
    email,
    phone,
    role,
    status: "active",
    houseNumber: "",
    createdAt: now,
    updatedAt: now
  });

  if (role === "resident") {
    const residentId = safeAppwriteId("res", `${email}:${phone}:${fullName}`);
    await appwriteUpsertRow("residents", residentId, {
      estateId,
      fullName,
      phone,
      email,
      residentType: "tenant",
      status: "active",
      moveInDate: now.slice(0, 10),
      openingOutstanding: 0,
      expectedMonthly: 0,
      onboardingStatus: "needs_review",
      reviewReasons: "Resident requested access before property/unit assignment.",
      createdAt: now,
      updatedAt: now
    });
  }
}

async function findAuthUser(email: string, phone: string) {
  const searches = [email, normalizePhoneNumber(phone)].filter(Boolean);
  for (const search of searches) {
    const payload = await appwriteRequest<AppwriteUserList>(`/users?search=${encodeURIComponent(search)}`);
    const user = (payload.users ?? []).find((item) =>
      item.email === email || normalizePhoneNumber(item.phone ?? "") === normalizePhoneNumber(phone)
    );
    if (user) {
      return user;
    }
  }

  return null;
}

function mapAccessRequestRow(row: AppwriteAccessRequestRow, estateName?: string): AppwriteAccessRequestView {
  return {
    id: row.$id ?? "",
    auth_user_id: row.authUserId ?? null,
    estate_id: row.estateId ?? null,
    full_name: row.fullName ?? "",
    email: row.email ?? "",
    phone: row.phone ?? null,
    requested_role: row.requestedRole ?? "resident",
    status: row.status ?? "pending",
    requested_at: row.requestedAt ?? row.createdAt ?? "",
    reviewed_at: row.reviewedAt ?? null,
    estates: { name: row.estateName ?? estateName ?? DEFAULT_ESTATE_NAME }
  };
}

function appwritePhone(phone: string) {
  const digits = normalizePhoneNumber(phone);
  return digits ? `+${digits}` : undefined;
}

export function accessRequestErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof AppwriteRestError ? error.status : 400;
  return { message, status };
}
