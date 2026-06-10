import { NextRequest, NextResponse } from "next/server";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { incrementKnowledgeViewCounts, listAudienceKnowledgeArticles } from "@/lib/appwrite/knowledge-base";

export async function GET(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  if (role !== "resident") {
    return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
  }

  try {
    const articles = await listAudienceKnowledgeArticles("resident", {
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      search: request.nextUrl.searchParams.get("search") ?? undefined
    });
    incrementKnowledgeViewCounts(articles);
    return NextResponse.json({ articles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load knowledge base articles.";
    const status = error instanceof AppwriteRestError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
