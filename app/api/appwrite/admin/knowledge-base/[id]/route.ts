import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import {
  resolveKnowledgeActor,
  softDeleteKnowledgeArticle,
  updateKnowledgeArticle,
  type KnowledgeUpdateInput
} from "@/lib/appwrite/knowledge-base";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

const adminRoles = ["estate_admin", "super_admin"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid article update request." }, { status: 400 });
  }

  try {
    const { id } = await context.params;
    const session = await resolveSessionContext(request, {
      allowedRoles: adminRoles,
      requireEstate: true
    });
    const actor = await resolveKnowledgeActor(session);
    const article = await updateKnowledgeArticle(id, toKnowledgeUpdateInput(body), actor);
    return NextResponse.json({ article });
  } catch (error) {
    return errorResponse(error, "Unable to update knowledge base article.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await resolveSessionContext(request, {
      allowedRoles: adminRoles,
      requireEstate: true
    });
    const actor = await resolveKnowledgeActor(session);
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
  const status = error instanceof SessionContextError ? error.status
    : error instanceof AppwriteRestError ? error.status
      : 400;
  return NextResponse.json({ error: message }, { status });
}
