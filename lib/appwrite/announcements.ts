import type { AppwriteAnnouncement, UserRole } from "@/lib/types";
import {
  APPWRITE_TABLE_ANNOUNCEMENTS,
  APPWRITE_TABLE_AUDIT_LOGS,
  APPWRITE_TABLE_PROFILES
} from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

type AnnouncementPriority = AppwriteAnnouncement["priority"];
type AnnouncementTargetRole = AppwriteAnnouncement["targetRole"];
type AnnouncementStatus = AppwriteAnnouncement["status"];

type AppwriteAnnouncementRow = {
  $id?: string;
  estateId?: string;
  title?: string;
  message?: string;
  priority?: string;
  targetRole?: string;
  createdBy?: string;
  createdByName?: string;
  publishedAt?: string;
  expiresAt?: string;
  status?: string;
  isPinned?: boolean;
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
  status?: string;
};

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  prefs?: Record<string, unknown>;
};

type AnnouncementActor = {
  profileId: string;
  fullName: string;
  estateId: string;
};

export type AnnouncementInput = {
  title: string;
  message: string;
  priority: AnnouncementPriority;
  targetRole: AnnouncementTargetRole;
  status: AnnouncementStatus;
  expiresAt?: string;
  isPinned?: boolean;
};

export type AnnouncementUpdateInput = Partial<AnnouncementInput>;

export async function resolveAnnouncementActor(userId: string, role: string): Promise<AnnouncementActor> {
  if (!userId) {
    throw new Error("Authenticated Appwrite user is required.");
  }

  const [user, profiles] = await Promise.all([
    appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`),
    listAppwriteTableRows<AppwriteProfileRow>(APPWRITE_TABLE_PROFILES)
  ]);
  const profile = profiles.find((item) => item.userId === userId);
  const prefs = user.prefs ?? {};
  const fullName = profile?.fullName
    ?? stringPref(prefs.fullName)
    ?? user.name
    ?? user.email
    ?? "Estate admin";
  const estateId = role === "super_admin"
    ? (profile?.estateId || stringPref(prefs.estateId) || APPWRITE_LBSVIEW_ESTATE_ID)
    : (profile?.estateId || stringPref(prefs.estateId) || APPWRITE_LBSVIEW_ESTATE_ID);

  return {
    profileId: profile?.$id ?? userId,
    fullName,
    estateId
  };
}

export async function listAdminAnnouncements(options: { status?: string } = {}) {
  const rows = await listAnnouncementRows();
  const status = options.status ? normalizeStatus(options.status) : null;

  return rows
    .map(mapAnnouncementRow)
    .filter((announcement) => announcement.estateId === APPWRITE_LBSVIEW_ESTATE_ID)
    .filter((announcement) => !status || announcement.status === status)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createAnnouncement(input: AnnouncementInput, actor: AnnouncementActor) {
  const validated = validateAnnouncementInput(input);
  const now = new Date().toISOString();
  const announcementId = safeAppwriteId("ann", `${actor.estateId}:${validated.title}:${now}`);
  const publishedAt = validated.status === "published" ? now : undefined;

  const row = await appwriteUpsertRow<AppwriteAnnouncementRow>(APPWRITE_TABLE_ANNOUNCEMENTS, announcementId, {
    estateId: actor.estateId,
    title: validated.title,
    message: validated.message,
    priority: validated.priority,
    targetRole: validated.targetRole,
    createdBy: actor.profileId,
    createdByName: actor.fullName,
    publishedAt,
    expiresAt: optionalDateString(validated.expiresAt),
    status: validated.status,
    isPinned: Boolean(validated.isPinned),
    createdAt: now,
    updatedAt: now
  });

  const announcement = mapAnnouncementRow(row);
  await writeAnnouncementAudit(actor, "created announcement", announcement.id, {
    title: announcement.title,
    status: announcement.status,
    targetRole: announcement.targetRole
  });

  return announcement;
}

export async function updateAnnouncement(announcementId: string, input: AnnouncementUpdateInput, actor: AnnouncementActor) {
  const id = announcementId.trim();
  if (!id) {
    throw new Error("Announcement ID is required.");
  }

  const existing = await getAnnouncementRow(id);
  const now = new Date().toISOString();
  const nextStatus = input.status ? normalizeStatus(input.status) : normalizeStatus(existing.status ?? "draft");
  const shouldPublish = nextStatus === "published" && !existing.publishedAt;
  const payload = buildUpdatePayload(input, existing, now, shouldPublish);
  const row = await appwriteUpsertRow<AppwriteAnnouncementRow>(APPWRITE_TABLE_ANNOUNCEMENTS, id, payload);
  const announcement = mapAnnouncementRow(row);

  await writeAnnouncementAudit(actor, "updated announcement", announcement.id, {
    title: announcement.title,
    status: announcement.status
  });

  return announcement;
}

export async function archiveAnnouncement(announcementId: string, actor: AnnouncementActor) {
  const id = announcementId.trim();
  if (!id) {
    throw new Error("Announcement ID is required.");
  }

  const existing = await getAnnouncementRow(id);
  const now = new Date().toISOString();
  const row = await appwriteUpsertRow<AppwriteAnnouncementRow>(APPWRITE_TABLE_ANNOUNCEMENTS, id, {
    ...existing,
    status: "archived",
    updatedAt: now
  });
  const announcement = mapAnnouncementRow(row);

  await writeAnnouncementAudit(actor, "archived announcement", announcement.id, {
    title: announcement.title,
    previousStatus: existing.status ?? ""
  });

  return announcement;
}

export async function listResidentAnnouncements() {
  const now = Date.now();

  return (await listAnnouncementRows())
    .map(mapAnnouncementRow)
    .filter((announcement) => announcement.estateId === APPWRITE_LBSVIEW_ESTATE_ID)
    .filter((announcement) => announcement.status === "published")
    .filter((announcement) => announcement.targetRole === "all" || announcement.targetRole === "resident")
    .filter((announcement) => !announcement.expiresAt || Date.parse(announcement.expiresAt) >= now)
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      return (right.publishedAt ?? right.createdAt).localeCompare(left.publishedAt ?? left.createdAt);
    });
}

async function listAnnouncementRows() {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return listAppwriteTableRows<AppwriteAnnouncementRow>(APPWRITE_TABLE_ANNOUNCEMENTS);
}

async function getAnnouncementRow(announcementId: string) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return appwriteRequest<AppwriteAnnouncementRow>(
    `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_ANNOUNCEMENTS}/rows/${encodeURIComponent(announcementId)}`,
    { method: "GET" }
  );
}

function buildUpdatePayload(
  input: AnnouncementUpdateInput,
  existing: AppwriteAnnouncementRow,
  now: string,
  shouldPublish: boolean
): AppwriteAnnouncementRow {
  return {
    ...existing,
    title: input.title === undefined ? existing.title : requiredText(input.title, "Title"),
    message: input.message === undefined ? existing.message : requiredText(input.message, "Message"),
    priority: input.priority === undefined ? existing.priority : normalizePriority(input.priority),
    targetRole: input.targetRole === undefined ? existing.targetRole : normalizeTargetRole(input.targetRole),
    status: input.status === undefined ? existing.status : normalizeStatus(input.status),
    expiresAt: input.expiresAt === undefined ? existing.expiresAt : optionalDateString(input.expiresAt),
    isPinned: input.isPinned === undefined ? Boolean(existing.isPinned) : Boolean(input.isPinned),
    publishedAt: shouldPublish ? now : existing.publishedAt,
    updatedAt: now
  };
}

function validateAnnouncementInput(input: AnnouncementInput): AnnouncementInput {
  return {
    title: requiredText(input.title, "Title"),
    message: requiredText(input.message, "Message"),
    priority: normalizePriority(input.priority),
    targetRole: normalizeTargetRole(input.targetRole),
    status: normalizeStatus(input.status),
    expiresAt: optionalDateString(input.expiresAt),
    isPinned: Boolean(input.isPinned)
  };
}

function mapAnnouncementRow(row: AppwriteAnnouncementRow): AppwriteAnnouncement {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    title: row.title ?? "Untitled announcement",
    message: row.message ?? "",
    priority: normalizePriority(row.priority ?? "normal"),
    targetRole: normalizeTargetRole(row.targetRole ?? "all"),
    createdBy: row.createdBy ?? "",
    createdByName: row.createdByName ?? "Estate admin",
    publishedAt: optionalText(row.publishedAt),
    expiresAt: optionalText(row.expiresAt),
    status: normalizeStatus(row.status ?? "draft"),
    isPinned: Boolean(row.isPinned),
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? ""
  };
}

async function writeAnnouncementAudit(
  actor: AnnouncementActor,
  action: string,
  announcementId: string,
  metadata: Record<string, string | number | boolean>
) {
  const now = new Date().toISOString();
  await appwriteUpsertRow(APPWRITE_TABLE_AUDIT_LOGS, safeAppwriteId("audit", `${action}:${announcementId}:${now}`), {
    estateId: actor.estateId,
    actor: actor.fullName,
    action,
    entityType: "announcement",
    entityId: announcementId,
    metadata: JSON.stringify(metadata),
    createdAt: now
  });
}

function requiredText(value: string, label: string) {
  const text = value.trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function normalizePriority(value: string): AnnouncementPriority {
  if (value === "low" || value === "normal" || value === "high" || value === "urgent") {
    return value;
  }

  return "normal";
}

function normalizeTargetRole(value: string): AnnouncementTargetRole {
  if (value === "all" || value === "resident" || value === "security" || value === "cso") {
    return value;
  }

  return "all";
}

function normalizeStatus(value: string): AnnouncementStatus {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  return "draft";
}

function optionalDateString(value?: string) {
  const text = optionalText(value);
  if (!text) {
    return undefined;
  }

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    throw new Error("Enter a valid expiry date.");
  }

  return text.includes("T") ? text : new Date(`${text}T00:00:00.000Z`).toISOString();
}

function optionalText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function stringPref(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
