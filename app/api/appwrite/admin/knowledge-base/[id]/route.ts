import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  resolveKnowledgeActor,
  softDeleteKnowledgeArticle,
  updateKnowledgeArticle,
  type KnowledgeUpdateInput
} from "@/lib/appwrite/knowledge-base";

const adminRoles = new Set(["estate_admin", "super_admin"]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (!adminRoles.has(role) || !userId) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid article update request." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const actor = await resolveKnowledgeActor(userId, role);
    const article = await updateKnowledgeArticle(id, toKnowledgeUpdateInput(body), actor);
    return NextResponse.json({ article });
  } catch (error) {
    return errorResponse(error, "Unable to update knowledge base article.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";
  if (!adminRoles.has(role) || !userId) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const actor = await resolveKnowledgeActor(userId, role);
    const article = await softDeleteKnowledgeArticle(id, actor);
    return NextResponse.json({ article });
  } catch (error) {
    return errorResponse(error, "Unable to delete knowledge base article.");
  }
}

function toKnowledgeUpdateInput(body: Record<string, unknown>): KnowledgeUpdateInput {
  return {
    title: body.title === undefined ? undefined : String(body.title),
    content: body.content === undefined ? undefined : String(body.content),
    category: body.category === undefined ? undefined : String(body.category) as KnowledgeUpdateInput["category"],
    targetRole: body.targetRole === undefined ? undefined : String(body.targetRole) as KnowledgeUpdateInput["targetRole"],
    tags: body.tags === undefined ? undefined : String(body.tags),
    sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
    isPublished: body.isPublished === undefined ? undefined : Boolean(body.isPublished)
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
