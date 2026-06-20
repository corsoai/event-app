import { NextRequest, NextResponse } from "next/server";
import { createAppwriteBill, listAppwriteAccounting, recordAppwriteAdminPayment } from "@/lib/appwrite/accounting";
import { AppwriteRestError } from "@/lib/appwrite/server";
import { resolveSessionContext, SessionContextError, type SessionContext } from "@/lib/appwrite/session-context";
import type { PaymentChannel } from "@/lib/types";

const adminRoles = ["estate_admin", "super_admin"] as const;

export async function GET(request: NextRequest) {
  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const accounting = await listAppwriteAccounting({
      ...estateScopeFor(context),
      bypassCache: request.nextUrl.searchParams.get("refresh") === "1"
    });
    return NextResponse.json(accounting);
  } catch (error) {
    return adminRouteError(error, "Unable to load accounting.");
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    action?: string;
    residentId?: string;
    title?: string;
    billId?: string;
    amount?: number;
    dueDate?: string;
    category?: string;
    reference?: string;
    channel?: PaymentChannel;
    date?: string;
    estateId?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payment update request." }, { status: 400 });
  }

  try {
    const context = await resolveSessionContext(request, { allowedRoles: adminRoles });
    const estateScope = writableEstateScopeFor(context, body);
    if (body.action === "create_bill") {
      const result = await createAppwriteBill({
        ...estateScope,
        residentId: String(body.residentId ?? ""),
        title: String(body.title ?? ""),
        amount: Number(body.amount ?? 0),
        dueDate: String(body.dueDate ?? ""),
        category: String(body.category ?? "Subscription")
      });

      return NextResponse.json(result);
    }

    const result = await recordAppwriteAdminPayment({
      ...estateScope,
      billId: String(body.billId ?? ""),
      amount: Number(body.amount ?? 0),
      reference: String(body.reference ?? ""),
      channel: body.channel ?? "bank_transfer",
      date: body.date
    });

    return NextResponse.json(result);
  } catch (error) {
    return adminRouteError(error, "Unable to record payment.");
  }
}

function estateScopeFor(context: SessionContext) {
  return context.role === "super_admin"
    ? { includeAllEstates: true }
    : { estateId: context.estateId };
}

function writableEstateScopeFor(context: SessionContext, body: { estateId?: string }) {
  if (context.role !== "super_admin") {
    return { estateId: context.estateId };
  }

  const estateId = String(body.estateId ?? "").trim();
  if (!estateId) {
    throw new Error("Super admin accounting writes require an estateId.");
  }

  return { estateId };
}

function adminRouteError(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = error instanceof SessionContextError
    ? error.status
    : error instanceof AppwriteRestError
      ? error.status
      : 400;

  return NextResponse.json({ error: message }, { status });
}
