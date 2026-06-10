import { APPWRITE_TABLE_PAYMENT_INTENTS } from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteUpsertRow,
  safeAppwriteId,
  setupAppwriteOnboardingSchema
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

export type PaymentIntentStatus = "pending" | "initiated" | "completed" | "failed";

export type PaymentIntentRow = {
  $id?: string;
  estateId?: string;
  residentId?: string;
  billId?: string;
  subscriptionId?: string;
  virtualAccountId?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  processor?: string;
  channel?: string;
  checkoutUrl?: string;
  transactionReference?: string;
  paymentReference?: string;
  status?: PaymentIntentStatus | string;
  expiresAt?: string;
  metadata?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePaymentIntentInput = {
  residentId: string;
  billId?: string;
  amount: number;
  reference: string;
  metadata: Record<string, string | number | boolean | undefined>;
};

let paymentIntentSchemaReady = false;

export async function createPaymentIntent(input: CreatePaymentIntentInput) {
  await ensurePaymentIntentSchema();
  const now = new Date().toISOString();
  const intentId = safeAppwriteId("intent", input.reference);

  return appwriteUpsertRow<PaymentIntentRow>(APPWRITE_TABLE_PAYMENT_INTENTS, intentId, {
    estateId: APPWRITE_LBSVIEW_ESTATE_ID,
    residentId: input.residentId,
    billId: input.billId,
    amount: input.amount,
    currency: "NGN",
    reference: input.reference,
    paymentReference: input.reference,
    processor: "monnify",
    channel: "online",
    status: "pending",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    metadata: JSON.stringify(input.metadata),
    createdAt: now,
    updatedAt: now
  });
}

export async function updatePaymentIntent(intentId: string, data: Partial<PaymentIntentRow>) {
  await ensurePaymentIntentSchema();
  return appwriteUpsertRow<PaymentIntentRow>(APPWRITE_TABLE_PAYMENT_INTENTS, intentId, {
    estateId: data.estateId,
    residentId: data.residentId,
    billId: data.billId,
    subscriptionId: data.subscriptionId,
    virtualAccountId: data.virtualAccountId,
    amount: data.amount,
    currency: data.currency,
    reference: data.reference,
    processor: data.processor,
    channel: data.channel,
    checkoutUrl: data.checkoutUrl,
    transactionReference: data.transactionReference,
    paymentReference: data.paymentReference,
    status: data.status,
    expiresAt: data.expiresAt,
    metadata: data.metadata,
    errorMessage: data.errorMessage,
    createdAt: data.createdAt,
    updatedAt: new Date().toISOString()
  });
}

export async function findPaymentIntentByReference(reference: string) {
  await ensurePaymentIntentSchema();
  const normalizedReference = reference.trim();
  if (!normalizedReference) {
    return null;
  }

  const rows = await listAppwriteTableRows<PaymentIntentRow>(APPWRITE_TABLE_PAYMENT_INTENTS);
  return rows.find((row) => (
    row.reference === normalizedReference ||
    row.paymentReference === normalizedReference ||
    row.transactionReference === normalizedReference
  )) ?? null;
}

async function ensurePaymentIntentSchema() {
  if (paymentIntentSchemaReady) {
    return;
  }

  await setupAppwriteOnboardingSchema();
  paymentIntentSchemaReady = true;
}
