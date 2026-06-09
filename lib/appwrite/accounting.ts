import type { AuditLog, Bill, Payment, PaymentChannel, Resident } from "@/lib/types";
import { APPWRITE_LBSVIEW_ESTATE_ID, appwriteRequest, appwriteUpsertRow, getAppwriteServerConfig, safeAppwriteId, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory, listAppwriteTableRows, type AppwriteResidentDirectory } from "@/lib/appwrite/residents";

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

type AppwriteAccountingResidentRow = {
  expectedMonthly?: number;
};

export type AppwriteAccountingData = AppwriteResidentDirectory & {
  bills: Bill[];
  payments: Payment[];
  auditLogs: AuditLog[];
  total: AppwriteResidentDirectory["total"] & {
    bills: number;
    payments: number;
  };
};
export type AppwriteAccountingSummary = {
  expectedRevenue: number;
  paidAmount: number;
  outstandingBalance: number;
  creditBalance: number;
  netReceivable: number;
  pendingReviewAmount: number;
  debtorsCount: number;
  residentsInCredit: number;
  monthlyExpected: number;
  residentsCount: number;
  billsCount: number;
  paymentsCount: number;
  channelTotals: Record<string, number>;
  paymentStatusTotals: Record<string, { count: number; amount: number }>;
  categoryTotals: Record<string, number>;
  generatedAt: string;
};

export type AppwritePaymentInput = {
  billId: string;
  amount: number;
  reference: string;
  channel: PaymentChannel;
  date?: string;
};

const ACCOUNTING_CACHE_MS = 30_000;
let accountingCache: { data: AppwriteAccountingData; expiresAt: number } | null = null;
let summaryCache: { data: AppwriteAccountingSummary; expiresAt: number } | null = null;

export async function listAppwriteAccounting(options: { bypassCache?: boolean; ensureSchema?: boolean } = {}) {
  if (!options.bypassCache && accountingCache && accountingCache.expiresAt > Date.now()) {
    return accountingCache.data;
  }

  if (options.ensureSchema) {
    await setupAppwriteOnboardingSchema();
  }

  const [directory, billRows, paymentRows, auditRows] = await Promise.all([
    listAppwriteResidentDirectory({ ensureSchema: false }),
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

  const data = {
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

  accountingCache = { data, expiresAt: Date.now() + ACCOUNTING_CACHE_MS };
  return data;
}

export async function getAppwriteAccountingSummary(options: { bypassCache?: boolean; ensureSchema?: boolean } = {}): Promise<AppwriteAccountingSummary> {
  if (!options.bypassCache && summaryCache && summaryCache.expiresAt > Date.now()) {
    return summaryCache.data;
  }

  if (options.ensureSchema) {
    await setupAppwriteOnboardingSchema();
  }

  const [residentRows, billRows, paymentRows] = await Promise.all([
    listAppwriteTableRows<AppwriteAccountingResidentRow>("residents"),
    listAppwriteTableRows<AppwriteBillRow>("bills"),
    listAppwriteTableRows<AppwritePaymentRow>("payments")
  ]);
  const payments = paymentRows.map(mapPaymentRow);
  const bills = normalizeBillsWithPayments(billRows.map((row) => mapBillRow(row)), payments);
  const confirmedPayments = payments.filter((payment) => payment.status === "confirmed");
  const expectedRevenue = bills.reduce((sum, bill) => sum + bill.amount, 0);
  const paidAmount = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingBalance = bills.reduce((sum, bill) => sum + Math.max(0, bill.amount - numberOrZero(bill.paidAmount)), 0);
  const creditBalance = bills.reduce((sum, bill) => sum + Math.max(0, numberOrZero(bill.paidAmount) - bill.amount), 0);
  const residentBalances = residentBalanceMap(bills);
  const pendingReviewAmount = payments
    .filter((payment) => payment.status === "pending")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const channelTotals = confirmedPayments.reduce<Record<string, number>>((totals, payment) => {
    const channel = channelLabel(payment.channel);
    totals[channel] = (totals[channel] ?? 0) + payment.amount;
    return totals;
  }, {});
  const paymentStatusTotals = payments.reduce<Record<string, { count: number; amount: number }>>((totals, payment) => {
    const confirmation = payment.status === "confirmed"
      ? "Confirmed"
      : payment.status === "pending"
        ? "Unconfirmed"
        : "Rejected";
    const method = payment.channel === "online" ? "online" : "manual";
    const key = `${confirmation} ${method}`;
    totals[key] = {
      count: (totals[key]?.count ?? 0) + 1,
      amount: (totals[key]?.amount ?? 0) + payment.amount
    };
    return totals;
  }, {});
  const categoryTotals = bills.reduce<Record<string, number>>((totals, bill) => {
    const category = bill.category ?? "Service charge";
    totals[category] = (totals[category] ?? 0) + bill.amount;
    return totals;
  }, {});
  const data = {
    expectedRevenue,
    paidAmount,
    outstandingBalance,
    creditBalance,
    netReceivable: Math.max(0, outstandingBalance - creditBalance),
    pendingReviewAmount,
    debtorsCount: [...residentBalances.values()].filter((balance) => balance.outstanding > balance.credit).length,
    residentsInCredit: [...residentBalances.values()].filter((balance) => balance.credit > balance.outstanding).length,
    monthlyExpected: residentRows.reduce((sum, resident) => sum + numberOrZero(resident.expectedMonthly), 0),
    residentsCount: residentRows.length,
    billsCount: bills.length,
    paymentsCount: payments.length,
    channelTotals,
    paymentStatusTotals,
    categoryTotals,
    generatedAt: new Date().toISOString()
  };

  summaryCache = { data, expiresAt: Date.now() + ACCOUNTING_CACHE_MS };
  return data;
}

export async function recordAppwriteAdminPayment(input: AppwritePaymentInput) {
  const billId = input.billId.trim();
  const reference = input.reference.trim();
  const amount = Math.max(0, Number(input.amount));
  if (!billId || !reference || amount <= 0) {
    throw new Error("Bill, payment reference, and amount are required.");
  }

  const config = getAppwriteServerConfig();

  const billRow = await appwriteRequest<AppwriteBillRow>(
    `/tablesdb/${config.databaseId}/tables/bills/rows/${encodeURIComponent(billId)}`,
    { method: "GET" }
  );
  const resident = billRow.residentId
    ? (await listAppwriteResidentDirectory({ ensureSchema: false })).residents.find((item) => item.id === billRow.residentId)
    : undefined;
  const now = new Date().toISOString();
  const date = input.date || now.slice(0, 10);
  const existingPayments = await listAppwriteTableRows<AppwritePaymentRow>("payments");
  const paidBefore = existingPayments
    .filter((payment) => payment.billId === billId && payment.status === "confirmed")
    .reduce((sum, payment) => sum + numberOrZero(payment.amount), 0);
  const billAmount = numberOrZero(billRow.amount);
  const paymentAmount = amount;
  const paidAmount = paidBefore + paymentAmount;
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

  clearAppwriteAccountingCache();

  return {
    payment: mapPaymentRow(payment),
    bill: mapBillRow(updatedBill, resident)
  };
}

export function clearAppwriteAccountingCache() {
  accountingCache = null;
  summaryCache = null;
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

function residentBalanceMap(bills: Bill[]) {
  const balances = new Map<string, { outstanding: number; credit: number }>();

  for (const bill of bills) {
    const current = balances.get(bill.residentId) ?? { outstanding: 0, credit: 0 };
    const paidAmount = numberOrZero(bill.paidAmount);
    balances.set(bill.residentId, {
      outstanding: current.outstanding + Math.max(0, bill.amount - paidAmount),
      credit: current.credit + Math.max(0, paidAmount - bill.amount)
    });
  }

  return balances;
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

function channelLabel(value?: Payment["channel"]) {
  switch (value) {
    case "online":
      return "Online";
    case "cash":
      return "Cash";
    case "pos":
      return "POS";
    case "whatsapp_receipt":
      return "WhatsApp receipt";
    case "bank_transfer":
    default:
      return "Bank transfer";
  }
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
