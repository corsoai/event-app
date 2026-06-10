import { NextRequest, NextResponse } from "next/server";
import { allocatePayment } from "@/lib/appwrite/payment-allocation";
import { findPaymentIntentByReference, updatePaymentIntent, type PaymentIntentRow } from "@/lib/appwrite/payment-intents";
import { APPWRITE_LBSVIEW_ESTATE_ID, AppwriteRestError } from "@/lib/appwrite/server";
import { verifyTransaction, type VerifiedTransaction } from "@/lib/monnify/client";

export async function GET(request: NextRequest) {
  const paymentReference = (request.nextUrl.searchParams.get("paymentReference") ?? "").trim();
  const fallbackStatus = (request.nextUrl.searchParams.get("status") ?? "").trim().toUpperCase();

  if (!paymentReference) {
    return redirectTo(request, "/resident/bills?payment=failed");
  }

  try {
    const intent = await findPaymentIntentByReference(paymentReference);
    if (!intent?.$id) {
      return redirectTo(request, "/resident/bills?payment=failed");
    }

    if (intent.status === "completed") {
      return redirectTo(request, "/resident/payments?paid=true");
    }

    if (!intent.transactionReference) {
      await markIntentFailed(intent, "Missing Monnify transaction reference.");
      return redirectTo(request, "/resident/bills?payment=failed");
    }

    const verified = await verifyTransaction(intent.transactionReference);
    if (verified.paymentStatus.toUpperCase() === "PAID") {
      await allocatePayment({
        residentId: intent.residentId ?? "",
        estateId: intent.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
        amountPaid: verified.amountPaid || numberOrZero(intent.amount),
        paymentDate: paymentDate(verified),
        channel: monnifyPaymentChannel(verified.paymentMethod),
        reference: verified.transactionReference || intent.transactionReference,
        source: "monnify_online",
        recordedBy: "Monnify",
        monnifyTransactionRef: verified.transactionReference || intent.transactionReference,
        monnifyPaymentRef: verified.paymentReference || intent.paymentReference || intent.reference,
        notes: `Monnify online payment confirmed for ${intent.reference ?? paymentReference}.`
      });
      await updatePaymentIntent(intent.$id, {
        ...intent,
        status: "completed",
        transactionReference: verified.transactionReference || intent.transactionReference,
        paymentReference: verified.paymentReference || intent.paymentReference,
        channel: monnifyPaymentChannel(verified.paymentMethod)
      });

      return redirectTo(request, "/resident/payments?paid=true");
    }

    await markIntentFailed(intent, fallbackStatus || verified.paymentStatus || "Payment was not completed.");
    return redirectTo(request, "/resident/bills?payment=failed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm Monnify payment.";
    console.error("Monnify confirmation failed", message);

    if (error instanceof AppwriteRestError) {
      console.error("Appwrite payment confirmation error", error.status, error.type);
    }

    const intent = await findPaymentIntentByReference(paymentReference).catch(() => null);
    if (intent?.$id) {
      await markIntentFailed(intent, message).catch(() => null);
    }

    return redirectTo(request, "/resident/bills?payment=failed");
  }
}

async function markIntentFailed(intent: PaymentIntentRow, errorMessage: string) {
  if (!intent.$id) {
    return;
  }

  await updatePaymentIntent(intent.$id, {
    ...intent,
    status: "failed",
    errorMessage
  });
}

function redirectTo(request: NextRequest, path: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).trim().replace(/\/+$/g, "");
  return NextResponse.redirect(new URL(path, appUrl));
}

function monnifyPaymentChannel(paymentMethod: string) {
  return paymentMethod.toUpperCase().includes("CARD") ? "monnify_card" : "monnify_transfer";
}

function paymentDate(verified: VerifiedTransaction) {
  const value = verified.paidOn?.trim();
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

function numberOrZero(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
