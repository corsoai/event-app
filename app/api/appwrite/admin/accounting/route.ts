import { NextRequest, NextResponse } from "next/server";
import { createAppwriteBill, listAppwriteAccounting, recordAppwriteAdminPayment } from "@/lib/appwrite/accounting";
import { AppwriteRestError } from "@/lib/appwrite/server";
import type { PaymentChannel } from "@/lib/types";

const adminRoles = new Set(["estate_admin", "super_admin"]);

export async function GET(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const accounting = await listAppwriteAccounting({
      bypassCache: request.nextUrl.searchParams.get("refresh") === "1"
    });
    return NextResponse.json(accounting);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Appwrite accounting.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const adminRole = request.cookies.get("corso_role")?.value ?? "";
  if (!adminRoles.has(adminRole)) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

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
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payment update request." }, { status: 400 });
  }

  try {
    if (body.action === "create_bill") {
      const result = await createAppwriteBill({
        residentId: String(body.residentId ?? ""),
        title: String(body.title ?? ""),
        amount: Number(body.amount ?? 0),
        dueDate: String(body.dueDate ?? ""),
        category: String(body.category ?? "Subscription")
      });

      return NextResponse.json(result);
    }

    const result = await recordAppwriteAdminPayment({
      billId: String(body.billId ?? ""),
      amount: Number(body.amount ?? 0),
      reference: String(body.reference ?? ""),
      channel: body.channel ?? "bank_transfer",
      date: body.date
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record payment.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
