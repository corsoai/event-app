import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { allocatePayment } from "@/lib/appwrite/payment-allocation";
import { findResidentIdByEmail, findVirtualAccountByAccountNumber } from "@/lib/appwrite/virtual-accounts";
import {
  findPaymentWebhookEvent,
  savePaymentWebhookEvent,
  updatePaymentWebhookEvent
} from "@/lib/appwrite/webhook-events";
import { APPWRITE_LBSVIEW_ESTATE_ID } from "@/lib/appwrite/server";

type MonnifyWebhookPayload = {
  eventId?: string;
  eventType?: string;
  eventData?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("monnify-signature") ?? request.headers.get("Monnify-Signature") ?? "";
  const computedSignature = monnifySignature(rawBody);

  if (!signatureMatches(signature, computedSignature)) {
    return NextResponse.json({ ok: false, error: "Invalid Monnify signature." }, { status: 401 });
  }

  const receivedAt = new Date().toISOString();
  const payload = parseWebhookPayload(rawBody);
  const eventData = payload.eventData ?? {};
  const transactionReference = readString(eventData, "transactionReference");
  const eventId = payload.eventId || readString(eventData, "eventId") || transactionReference;
  const eventType = payload.eventType || readString(eventData, "eventType") || "monnify_event";
  const existing = await findPaymentWebhookEvent(eventId, transactionReference).catch(() => null);

  if (existing) {
    return NextResponse.json({ ok: true, status: "duplicate" });
  }

  const eventRow = await savePaymentWebhookEvent({
    eventId,
    eventType,
    reference: transactionReference,
    status: "processing",
    receivedAt,
    payloadHash: computedSignature
  }).catch((error: unknown) => {
    console.error("Unable to save Monnify webhook event", error);
    return null;
  });

  try {
    const paymentStatus = readString(eventData, "paymentStatus").toUpperCase();

    if (paymentStatus === "PAID") {
      const residentId = await resolveResidentId(eventData);
      if (!residentId) {
        throw new Error("Unable to resolve resident for Monnify webhook payment.");
      }

      await allocatePayment({
        residentId,
        estateId: APPWRITE_LBSVIEW_ESTATE_ID,
        amountPaid: readNumber(eventData, "amountPaid") || readNumber(eventData, "settlementAmount") || readNumber(eventData, "totalPayable"),
        paymentDate: paymentDate(readString(eventData, "paidOn")),
        channel: webhookPaymentChannel(readString(eventData, "paymentMethod")),
        reference: transactionReference,
        source: "monnify_webhook",
        recordedBy: "monnify_webhook",
        monnifyTransactionRef: transactionReference,
        monnifyPaymentRef: readString(eventData, "paymentReference"),
        notes: `Monnify webhook ${eventType} processed automatically.`
      });

      if (eventRow) {
        await updatePaymentWebhookEvent(eventRow, {
          status: "processed",
          processedAt: new Date().toISOString()
        });
      }

      return NextResponse.json({ ok: true, status: "processed" });
    }

    if (eventRow) {
      await updatePaymentWebhookEvent(eventRow, {
        status: paymentStatus ? paymentStatus.toLowerCase() : "logged",
        processedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ ok: true, status: "logged" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monnify webhook processing failed.";
    console.error("Monnify webhook processing failed", message);

    if (eventRow) {
      await updatePaymentWebhookEvent(eventRow, {
        status: "failed",
        processedAt: new Date().toISOString(),
        errorMessage: message
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, status: "error_logged" });
  }
}

function monnifySignature(rawBody: string) {
  const secret = process.env.MONNIFY_SECRET_KEY ?? "";
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

function signatureMatches(signature: string, computedSignature: string) {
  const normalizedSignature = signature.trim().toLowerCase();
  const normalizedComputed = computedSignature.trim().toLowerCase();
  if (!normalizedSignature || normalizedSignature.length !== normalizedComputed.length) {
    return false;
  }

  const signatureBuffer = Buffer.from(normalizedSignature, "hex");
  const computedBuffer = Buffer.from(normalizedComputed, "hex");
  if (signatureBuffer.length !== computedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, computedBuffer);
}

function parseWebhookPayload(rawBody: string): MonnifyWebhookPayload {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const eventData = record.eventData && typeof record.eventData === "object"
        ? record.eventData as Record<string, unknown>
        : {};
      return {
        eventId: readString(record, "eventId"),
        eventType: readString(record, "eventType"),
        eventData
      };
    }
  } catch {
    return {};
  }

  return {};
}

async function resolveResidentId(eventData: Record<string, unknown>) {
  const metadata = readMetadata(eventData);
  const metadataResidentId = readString(metadata, "residentId");
  if (metadataResidentId) {
    return metadataResidentId;
  }

  const accountNumber = readAccountNumber(eventData);
  if (accountNumber) {
    const account = await findVirtualAccountByAccountNumber(accountNumber);
    if (account?.residentId) {
      return account.residentId;
    }
  }

  const customer = readObject(eventData, "customer");
  return findResidentIdByEmail(readString(customer, "email"));
}

function readMetadata(eventData: Record<string, unknown>) {
  const metadata = eventData.metaData ?? eventData.metadata;
  return metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
}

function readAccountNumber(eventData: Record<string, unknown>) {
  const destinationAccountInformation = readObject(eventData, "destinationAccountInformation");
  const product = readObject(eventData, "product");
  return (
    readString(eventData, "accountNumber") ||
    readString(eventData, "destinationAccountNumber") ||
    readString(destinationAccountInformation, "accountNumber") ||
    readString(product, "reference")
  );
}

function webhookPaymentChannel(paymentMethod: string) {
  const normalized = paymentMethod.toUpperCase();
  if (normalized.includes("CARD")) {
    return "monnify_card";
  }

  if (normalized.includes("ACCOUNT") || normalized.includes("TRANSFER")) {
    return "monnify_virtual_account";
  }

  return "monnify_transfer";
}

function paymentDate(value: string) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

function readObject(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
