import type { NextRequest } from "next/server";
import type { UserRole } from "@/lib/types";
import { APPWRITE_TABLE_PROFILES } from "@/lib/appwrite/schema";
import { appwriteRequest, getAppwriteServerConfig } from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: boolean;
};

type AppwriteProfileRow = {
  $id?: string;
  userId?: string;
  estateId?: string;
  role?: string;
  status?: string;
};

type AppwriteRowList<T> = {
  rows?: T[];
  documents?: T[];
  total?: number;
};

export type SessionContext = {
  userId: string;
  profileId: string;
  role: UserRole;
  estateId: string;
};

export type ResolveSessionContextOptions = {
  allowedRoles?: readonly UserRole[];
  requireEstate?: boolean;
};

const validRoles = new Set<UserRole>([
  "super_admin",
  "estate_admin",
  "cso",
  "resident",
  "security_guard",
  "vendor"
]);

export class SessionContextError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SessionContextError";
    this.status = status;
  }
}

export async function resolveSessionContext(
  request: NextRequest,
  options: ResolveSessionContextOptions = {}
): Promise<SessionContext> {
  const sessionSecret = request.cookies.get("corso_appwrite_session")?.value.trim() ?? "";
  if (!sessionSecret) {
    throw new SessionContextError("Authenticated Appwrite session is required.", 401);
  }

  const user = await appwriteRequest<AppwriteUser>("/account", {
    requireApiKey: false,
    sessionSecret
  });
  if (user.status === false) {
    throw new SessionContextError("This Appwrite user is inactive.", 403);
  }

  const profile = await findProfileByUserId(user.$id);
  if (!profile?.$id) {
    throw new SessionContextError("Authenticated user profile was not found.", 403);
  }

  if (profile.status === "inactive") {
    throw new SessionContextError("This user profile is inactive.", 403);
  }

  const role = normalizeRole(profile.role);
  if (!role) {
    throw new SessionContextError("Authenticated user profile has no valid role.", 403);
  }

  const estateId = normalizeEstateId(role, profile.estateId);
  if ((options.requireEstate ?? true) && !estateId) {
    throw new SessionContextError("Authenticated user profile has no estate assignment.", 403);
  }

  if (options.allowedRoles?.length && !options.allowedRoles.includes(role)) {
    throw new SessionContextError("You do not have permission to access this resource.", 403);
  }

  return {
    userId: user.$id,
    profileId: profile.$id,
    role,
    estateId
  };
}

async function findProfileByUserId(userId: string) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  const query = new URLSearchParams();
  query.append("queries[0]", JSON.stringify({ method: "equal", attribute: "userId", values: [userId] }));
  query.append("queries[1]", JSON.stringify({ method: "limit", values: [1] }));

  try {
    const payload = await appwriteRequest<AppwriteRowList<AppwriteProfileRow>>(
      `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_PROFILES}/rows?${query.toString()}`
    );
    const rows = payload.rows ?? payload.documents ?? [];
    return rows[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("invalid query")) {
      return (await listAppwriteTableRows<AppwriteProfileRow>(APPWRITE_TABLE_PROFILES))
        .find((profile) => profile.userId === userId) ?? null;
    }

    throw error;
  }
}

function normalizeRole(role: unknown): UserRole | null {
  return typeof role === "string" && validRoles.has(role as UserRole) ? role as UserRole : null;
}

function normalizeEstateId(role: UserRole, estateId: unknown) {
  const value = typeof estateId === "string" ? estateId.trim() : "";
  return value || (role === "super_admin" ? "platform" : "");
}
