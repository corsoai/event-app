import type { AuditLog, Bill, Payment, PaymentChannel, Resident } from "@/lib/types";
import { APPWRITE_LBSVIEW_ESTATE_ID, appwriteRequest, appwriteUpsertRow, getAppwriteServerConfig, safeAppwriteId, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory, listAppwriteTableRows, type AppwriteResidentDirectory } from "@/lib/appwrite/residents";
import { allocatePayment, type AllocationResult } from "@/lib/appwrite/payment-allocation";
import { normalizePhoneNumber } from "@/lib/utils";

type AppwriteBillRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  propertyCode?: string;
  unitCode?: string;
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
  propertyCode?: string;
  unitCode?: string;
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
  recordedBy?: string;
  allocations?: string;
  advanceCreditGenerated?: number;
  monnifyTransactionRef?: string;
  monnifyPaymentRef?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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

export type AppwritePaymentResult = {
  payment: Payment;
  bill: Bill;
  allocation: AllocationResult;
};

export type AppwriteBillInput = {
  residentId: string;
  title: string;
  amount: number;
  dueDate: string;
  category?: string;
};

export type AppwriteResidentAccountingIdentity = {
  email?: string;
  phone?: string;
  fullName?: string;
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

export async function listAppwriteResidentAccounting(
  identity: AppwriteResidentAccountingIdentity,
  options: { bypassCache?: boolean; ensureSchema?: boolean } = {}
): Promise<AppwriteAccountingData & { matchedResidentId: string | null }> {
  const accounting = await listAppwriteAccounting(options);
  const resident = findAccountingResident(accounting.residents, identity);

  if (!resident) {
    return {
      properties: [],
      units: [],
      residents: [],
      bills: [],
      payments: [],
      auditLogs: [],
      total: {
        properties: 0,
        units: 0,
        residents: 0,
        bills: 0,
        payments: 0
      },
      matchedResidentId: null
    };
  }

  const bills = accounting.bills.filter((bill) => bill.residentId === resident.id);
  const billIds = new Set(bills.map((bill) => bill.id));
  const payments = accounting.payments.filter((payment) => payment.residentId === resident.id || billIds.has(payment.billId));
  const propertyIds = new Set([resident.propertyId, ...bills.map((bill) => bill.propertyId)].filter(Boolean));
  const unitIds = new Set([resident.unitId, ...bills.map((bill) => bill.unitId)].filter(Boolean));
  const properties = accounting.properties.filter((property) => propertyIds.has(property.id));
  const units = accounting.units.filter((unit) => unitIds.has(unit.id) || unit.currentResidentId === resident.id);

  return {
    properties,
    units,
    residents: [resident],
    bills,
    payments,
    auditLogs: [],
    total: {
      properties: properties.length,
      units: units.length,
      residents: 1,
      bills: bills.length,
      payments: payments.length
    },
    matchedResidentId: resident.id
  };
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

export async function recordAppwriteAdminPayment(input: AppwritePaymentInput): Promise<AppwritePaymentResult> {
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
  if (!resident && !billRow.residentId) {
    throw new Error("The selected bill is not linked to a resident.");
  }
  const date = input.date || new Date().toISOString().slice(0, 10);
  const residentId = billRow.residentId ?? resident?.id ?? "";
  const allocation = await allocatePayment({
    residentId,
    estateId: billRow.estateId ?? resident?.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    amountPaid: amount,
    paymentDate: date,
    channel: input.channel,
    reference,
    source: "manual_admin",
    recordedBy: "Estate admin",
    notes: `Recorded from admin payment form for bill ${billId}.`
  });
  if (!allocation.success) {
    console.error("Payment allocation reconciliation failed", allocation.errorMessage);
  }

  const payment = await appwriteRequest<AppwritePaymentRow>(
    `/tablesdb/${config.databaseId}/tables/payments/rows/${encodeURIComponent(allocation.paymentId)}`,
    { method: "GET" }
  );
  const updatedBill = await appwriteRequest<AppwriteBillRow>(
    `/tablesdb/${config.databaseId}/tables/bills/rows/${encodeURIComponent(billId)}`,
    { method: "GET" }
  );

  clearAppwriteAccountingCache();

  return {
    payment: mapPaymentRow(payment),
    bill: mapBillRow(updatedBill, resident),
    allocation
  };
}

export async function createAppwriteBill(input: AppwriteBillInput) {
  const residentId = input.residentId.trim();
  const title = input.title.trim();
  const amount = Math.max(0, Number(input.amount));
  const dueDate = input.dueDate.trim();
  if (!residentId || !title || amount <= 0 || !dueDate) {
    throw new Error("Resident, title, amount, and due date are required.");
  }

  const directory = await listAppwriteResidentDirectory({ ensureSchema: false });
  const resident = directory.residents.find((item) => item.id === residentId);
  if (!resident) {
    throw new Error("The selected resident was not found in Appwrite.");
  }

  const now = new Date().toISOString();
  const category = input.category?.trim() || "Subscription";
  const billId = safeAppwriteId("bill", `${residentId}:${title}:${dueDate}:${now}`);
  const bill = await appwriteUpsertRow<AppwriteBillRow>("bills", billId, {
    estateId: resident.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    propertyId: resident.propertyId,
    unitId: resident.unitId,
    residentId,
    category,
    title,
    amount,
    paidAmount: 0,
    dueDate,
    status: "unpaid"
  });

  await appwriteUpsertRow<AppwriteAuditRow>("audit_logs", safeAppwriteId("audit", `create-bill-${billId}-${now}`), {
    estateId: resident.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    actor: "Estate admin",
    action: "created bill",
    entityType: "bill",
    entityId: billId,
    metadata: JSON.stringify({
      residentId,
      amount,
      category,
      dueDate
    }),
    createdAt: now
  });

  clearAppwriteAccountingCache();

  return {
    bill: mapBillRow(bill, resident)
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

function findAccountingResident(residents: Resident[], identity: AppwriteResidentAccountingIdentity) {
  const email = identity.email?.trim().toLowerCase() ?? "";
  const phone = normalizePhoneNumber(identity.phone ?? "");
  const fullName = identity.fullName?.trim().toLowerCase() ?? "";

  if (phone) {
    const byPhone = residents.find((resident) => normalizePhoneNumber(resident.phone ?? "") === phone);
    if (byPhone) return byPhone;
  }

  if (email) {
    const byEmail = residents.find((resident) => resident.email.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  if (fullName) {
    const byName = residents.find((resident) => resident.name.trim().toLowerCase() === fullName);
    if (byName) return byName;
  }

  return undefined;
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
