import type { AuditLog, Bill, Payment, PaymentChannel, Resident } from "@/lib/types";
import { APPWRITE_LBSVIEW_ESTATE_ID, appwriteRequest, appwriteUpsertRow, getAppwriteServerConfig, safeAppwriteId, setupAppwriteOnboardingSchema } from "@/lib/appwrite/server";
import { listAppwriteResidentDirectory, listAppwriteTableRows, type AppwriteEstateScope, type AppwriteResidentDirectory } from "@/lib/appwrite/residents";
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
  billingMonth?: string;
  status?: string;
  createdBy?: string;
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
  $id?: string;
  expectedMonthly?: number;
};

export type ResidentAccountStatus = "fully_paid" | "in_credit" | "partially_paid" | "unpaid";

export type ResidentAccountingSummary = {
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  advanceCredit: number;
  monthlyRate: number;
  monthsCreditCovers: number;
  coverageThroughDate: string;
  nextDueDate: string;
  accountStatus: ResidentAccountStatus;
  statusBannerText: string;
  lastPaymentDate: string | null;
  lastPaymentAmount: number;
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
  estateId?: string | null;
  includeAllEstates?: boolean;
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
  estateId?: string | null;
  includeAllEstates?: boolean;
};

export type AppwriteResidentAccountingIdentity = {
  residentId?: string;
  houseNumber?: string;
  email?: string;
  phone?: string;
  fullName?: string;
};

const ACCOUNTING_CACHE_MS = 30_000;
let accountingCache: { key: string; data: AppwriteAccountingData; expiresAt: number } | null = null;
let summaryCache: { key: string; data: AppwriteAccountingSummary; expiresAt: number } | null = null;

export async function listAppwriteAccounting(
  options: { bypassCache?: boolean; ensureSchema?: boolean } & AppwriteEstateScope = {}
) {
  const scope = accountingScope(options);
  if (!options.bypassCache && accountingCache?.key === scope.cacheKey && accountingCache.expiresAt > Date.now()) {
    return accountingCache.data;
  }

  if (options.ensureSchema) {
    await setupAppwriteOnboardingSchema();
  }

  const [directory, billRows, paymentRows, auditRows] = await Promise.all([
    listAppwriteResidentDirectory({ ensureSchema: false, ...scope }),
    listAppwriteTableRows<AppwriteBillRow>("bills", scope),
    listAppwriteTableRows<AppwritePaymentRow>("payments", scope),
    listAppwriteTableRows<AppwriteAuditRow>("audit_logs", scope)
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

  accountingCache = { key: scope.cacheKey, data, expiresAt: Date.now() + ACCOUNTING_CACHE_MS };
  return data;
}

export async function listAppwriteResidentAccounting(
  identity: AppwriteResidentAccountingIdentity,
  options: ({ bypassCache?: boolean; ensureSchema?: boolean } & AppwriteEstateScope) = {}
): Promise<AppwriteAccountingData & {
  matchedResidentId: string | null;
  resident: Resident | null;
  summary: ResidentAccountingSummary | null;
}> {
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
      matchedResidentId: null,
      resident: null,
      summary: null
    };
  }

  const bills = accounting.bills
    .filter((bill) => bill.residentId === resident.id)
    .sort((left, right) => dateSortValue(left.dueDate) - dateSortValue(right.dueDate));
  const billIds = new Set(bills.map((bill) => bill.id));
  const payments = accounting.payments
    .filter((payment) => payment.status === "confirmed" && (payment.residentId === resident.id || billIds.has(payment.billId)))
    .sort((left, right) => dateSortValue(left.date) - dateSortValue(right.date));
  const propertyIds = new Set([resident.propertyId, ...bills.map((bill) => bill.propertyId)].filter(Boolean));
  const unitIds = new Set([resident.unitId, ...bills.map((bill) => bill.unitId)].filter(Boolean));
  const properties = accounting.properties.filter((property) => propertyIds.has(property.id));
  const units = accounting.units.filter((unit) => unitIds.has(unit.id) || unit.currentResidentId === resident.id);
  const summary = buildResidentAccountingSummary(resident, bills, payments);

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
    matchedResidentId: resident.id,
    resident,
    summary
  };
}

export async function getAppwriteAccountingSummary(
  options: { bypassCache?: boolean; ensureSchema?: boolean } & AppwriteEstateScope = {}
): Promise<AppwriteAccountingSummary> {
  const scope = accountingScope(options);
  if (!options.bypassCache && summaryCache?.key === scope.cacheKey && summaryCache.expiresAt > Date.now()) {
    return summaryCache.data;
  }

  if (options.ensureSchema) {
    await setupAppwriteOnboardingSchema();
  }

  const [residentRows, billRows, paymentRows] = await Promise.all([
    listAppwriteTableRows<AppwriteAccountingResidentRow>("residents", scope),
    listAppwriteTableRows<AppwriteBillRow>("bills", scope),
    listAppwriteTableRows<AppwritePaymentRow>("payments", scope)
  ]);
  const payments = paymentRows.map(mapPaymentRow);
  const bills = normalizeBillsWithPayments(billRows.map((row) => mapBillRow(row)), payments);
  const confirmedPayments = payments.filter((payment) => payment.status === "confirmed" && payment.channel !== "credit_applied");
  const residentBalances = residentRows.map((resident) => {
    const residentId = String(resident.$id ?? "").trim();
    const residentBills = residentId ? bills.filter((bill) => bill.residentId === residentId) : [];
    const residentPayments = residentId ? payments.filter((payment) => payment.residentId === residentId) : [];

    return buildResidentBillingProjection({
      bills: residentBills,
      payments: residentPayments,
      monthlyRate: numberOrZero(resident.expectedMonthly)
    });
  });
  const expectedRevenue = residentBalances.reduce((sum, balance) => sum + balance.totalBilled, 0);
  const paidAmount = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingBalance = residentBalances.reduce((sum, balance) => sum + balance.outstandingBalance, 0);
  const creditBalance = residentBalances.reduce((sum, balance) => sum + balance.advanceCredit, 0);
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
    const method = isOnlinePaymentChannel(payment.channel) ? "online" : "manual";
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
    debtorsCount: residentBalances.filter((balance) => balance.outstandingBalance > 0).length,
    residentsInCredit: residentBalances.filter((balance) => balance.advanceCredit > 0).length,
    monthlyExpected: residentRows.reduce((sum, resident) => sum + numberOrZero(resident.expectedMonthly), 0),
    residentsCount: residentRows.length,
    billsCount: bills.length,
    paymentsCount: payments.length,
    channelTotals,
    paymentStatusTotals,
    categoryTotals,
    generatedAt: new Date().toISOString()
  };

  summaryCache = { key: scope.cacheKey, data, expiresAt: Date.now() + ACCOUNTING_CACHE_MS };
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
    ? (await listAppwriteResidentDirectory({ ensureSchema: false, estateId: input.estateId, includeAllEstates: input.includeAllEstates })).residents.find((item) => item.id === billRow.residentId)
    : undefined;
  assertEstateScope(billRow.estateId ?? resident?.estateId, input, "The selected bill does not belong to your estate.");
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

  const directory = await listAppwriteResidentDirectory({
    ensureSchema: false,
    estateId: input.estateId,
    includeAllEstates: input.includeAllEstates
  });
  const resident = directory.residents.find((item) => item.id === residentId);
  if (!resident) {
    throw new Error("The selected resident was not found in Corso.");
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

function accountingScope(scope: AppwriteEstateScope) {
  if (scope.includeAllEstates) {
    return { includeAllEstates: true, estateId: null, cacheKey: "all-estates" };
  }

  const estateId = typeof scope.estateId === "string" ? scope.estateId.trim() : "";
  return estateId
    ? { includeAllEstates: false, estateId, cacheKey: `estate:${estateId}` }
    : { includeAllEstates: true, estateId: null, cacheKey: "all-estates" };
}

function assertEstateScope(rowEstateId: string | undefined, scope: AppwriteEstateScope, message: string) {
  const estateId = scope.includeAllEstates ? "" : String(scope.estateId ?? "").trim();
  if (estateId && rowEstateId !== estateId) {
    throw new Error(message);
  }
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


function findAccountingResident(residents: Resident[], identity: AppwriteResidentAccountingIdentity) {
  const residentId = identity.residentId?.trim() ?? "";
  const houseNumber = identity.houseNumber?.trim().toLowerCase() ?? "";
  const email = identity.email?.trim().toLowerCase() ?? "";
  const phone = normalizePhoneNumber(identity.phone ?? "");
  const fullName = identity.fullName?.trim().toLowerCase() ?? "";

  if (residentId) {
    const byId = residents.find((resident) => resident.id === residentId);
    if (byId) return byId;
  }

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

  if (houseNumber) {
    const unitMatches = residents.filter((resident) => resident.houseNumber.trim().toLowerCase() === houseNumber);
    if (unitMatches.length === 1) return unitMatches[0];
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
    billingMonth: optionalText(row.billingMonth),
    status: billStatus(amount, paidAmount, row.status)
  };
}

function buildResidentAccountingSummary(resident: Resident, bills: Bill[], payments: Payment[]): ResidentAccountingSummary {
  const balance = buildResidentBillingProjection({
    bills,
    payments,
    monthlyRate: numberOrZero(resident.expectedMonthly)
  });

  return {
    totalBilled: balance.totalBilled,
    totalPaid: balance.totalPaid,
    outstandingBalance: balance.outstandingBalance,
    advanceCredit: balance.advanceCredit,
    monthlyRate: balance.monthlyRate,
    monthsCreditCovers: balance.monthsCreditCovers,
    coverageThroughDate: isoDate(balance.coverageThroughDate),
    nextDueDate: isoDate(balance.nextDueDate),
    accountStatus: balance.accountStatus,
    statusBannerText: residentStatusBannerText({
      accountStatus: balance.accountStatus,
      outstandingBalance: balance.outstandingBalance,
      advanceCredit: balance.advanceCredit,
      monthlyRate: balance.monthlyRate,
      monthsCreditCovers: balance.monthsCreditCovers,
      coverageThroughDate: balance.coverageThroughDate,
      nextDueDate: balance.nextDueDate
    }),
    lastPaymentDate: balance.lastPayment?.date ?? null,
    lastPaymentAmount: balance.lastPayment?.amount ?? 0
  };
}

function buildResidentBillingProjection(input: { bills: Bill[]; payments: Payment[]; monthlyRate: number }) {
  const totalHistoricalBilled = input.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const realPayments = input.payments.filter((payment) => payment.status === "confirmed" && payment.channel !== "credit_applied");
  const totalPaid = realPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const monthlyRate = numberOrZero(input.monthlyRate);
  const latestPaidBill = [...input.bills]
    .filter((bill) => bill.status === "paid")
    .sort((left, right) => dateSortValue(right.dueDate) - dateSortValue(left.dueDate))[0];
  const latestBill = [...input.bills].sort((left, right) => dateSortValue(right.dueDate) - dateSortValue(left.dueDate))[0];
  const baseCoverageDate = parseIsoDate(latestPaidBill?.dueDate) ?? parseIsoDate(latestBill?.dueDate) ?? addMonths(firstDayOfCurrentMonth(), -1);
  const firstUnbilledDueDate = firstDayOfNextMonth(baseCoverageDate);
  const projectedDueMonths = monthlyRate > 0 ? dueMonthCount(firstUnbilledDueDate, new Date()) : 0;
  const totalBilled = totalHistoricalBilled + projectedDueMonths * monthlyRate;
  const outstandingBalance = Math.max(0, totalBilled - totalPaid);
  const advanceCredit = Math.max(0, totalPaid - totalBilled);
  const monthsCreditCovers = monthlyRate > 0 ? Math.floor(advanceCredit / monthlyRate) : 0;
  const paidCoverageMonths = outstandingBalance > 0 ? 0 : projectedDueMonths + monthsCreditCovers;
  const coverageThroughDate = addMonths(baseCoverageDate, paidCoverageMonths);
  const nextDueDate = outstandingBalance > 0 ? firstUnbilledDueDate : firstDayOfNextMonth(coverageThroughDate);
  const accountStatus = residentAccountStatus(totalPaid, outstandingBalance, advanceCredit);
  const lastPayment = realPayments[realPayments.length - 1] ?? null;

  return {
    totalBilled,
    totalPaid,
    outstandingBalance,
    advanceCredit,
    monthlyRate,
    monthsCreditCovers,
    coverageThroughDate,
    nextDueDate,
    accountStatus,
    lastPayment
  };
}
function residentAccountStatus(totalPaid: number, outstandingBalance: number, advanceCredit: number): ResidentAccountStatus {
  if (advanceCredit > 0) return "in_credit";
  if (outstandingBalance === 0) return "fully_paid";
  if (totalPaid === 0) return "unpaid";
  return "partially_paid";
}

function residentStatusBannerText(input: {
  accountStatus: ResidentAccountStatus;
  outstandingBalance: number;
  advanceCredit: number;
  monthlyRate: number;
  monthsCreditCovers: number;
  coverageThroughDate: Date;
  nextDueDate: Date;
}) {
  const rate = currencyText(input.monthlyRate);
  const nextDueDate = displayDate(input.nextDueDate);
  const coverageMonth = monthYear(input.coverageThroughDate);

  if (input.accountStatus === "fully_paid") {
    return `Your subscription is fully paid through ${coverageMonth}. Next payment of ${rate} is due ${nextDueDate}.`;
  }

  if (input.accountStatus === "in_credit") {
    return `You have ${currencyText(input.advanceCredit)} advance credit covering ${input.monthsCreditCovers} months through ${coverageMonth}. Next payment due ${nextDueDate}.`;
  }

  if (input.accountStatus === "partially_paid") {
    return `You have ${currencyText(input.outstandingBalance)} outstanding. Please pay by ${nextDueDate} to keep your account current.`;
  }

  return `Your account has ${currencyText(input.outstandingBalance)} outstanding. Please make payment as soon as possible.`;
}

function parseIsoDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstDayOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function dueMonthCount(nextDueDate: Date, asOf: Date) {
  const dueMonth = firstDayOfMonth(nextDueDate);
  const currentMonth = firstDayOfMonth(asOf);
  if (currentMonth.getTime() < dueMonth.getTime()) return 0;

  return (currentMonth.getUTCFullYear() - dueMonth.getUTCFullYear()) * 12
    + currentMonth.getUTCMonth() - dueMonth.getUTCMonth()
    + 1;
}

function firstDayOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function firstDayOfNextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateSortValue(value?: string) {
  return parseIsoDate(value)?.getTime() ?? 0;
}

function currencyText(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  }).format(value);
}

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function monthYear(date: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
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
    source: mapPaymentSource(row.source),
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
  if (
    value === "online" ||
    value === "monnify_card" ||
    value === "monnify_transfer" ||
    value === "monnify_virtual_account" ||
    value === "cash" ||
    value === "pos" ||
    value === "whatsapp_receipt" ||
    value === "credit_applied"
  ) {
    return value;
  }

  return "bank_transfer";
}

function channelLabel(value?: Payment["channel"]) {
  switch (value) {
    case "online":
      return "Online";
    case "monnify_card":
      return "Monnify card";
    case "monnify_transfer":
      return "Monnify transfer";
    case "monnify_virtual_account":
      return "Monnify virtual account";
    case "cash":
      return "Cash";
    case "pos":
      return "POS";
    case "whatsapp_receipt":
      return "WhatsApp receipt";
    case "credit_applied":
      return "Credit applied";
    case "bank_transfer":
    default:
      return "Bank transfer";
  }
}

function isOnlinePaymentChannel(value?: Payment["channel"]) {
  return value === "online" || value === "monnify_card" || value === "monnify_transfer" || value === "monnify_virtual_account";
}

function mapPaymentSource(value?: string): Payment["source"] {
  if (
    value === "resident" ||
    value === "webhook" ||
    value === "monnify_online" ||
    value === "monnify_webhook"
  ) {
    return value;
  }

  return "admin";
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
