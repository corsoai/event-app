import { NextRequest, NextResponse } from "next/server";
import { createAppwriteResidentVisitor, listAppwriteResidentVisitors } from "@/lib/appwrite/visitors";
import { resolveSessionContext, SessionContextError } from "@/lib/appwrite/session-context";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const visitors = await listAppwriteResidentVisitors(context);
    return NextResponse.json({ visitors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visitor invitations could not be loaded.";
    const status = error instanceof SessionContextError
      ? error.status
      : message.includes("expired") || message.includes("logged in") || message.includes("profile") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid visitor request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: ["resident"] });
    const visitor = await createAppwriteResidentVisitor(context, {
      visitorName: String(body.visitorName ?? ""),
      phone: String(body.phone ?? ""),
      visitDate: String(body.visitDate ?? ""),
      arrivalTime: String(body.arrivalTime ?? ""),
      purpose: String(body.purpose ?? ""),
      count: Number(body.count ?? 1),
      code: String(body.code ?? "")
    });

    return NextResponse.json({ visitor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visitor invitation could not be saved.";
    const status = error instanceof SessionContextError
      ? error.status
      : message.includes("expired") || message.includes("logged in") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
