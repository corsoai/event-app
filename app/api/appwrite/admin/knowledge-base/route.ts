import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import {
  createKnowledgeArticle,
  listAdminKnowledgeArticles,
  resolveKnowledgeActor,
  type KnowledgeInput
} from "@/lib/appwrite/knowledge-base";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const articles = await listAdminKnowledgeArticles({
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      isPublished: request.nextUrl.searchParams.get("isPublished") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined
    }, estateScopeFor(context));
    return NextResponse.json({ articles });
  } catch (error) {
    return errorResponse(error, "Unable to load knowledge base articles.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid article request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const actor = {
      ...await resolveKnowledgeActor(context),
      estateId: writableEstateId(context, body)
    };
    const article = await createKnowledgeArticle(toKnowledgeInput(body), actor);
    return NextResponse.json({ article });
  } catch (error) {
    return errorResponse(error, "Unable to create knowledge base article.");
  }
}

function toKnowledgeInput(body: Record<string, unknown>): KnowledgeInput {
  return {
    title: String(body.title ?? ""),
    content: String(body.content ?? body.summary ?? ""),
    category: String(body.category ?? "general") as KnowledgeInput["category"],
    targetRole: String(body.targetRole ?? "all") as KnowledgeInput["targetRole"],
    tags: body.tags === undefined ? undefined : String(body.tags),
    sortOrder: Number(body.sortOrder ?? 0),
    isPublished: Boolean(body.isPublished)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;
  return NextResponse.json({ error: message }, { status });
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}

function writableEstateId(context: SessionContext, body: Record<string, unknown>) {
  if (context.role !== "super_admin") {
    return context.estateId;
  }

  const estateId = String(body.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin knowledge-base writes require an estateId.");
  }

  return estateId;
}
