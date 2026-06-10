import { NextRequest, NextResponse } from "next/server";
import { listAppwriteResidentAccounting } from "@/lib/appwrite/accounting";
import { createPaymentIntent, updatePaymentIntent } from "@/lib/appwrite/payment-intents";
import { APPWRITE_LBSVIEW_ESTATE_ID, AppwriteRestError, appwriteRequest } from "@/lib/appwrite/server";
import { initializeTransaction } from "@/lib/monnify/client";
import { normalizePhoneNumber } from "@/lib/utils";
import type { Bill, Resident } from "@/lib/types";

type AppwriteUser = {
  $id: string;
  name?: string;
  email?: string;
  phone?: string;
  prefs?: Record<string, unknown>;
};

type InitiatePaymentBody = {
  billId?: string;
  months?: number;
  amount?: number;
};

const allowedSubscriptionMonths = new Set([1, 3, 6, 12]);

export async function POST(request: NextRequest) {
  const role = request.cookies.get("corso_role")?.value ?? "";
  const userId = request.cookies.get("corso_appwrite_user")?.value ?? "";

  if (role !== "resident" || !userId) {
    return NextResponse.json({ error: "Resident access is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as InitiatePaymentBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  }

  try {
    const user = await appwriteRequest<AppwriteUser>(`/users/${encodeURIComponent(userId)}`);
    const prefs = user.prefs ?? {};
    const accounting = await listAppwriteResidentAccounting(
      {
        email: typeof prefs.email === "string" ? prefs.email : user.email,
        phone: typeof prefs.phone === "string" ? prefs.phone : normalizePhoneNumber(user.phone ?? ""),
        fullName: typeof prefs.fullName === "string" ? prefs.fullName : user.name
      },
      { bypassCache: true }
    );
    const resident = accounting.resident;
    const summary = accounting.summary;

    if (!resident || !summary) {
      return NextResponse.json({ error: "No resident accounting record matched this login." }, { status: 404 });
    }

    const paymentPlan = resolvePaymentPlan(body, resident, accounting.bills, summary.outstandingBalance);
    if (paymentPlan.amount <= 0) {
      return NextResponse.json({ error: "There is no payable amount on this account." }, { status: 400 });
    }

    const paymentReference = `LBSV-${resident.id}-${Date.now()}`;
    const redirectUrl = buildConfirmUrl(request, paymentReference);
    const intent = await createPaymentIntent({
      residentId: resident.id,
      billId: paymentPlan.billId,
      amount: paymentPlan.amount,
      reference: paymentReference,
      metadata: {
        residentId: resident.id,
        unitCode: resident.houseNumber,
        estateId: resident.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
        months: paymentPlan.months,
        billingPeriod: paymentPlan.billingPeriod
      }
    });
    const transaction = await initializeTransaction({
      amount: paymentPlan.amount,
      customerName: resident.name,
      customerEmail: customerEmail(resident),
      paymentReference,
      paymentDescription: paymentPlan.description,
      redirectUrl,
      metadata: {
        residentId: resident.id,
        unitCode: resident.houseNumber,
        estateId: resident.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
        months: paymentPlan.months,
        billingPeriod: paymentPlan.billingPeriod
      }
    });

    if (!intent.$id) {
      throw new Error("Payment intent was created without an Appwrite row ID.");
    }

    await updatePaymentIntent(intent.$id, {
      ...intent,
      checkoutUrl: transaction.checkoutUrl,
      transactionReference: transaction.transactionReference,
      paymentReference: transaction.paymentReference,
      status: "initiated"
    });

    return NextResponse.json({
      checkoutUrl: transaction.checkoutUrl,
      paymentReference: transaction.paymentReference,
      amount: transaction.amount,
      transactionReference: transaction.transactionReference
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initiate payment.";
    const status = error instanceof AppwriteRestError ? error.status : 400;

    return NextResponse.json({ error: message }, { status });
  }
}

function resolvePaymentPlan(
  body: InitiatePaymentBody,
  resident: Resident,
  bills: Bill[],
  outstandingBalance: number
) {
  const billId = body.billId?.trim();
  const months = numberOrZero(body.months);
  const customAmount = numberOrZero(body.amount);

  if (billId) {
    const bill = bills.find((item) => item.id === billId);
    if (!bill) {
      throw new Error("The selected bill was not found on this resident account.");
    }

    return {
      amount: Math.max(0, bill.amount - numberOrZero(bill.paidAmount)),
      billId,
      description: `LBS View Estate payment for ${bill.title}`,
      months: undefined,
      billingPeriod: bill.billingMonth ?? bill.dueDate
    };
  }

  if (months > 0) {
    const selectedMonths = allowedSubscriptionMonths.has(months) ? months : 1;
    const monthlyRate = numberOrZero(resident.expectedMonthly);
    return {
      amount: selectedMonths * monthlyRate,
      billId: undefined,
      description: `LBS View Estate subscription payment for ${selectedMonths} month${selectedMonths === 1 ? "" : "s"}`,
      months: selectedMonths,
      billingPeriod: `${selectedMonths} month${selectedMonths === 1 ? "" : "s"}`
    };
  }

  if (customAmount > 0) {
    return {
      amount: customAmount,
      billId: undefined,
      description: "LBS View Estate subscription payment",
      months: undefined,
      billingPeriod: "custom"
    };
  }

  return {
    amount: Math.max(0, outstandingBalance),
    billId: undefined,
    description: "LBS View Estate outstanding subscription payment",
    months: undefined,
    billingPeriod: "outstanding"
  };
}

function buildConfirmUrl(request: NextRequest, paymentReference: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).trim().replace(/\/+$/g, "");
  const url = new URL("/api/monnify/confirm", appUrl);
  url.searchParams.set("paymentReference", paymentReference);
  return url.toString();
}

function customerEmail(resident: Resident) {
  const email = resident.email.trim();
  return email.includes("@") ? email : "payments@corso.ng";
}

function numberOrZero(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}
