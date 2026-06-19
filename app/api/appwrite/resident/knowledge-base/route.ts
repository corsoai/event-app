import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { incrementKnowledgeViewCounts, listAudienceKnowledgeArticles } from "@/lib/appwrite/knowledge-base";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const articles = await listAudienceKnowledgeArticles("resident", {
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined
    }, { estateId: context.estateId });
    incrementKnowledgeViewCounts(articles);
    return NextResponse.json({ articles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load knowledge base articles.";
    const status = error instanceof SessionContextError
      ? error.status
      : error instanceof AppwriteRestError
        ? error.status
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
