import type { AuditLog, Bill, Payment, PaymentChannel, Resident } from "@/lib/types";
import { APPWRITE_LBSVIEW_ESTATE_ID, appwriteRequest, appwriteUpsertRow, getAppwriteServerConfig, safeAppwriteId, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory, listAppwriteTableRows } from "@/lib/appwrite/residents";

type AppwriteBillRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  residentId?: string;
  category?: string;
  title?: string;
  amount?: number;
  paidAmount?: number;
  dueDate?: string;
  status?: string;
};

type AppwritePaymentRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  residentId?: string;
  billId?: string;
  amount?: number;
  reference?: string;
  processor?: string;
  channel?: string;
  providerReference?: string;
  date?: string;
  status?: string;
  source?: string;
  confirmedAt?: string;
  confirmedBy?: string;
};

type AppwriteAuditRow = {
  $id?: string;
  estateId?: string;
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  metadata?: string;
  createdAt?: string;
};

export type AppwriteAccountingData = Awaited<ReturnType<typeof listAppwriteAccounting>>;

export type AppwritePaymentInput = {
  billId: string;
  amount: number;
  reference: string;
  channel: PaymentChannel;
  date?: string;
};

export async function listAppwriteAccounting() {
  await setupAppwriteOnboardingSchema();

  const [directory, billRows, paymentRows, auditRows] = await Promise.all([
    listAppwriteResidentDirectory(),
    listAppwriteTableRows<AppwriteBillRow>("bills"),
    listAppwriteTableRows<AppwritePaymentRow>("payments"),
    listAppwriteTableRows<AppwriteAuditRow>("audit_logs")
  ]);

  const residentsById = new Map(directory.residents.map((resident) => [resident.id, resident]));
  const payments = paymentRows.map(mapPaymentRow).sort((left, right) => right.date.localeCompare(left.date));
  const bills = normalizeBillsWithPayments(
    billRows.map((row) => mapBillRow(row, residentsById.get(row.residentId ?? ""))),
    payments
  );

  return {
    ...directory,
    bills,
    payments,
    auditLogs: auditRows.map(mapAuditRow).sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    total: {
      ...directory.total,
      bills: bills.length,
      payments: payments.length
    }
  };
}

export async function recordAppwriteAdminPayment(input: AppwritePaymentInput) {
  const billId = input.billId.trim();
  const reference = input.reference.trim();
  const amount = Math.max(0, Number(input.amount));
  if (!billId || !reference || amount <= 0) {
    throw new Error("Bill, payment reference, and amount are required.");
  }

  await setupAppwriteOnboardingSchema();
  const config = getAppwriteServerConfig();

  const billRow = await appwriteRequest<AppwriteBillRow>(
    `/tablesdb/${config.databaseId}/tables/bills/rows/${encodeURIComponent(billId)}`,
    { method: "GET" }
  );
  const resident = billRow.residentId
    ? (await listAppwriteResidentDirectory()).residents.find((item) => item.id === billRow.residentId)
    : undefined;
  const now = new Date().toISOString();
  const date = input.date || now.slice(0, 10);
  const existingPayments = await listAppwriteTableRows<AppwritePaymentRow>("payments");
  const paidBefore = existingPayments
    .filter((payment) => payment.billId === billId && payment.status === "confirmed")
    .reduce((sum, payment) => sum + numberOrZero(payment.amount), 0);
  const billAmount = numberOrZero(billRow.amount);
  const paymentAmount = Math.min(amount, Math.max(0, billAmount - paidBefore) || amount);
  const paidAmount = Math.min(billAmount, paidBefore + paymentAmount);
  const paymentId = safeAppwriteId("pay", `${reference}-${billId}`);

  const payment = await appwriteUpsertRow<AppwritePaymentRow>("payments", paymentId, {
    estateId: billRow.estateId ?? resident?.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    propertyId: billRow.propertyId ?? resident?.propertyId,
    unitId: billRow.unitId ?? resident?.unitId,
    residentId: billRow.residentId ?? resident?.id,
    billId,
    amount: paymentAmount,
    reference,
    processor: "manual",
    channel: input.channel,
    providerReference: reference,
    date,
    status: "confirmed",
    source: "admin",
    confirmedAt: now,
    confirmedBy: "Estate admin"
  });

  const updatedBill = await appwriteUpsertRow<AppwriteBillRow>("bills", billId, {
    estateId: billRow.estateId ?? resident?.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    propertyId: billRow.propertyId ?? resident?.propertyId,
    unitId: billRow.unitId ?? resident?.unitId,
    residentId: billRow.residentId ?? resident?.id,
    category: billRow.category ?? "Service charge",
    title: billRow.title ?? "Resident bill",
    amount: billAmount,
    paidAmount,
    dueDate: billRow.dueDate ?? date,
    status: billStatus(billAmount, paidAmount, billRow.status)
  });

  await appwriteUpsertRow<AppwriteAuditRow>("audit_logs", safeAppwriteId("audit", `admin-payment-${paymentId}-${now}`), {
    estateId: billRow.estateId ?? resident?.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    actor: "Estate admin",
    action: "recorded manual payment",
    entityType: "payment",
    entityId: paymentId,
    metadata: JSON.stringify({
      billId,
      residentId: billRow.residentId ?? "",
      amount: paymentAmount,
      channel: input.channel,
      reference
    }),
    createdAt: now
  });

  return {
    payment: mapPaymentRow(payment),
    bill: mapBillRow(updatedBill, resident)
  };
}

function normalizeBillsWithPayments(bills: Bill[], payments: Payment[]) {
  return bills.map((bill) => {
    const paidAmount = payments
      .filter((payment) => payment.billId === bill.id && payment.status === "confirmed")
      .reduce((sum, payment) => sum + payment.amount, 0);

    return {
      ...bill,
      paidAmount,
      status: billStatus(bill.amount, paidAmount, bill.status)
    };
  });
}

function mapBillRow(row: AppwriteBillRow, resident?: Resident): Bill {
  const amount = numberOrZero(row.amount);
  const paidAmount = numberOrZero(row.paidAmount);

  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? resident?.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    propertyId: optionalText(row.propertyId) ?? resident?.propertyId,
    unitId: optionalText(row.unitId) ?? resident?.unitId,
    residentId: row.residentId ?? resident?.id ?? "",
    category: row.category ?? "Service charge",
    title: row.title ?? "Resident bill",
    amount,
    paidAmount,
    dueDate: row.dueDate ?? "",
    status: billStatus(amount, paidAmount, row.status)
  };
}

function mapPaymentRow(row: AppwritePaymentRow): Payment {
  return {
    id: row.$id ?? "",
    billId: row.billId ?? "",
    residentId: row.residentId ?? "",
    estateId: optionalText(row.estateId),
    propertyId: optionalText(row.propertyId),
    unitId: optionalText(row.unitId),
    amount: numberOrZero(row.amount),
    reference: row.reference ?? row.$id ?? "",
    processor: mapProcessor(row.processor),
    channel: mapChannel(row.channel),
    providerReference: optionalText(row.providerReference),
    date: row.date ?? "",
    status: row.status === "pending" || row.status === "rejected" ? row.status : "confirmed",
    source: row.source === "resident" || row.source === "webhook" ? row.source : "admin",
    confirmedAt: optionalText(row.confirmedAt),
    confirmedBy: optionalText(row.confirmedBy)
  };
}

function mapAuditRow(row: AppwriteAuditRow): AuditLog {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    actor: row.actor ?? "System",
    action: row.action ?? "updated accounting",
    entityType: mapAuditEntity(row.entityType),
    entityId: row.entityId ?? "",
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt ?? ""
  };
}

function billStatus(amount: number, paidAmount: number, fallback?: string): Bill["status"] {
  if (paidAmount >= amount && amount > 0) return "paid";
  if (paidAmount > 0) return "partially paid";
  return fallback === "overdue" ? "overdue" : "unpaid";
}

function mapProcessor(value?: string): Payment["processor"] {
  if (value === "paystack" || value === "flutterwave" || value === "monnify" || value === "gtbank_squad") {
    return value;
  }

  return "manual";
}

function mapChannel(value?: string): Payment["channel"] {
  if (value === "online" || value === "cash" || value === "pos" || value === "whatsapp_receipt") {
    return value;
  }

  return "bank_transfer";
}

function mapAuditEntity(value?: string): AuditLog["entityType"] {
  if (value === "property" || value === "unit" || value === "resident" || value === "bill" || value === "payment" || value === "visitor") {
    return value;
  }

  return "system";
}

function optionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function numberOrZero(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseMetadata(value?: string): AuditLog["metadata"] {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as AuditLog["metadata"];
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}
