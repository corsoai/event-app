import type { AppwriteKnowledgeBaseArticle, UserRole } from "@/lib/types";
import {
  APPWRITE_TABLE_AUDIT_LOGS,
  APPWRITE_TABLE_KNOWLEDGE_BASE,
  APPWRITE_TABLE_PROFILES
} from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";
import type { SessionContext } from "@/lib/appwrite/session-context";

type KnowledgeCategory = AppwriteKnowledgeBaseArticle["category"];
type KnowledgeTargetRole = AppwriteKnowledgeBaseArticle["targetRole"];

type KnowledgeRow = {
  $id?: string;
  estateId?: string;
  title?: string;
  content?: string;
  category?: string;
  targetRole?: string;
  createdBy?: string;
  createdByName?: string;
  isPublished?: boolean;
  viewCount?: number;
  sortOrder?: number;
  tags?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ProfileRow = {
  $id?: string;
  userId?: string;
  estateId?: string;
  fullName?: string;
  role?: UserRole;
};

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  prefs?: Record<string, unknown>;
};

type KnowledgeActor = {
  profileId: string;
  fullName: string;
  estateId: string;
  role: UserRole;
};

type VerifiedKnowledgeContext = Pick<SessionContext, "userId" | "profileId" | "role" | "estateId">;

export type KnowledgeFilters = {
  category?: string;
  isPublished?: string;
  search?: string;
};

export type KnowledgeInput = {
  title: string;
  content: string;
  category: KnowledgeCategory;
  targetRole: KnowledgeTargetRole;
  tags?: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export type KnowledgeUpdateInput = Partial<KnowledgeInput>;

export async function resolveKnowledgeActor(input: string | VerifiedKnowledgeContext, role?: string): Promise<KnowledgeActor> {
  const userId = typeof input === "string" ? input : input.userId;
  const verifiedRole = (typeof input === "string" ? role : input.role) as UserRole | undefined;
  const [user, profiles] = await Promise.all([
    appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`),
    listAppwriteTableRows<ProfileRow>(APPWRITE_TABLE_PROFILES)
  ]);
  const profile = profiles.find((item) => item.userId === userId);
  const prefs = user.prefs ?? {};

  return {
    profileId: typeof input === "string" ? profile?.$id ?? userId : input.profileId,
    fullName: profile?.fullName ?? stringPref(prefs.fullName) ?? user.name ?? user.email ?? "Estate admin",
    estateId: typeof input === "string"
      ? (profile?.estateId || stringPref(prefs.estateId) || APPWRITE_LBSVIEW_ESTATE_ID)
      : input.estateId,
    role: verifiedRole ?? profile?.role ?? "resident"
  };
}

export async function listAdminKnowledgeArticles(filters: KnowledgeFilters = {}, scope: AppwriteEstateScope = {}) {
  const category = filters.category ? normalizeCategory(filters.category) : null;
  const published = filters.isPublished === undefined || filters.isPublished === ""
    ? null
    : filters.isPublished === "true";
  const search = filters.search?.trim().toLowerCase() ?? "";

  return (await listKnowledgeRows(scope))
    .map(mapKnowledgeRow)
    .filter((article) => !category || article.category === category)
    .filter((article) => published === null || article.isPublished === published)
    .filter((article) => {
      if (!search) return true;
      return article.title.toLowerCase().includes(search) || (article.tags ?? "").toLowerCase().includes(search);
    })
    .sort(sortKnowledgeArticles);
}

export async function createKnowledgeArticle(input: KnowledgeInput, actor: KnowledgeActor) {
  const now = new Date().toISOString();
  const articleId = safeAppwriteId("kb", `${actor.estateId}:${input.title}:${now}`);
  const row = await appwriteUpsertRow<KnowledgeRow>(APPWRITE_TABLE_KNOWLEDGE_BASE, articleId, {
    estateId: actor.estateId,
    title: requiredText(input.title, "Title"),
    content: requiredText(input.content, "Content"),
    category: normalizeCategory(input.category),
    targetRole: normalizeTargetRole(input.targetRole),
    createdBy: actor.profileId,
    createdByName: actor.fullName,
    isPublished: Boolean(input.isPublished),
    viewCount: 0,
    sortOrder: numberOrZero(input.sortOrder),
    tags: input.tags?.trim() ?? "",
    createdAt: now,
    updatedAt: now
  });
  const article = mapKnowledgeRow(row);
  await writeKnowledgeAudit(actor, "created knowledge article", article.id, { title: article.title });
  return article;
}

export async function updateKnowledgeArticle(articleId: string, input: KnowledgeUpdateInput, actor: KnowledgeActor) {
  const existing = await getKnowledgeRow(articleId);
  assertActorCanAccessKnowledge(actor, existing);
  const now = new Date().toISOString();
  const row = await appwriteUpsertRow<KnowledgeRow>(APPWRITE_TABLE_KNOWLEDGE_BASE, articleId, {
    estateId: existing.estateId ?? actor.estateId,
    title: input.title === undefined ? existing.title : requiredText(input.title, "Title"),
    content: input.content === undefined ? existing.content : requiredText(input.content, "Content"),
    category: input.category === undefined ? existing.category : normalizeCategory(input.category),
    targetRole: input.targetRole === undefined ? existing.targetRole : normalizeTargetRole(input.targetRole),
    createdBy: existing.createdBy ?? actor.profileId,
    createdByName: existing.createdByName ?? actor.fullName,
    isPublished: input.isPublished === undefined ? Boolean(existing.isPublished) : Boolean(input.isPublished),
    viewCount: numberOrZero(existing.viewCount),
    sortOrder: input.sortOrder === undefined ? numberOrZero(existing.sortOrder) : numberOrZero(input.sortOrder),
    tags: input.tags === undefined ? existing.tags ?? "" : input.tags.trim(),
    createdAt: existing.createdAt ?? now,
    updatedAt: now
  });
  const article = mapKnowledgeRow(row);
  await writeKnowledgeAudit(actor, "updated knowledge article", article.id, { title: article.title });
  return article;
}

export async function softDeleteKnowledgeArticle(articleId: string, actor: KnowledgeActor) {
  const existing = await getKnowledgeRow(articleId);
  assertActorCanAccessKnowledge(actor, existing);
  const now = new Date().toISOString();
  const deletedTags = appendTag(existing.tags ?? "", "deleted");
  const row = await appwriteUpsertRow<KnowledgeRow>(APPWRITE_TABLE_KNOWLEDGE_BASE, articleId, {
    estateId: existing.estateId ?? actor.estateId,
    title: existing.title ?? "Untitled article",
    content: existing.content ?? "",
    category: normalizeCategory(existing.category ?? "general"),
    targetRole: normalizeTargetRole(existing.targetRole ?? "all"),
    createdBy: existing.createdBy ?? actor.profileId,
    createdByName: existing.createdByName ?? actor.fullName,
    isPublished: false,
    viewCount: numberOrZero(existing.viewCount),
    sortOrder: numberOrZero(existing.sortOrder),
    tags: deletedTags,
    createdAt: existing.createdAt ?? now,
    updatedAt: now
  });
  const article = mapKnowledgeRow(row);
  await writeKnowledgeAudit(actor, "deleted knowledge article", article.id, { title: article.title });
  return article;
}

export async function listAudienceKnowledgeArticles(
  audience: "resident" | "security",
  filters: { category?: string; search?: string } = {},
  scope: AppwriteEstateScope = {}
) {
  const category = filters.category ? normalizeCategory(filters.category) : null;
  const search = filters.search?.trim().toLowerCase() ?? "";

  return (await listKnowledgeRows(scope))
    .map(mapKnowledgeRow)
    .filter((article) => article.isPublished)
    .filter((article) => article.targetRole === "all" || article.targetRole === audience)
    .filter((article) => !category || article.category === category)
    .filter((article) => {
      if (!search) return true;
      return article.title.toLowerCase().includes(search) || (article.tags ?? "").toLowerCase().includes(search);
    })
    .sort(sortKnowledgeArticles);
}

export function incrementKnowledgeViewCounts(articles: AppwriteKnowledgeBaseArticle[]) {
  for (const article of articles) {
    void appwriteUpsertRow<KnowledgeRow>(APPWRITE_TABLE_KNOWLEDGE_BASE, article.id, {
      estateId: article.estateId,
      title: article.title,
      content: article.content,
      category: article.category,
      targetRole: article.targetRole,
      createdBy: article.createdBy,
      createdByName: article.createdByName,
      isPublished: article.isPublished,
      viewCount: article.viewCount + 1,
      sortOrder: article.sortOrder,
      tags: article.tags ?? "",
      createdAt: article.createdAt,
      updatedAt: new Date().toISOString()
    }).catch(() => null);
  }
}

async function listKnowledgeRows(scope: AppwriteEstateScope = {}) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return listAppwriteTableRows<KnowledgeRow>(APPWRITE_TABLE_KNOWLEDGE_BASE, scope);
}

async function getKnowledgeRow(articleId: string) {
  const config = getAppwriteServerConfig();
  if (!config.configured) {
    throw new Error(`Appwrite server configuration is missing: ${config.missing.join(", ")}`);
  }

  return appwriteRequest<KnowledgeRow>(
    `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_KNOWLEDGE_BASE}/rows/${encodeURIComponent(articleId)}`,
    { method: "GET" }
  );
}

function assertActorCanAccessKnowledge(actor: KnowledgeActor, row: KnowledgeRow) {
  const estateId = row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID;
  if (actor.role !== "super_admin" && estateId !== actor.estateId) {
    throw new Error("You are not allowed to manage this knowledge base article.");
  }
}

function mapKnowledgeRow(row: KnowledgeRow): AppwriteKnowledgeBaseArticle {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    title: row.title ?? "Untitled article",
    content: row.content ?? "",
    category: normalizeCategory(row.category ?? "general"),
    targetRole: normalizeTargetRole(row.targetRole ?? "all"),
    createdBy: row.createdBy ?? "",
    createdByName: row.createdByName ?? "Estate admin",
    isPublished: Boolean(row.isPublished),
    viewCount: numberOrZero(row.viewCount),
    sortOrder: numberOrZero(row.sortOrder),
    tags: optionalText(row.tags),
    createdAt: row.createdAt ?? "",
    updatedAt: row.updatedAt ?? ""
  };
}

function sortKnowledgeArticles(left: AppwriteKnowledgeBaseArticle, right: AppwriteKnowledgeBaseArticle) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

async function writeKnowledgeAudit(
  actor: KnowledgeActor,
  action: string,
  articleId: string,
  metadata: Record<string, string | number | boolean>
) {
  const now = new Date().toISOString();
  await appwriteUpsertRow(APPWRITE_TABLE_AUDIT_LOGS, safeAppwriteId("audit", `${action}:${articleId}:${now}`), {
    estateId: actor.estateId,
    actor: actor.fullName,
    action,
    entityType: "knowledge_base",
    entityId: articleId,
    metadata: JSON.stringify(metadata),
    createdAt: now
  });
}

function normalizeCategory(value: string): KnowledgeCategory {
  if (value === "billing" || value === "access" || value === "security" || value === "facilities" || value === "rules" || value === "emergency" || value === "general") {
    return value;
  }

  return "general";
}

function normalizeTargetRole(value: string): KnowledgeTargetRole {
  if (value === "all" || value === "resident" || value === "security" || value === "cso") {
    return value;
  }

  return "all";
}

function appendTag(tags: string, tag: string) {
  const values = tags.split(",").map((item) => item.trim()).filter(Boolean);
  return values.includes(tag) ? values.join(", ") : [...values, tag].join(", ");
}

function requiredText(value: string, label: string) {
  const text = value.trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }

  return text;
}

function numberOrZero(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function optionalText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function stringPref(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
