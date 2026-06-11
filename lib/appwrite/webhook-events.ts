import { APPWRITE_TABLE_PAYMENT_WEBHOOK_EVENTS } from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteUpsertRow,
  safeAppwriteId,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

export type PaymentWebhookEventRow = {
  $id?: string;
  estateId?: string;
  provider?: string;
  eventId?: string;
  eventType?: string;
  reference?: string;
  status?: string;
  receivedAt?: string;
  processedAt?: string;
  payloadHash?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
};

let webhookSchemaReady = false;

export async function findPaymentWebhookEvent(eventId: string, reference: string) {
  await ensureWebhookSchema();
  const rows = await listAppwriteTableRows<PaymentWebhookEventRow>(APPWRITE_TABLE_PAYMENT_WEBHOOK_EVENTS);
  return rows.find((row) => (
    row.provider === "monnify" &&
    ((Boolean(eventId) && row.eventId === eventId) || (Boolean(reference) && row.reference === reference)) &&
    row.status === "processed"
  )) ?? null;
}

export async function savePaymentWebhookEvent(input: {
  eventId: string;
  eventType: string;
  reference: string;
  status: string;
  receivedAt: string;
  payloadHash: string;
  errorMessage?: string;
}) {
  await ensureWebhookSchema();
  const rowId = safeAppwriteId("wh", input.eventId || input.reference || `${input.eventType}:${input.receivedAt}`);
  return appwriteUpsertRow<PaymentWebhookEventRow>(APPWRITE_TABLE_PAYMENT_WEBHOOK_EVENTS, rowId, {
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    provider: "monnify",
    eventId: input.eventId || input.reference,
    eventType: input.eventType,
    reference: input.reference,
    status: input.status,
    receivedAt: input.receivedAt,
    payloadHash: input.payloadHash,
    errorMessage: input.errorMessage,
    createdAt: input.receivedAt,
    updatedAt: input.receivedAt
  });
}

export async function updatePaymentWebhookEvent(row: PaymentWebhookEventRow, input: {
  status: string;
  processedAt?: string;
  errorMessage?: string;
}) {
  await ensureWebhookSchema();
  const now = new Date().toISOString();
  return appwriteUpsertRow<PaymentWebhookEventRow>(APPWRITE_TABLE_PAYMENT_WEBHOOK_EVENTS, row.$id ?? safeAppwriteId("wh", row.eventId ?? row.reference ?? now), {
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    provider: row.provider ?? "monnify",
    eventId: row.eventId,
    eventType: row.eventType,
    reference: row.reference,
    status: input.status,
    receivedAt: row.receivedAt ?? now,
    processedAt: input.processedAt,
    payloadHash: row.payloadHash,
    errorMessage: input.errorMessage,
    createdAt: row.createdAt ?? row.receivedAt ?? now,
    updatedAt: now
  });
}

async function ensureWebhookSchema() {
  if (webhookSchemaReady) {
    return;
  }

  await setupAppwriteOnboardingSchema();
  webhookSchemaReady = true;
}
