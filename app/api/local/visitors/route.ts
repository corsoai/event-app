import { NextRequest, NextResponse } from "next/server";
import type { Resident, Visitor } from "@/lib/types";

type DemoVisitorRecord = {
  visitor: Visitor;
  resident: Resident | null;
  savedAt: string;
};

type DemoVisitorGlobal = typeof globalThis & {
  __corsoDemoVisitors?: Map<string, DemoVisitorRecord>;
};

function visitorRegistry() {
  const store = globalThis as DemoVisitorGlobal;
  if (!store.__corsoDemoVisitors) {
    store.__corsoDemoVisitors = new Map<string, DemoVisitorRecord>();
  }

  return store.__corsoDemoVisitors;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.replace(/\D/g, "").slice(0, 6) ?? "";

  if (code.length !== 6) {
    return NextResponse.json({ error: "Enter a valid 6-digit visitor code." }, { status: 400 });
  }

  const record = visitorRegistry().get(code);
  if (!record) {
    return NextResponse.json({ error: "No valid visitor invitation found for this code." }, { status: 404 });
  }

  return NextResponse.json(record);
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const visitor = payload?.visitor as Visitor | undefined;
  const resident = (payload?.resident ?? null) as Resident | null;
  const code = visitor?.code?.replace(/\D/g, "").slice(0, 6) ?? "";

  if (!visitor || code.length !== 6) {
    return NextResponse.json({ error: "Visitor invitation must include a valid 6-digit code." }, { status: 400 });
  }

  const record: DemoVisitorRecord = {
    visitor: { ...visitor, code },
    resident,
    savedAt: new Date().toISOString()
  };

  visitorRegistry().set(code, record);

  return NextResponse.json(record);
}
