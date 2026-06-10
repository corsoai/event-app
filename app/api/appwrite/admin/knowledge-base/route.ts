import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  createKnowledgeArticle,
  listAdminKnowledgeArticles,
  resolveKnowledgeActor,
  type KnowledgeInput
} from "@/lib/appwrite/knowledge-base";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(role)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const articles = await listAdminKnowledgeArticles({
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      isPublished: request.nextUrl.searchParams.get("isPublished") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined
    });
    return NextResponse.json({ articles });
  } catch (error) {
    return errorResponse(error, "Unable to load knowledge base articles.");
  }
}

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (!adminRoles.has(role) || !userId) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid article request." }, { status: 400 });
  }

  try {
    const actor = await resolveKnowledgeActor(userId, role);
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
  const status = error instanceof AppwriteRestError ? error.status : 400;
  return NextResponse.json({ error: message }, { status });
}
