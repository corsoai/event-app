import {
  APPWRITE_TABLE_AUDIT_LOGS,
  APPWRITE_TABLE_BILLS,
  APPWRITE_TABLE_PAYMENTS,
  APPWRITE_TABLE_PROPERTIES,
  APPWRITE_TABLE_RESIDENTS,
  APPWRITE_TABLE_UNITS
} from "@/lib/appwrite/schema";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteRequest,
  appwriteUpsertRow,
  getAppwriteServerConfig,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";

export interface AllocationParams {
  residentId: string;
  estateId: string;
  amountPaid: number;
  paymentDate: string;
  channel: string;
  reference: string;
  source: "manual_admin" | "monnify_webhook" | "system";
  recordedBy: string;
  monnifyTransactionRef?: string;
  monnifyPaymentRef?: string;
  notes?: string;
}

export interface BillAllocation {
  billId: string;
  billTitle: string;
  amountApplied: number;
  billFullySettled: boolean;
  remainingOnBill: number;
}

export interface ResidentSummary {
  totalPaidAllTime: number;
  outstandingBalance: number;
  advanceCredit: number;
  coverageThroughDate: string;
  nextDueDate: string;
  accountStatus: "fully_paid" | "in_credit" | "partially_paid" | "unpaid";
}

export interface AllocationResult {
  paymentId: string;
  totalAllocated: number;
  billsSettled: BillAllocation[];
  advanceCreditGenerated: number;
  monthsCreditCovers: number;
  residentSummary: ResidentSummary;
  success: boolean;
  errorMessage?: string;
}

type BillRow = {
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
  createdAt?: string;
  updatedAt?: string;
};

type PaymentRow = {
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

type ResidentRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  residentType?: string;
  status?: string;
  moveInDate?: string;
  legacyName?: string;
  legacyAddress?: string;
  sourceRow?: number;
  openingOutstanding?: number;
  expectedMonthly?: number;
  totalPaidAllTime?: number;
  advanceCredit?: number;
  coverageThroughDate?: string;
  nextDueDate?: string;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  onboardingStatus?: string;
  reviewReasons?: string;
  createdAt?: string;
  updatedAt?: string;
};

type UnitRow = {
  $id?: string;
  propertyId?: string;
  unitCode?: string;
  currentResidentId?: string;
};

type PropertyRow = {
  $id?: string;
  propertyCode?: string;
};

type AuditRow = {
  estateId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string;
  createdAt: string;
};

export async function allocatePayment(params: AllocationParams): Promise<AllocationResult> {
  validateAllocationParams(params);
  getAppwriteServerConfig();

  const now = new Date().toISOString();
  const resident = await getResidentRow(params.residentId);
  const identity = await resolveResidentIdentity(resident);
  const outstandingBills = await loadOutstandingBills(params.residentId);
  const allocationPlan = planBillAllocations(outstandingBills, params.amountPaid);
  const advanceCreditGenerated = Math.max(0, params.amountPaid - allocationPlan.totalAllocated);
  const paymentId = safeAppwriteId("pay", `${params.reference}:${params.residentId}`);

  await createPaymentRecord(paymentId, params, identity, allocationPlan.billsSettled, advanceCreditGenerated, now);

  try {
    await applyBillAllocations(outstandingBills, allocationPlan.billsSettled, now);
    const summary = await recalculateResidentSummary(params.residentId, params.amountPaid, params.paymentDate, resident, now);
    await writePaymentAudit(params, paymentId, allocationPlan.billsSettled.length, advanceCreditGenerated, now);

    return {
      paymentId,
      totalAllocated: allocationPlan.totalAllocated,
      billsSettled: allocationPlan.billsSettled,
      advanceCreditGenerated,
      monthsCreditCovers: summary.monthsCreditCovers,
      residentSummary: summary.residentSummary,
      success: true
    };
  } catch (error) {
    const summary = fallbackResidentSummary(params, resident, advanceCreditGenerated);
    const result: AllocationResult = {
      paymentId,
      totalAllocated: allocationPlan.totalAllocated,
      billsSettled: allocationPlan.billsSettled,
      advanceCreditGenerated,
      monthsCreditCovers: summary.monthsCreditCovers,
      residentSummary: summary.residentSummary,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Payment allocation reconciliation failed."
    };

    await writePaymentAudit(params, paymentId, allocationPlan.billsSettled.length, advanceCreditGenerated, now, result.errorMessage).catch(() => null);
    return result;
  }
}

export function simulateAllocationForTest(input: {
  amountPaid: number;
  outstandingBills: Array<{ id: string; title: string; amount: number; paidAmount: number; dueDate: string; category?: string; status?: string }>;
  totalPaidAllTimeBefore: number;
  totalBilled: number;
  monthlyRate: number;
}) {
  const bills = input.outstandingBills.map<BillRow>((bill) => ({
    $id: bill.id,
    title: bill.title,
    amount: bill.amount,
    paidAmount: bill.paidAmount,
    dueDate: bill.dueDate,
    category: bill.category,
    status: bill.status ?? "unpaid"
  }));
  const plan = planBillAllocations(orderBillsForAllocation(bills), input.amountPaid);
  const totalPaidAllTime = input.totalPaidAllTimeBefore + input.amountPaid;
  const outstandingBalance = Math.max(0, input.totalBilled - totalPaidAllTime);
  const advanceCredit = Math.max(0, totalPaidAllTime - input.totalBilled);
  const monthsCreditCovers = input.monthlyRate > 0 ? Math.floor(advanceCredit / input.monthlyRate) : 0;
  const latestPaidBillDate = latestSettledBillDate(bills, plan.billsSettled) || new Date().toISOString().slice(0, 10);
  const coverageThroughDate = addMonths(latestPaidBillDate, monthsCreditCovers);
  const nextDueDate = firstDayOfNextMonth(coverageThroughDate);

  return {
    ...plan,
    advanceCreditGenerated: Math.max(0, input.amountPaid - plan.totalAllocated),
    monthsCreditCovers,
    residentSummary: {
      totalPaidAllTime,
      outstandingBalance,
      advanceCredit,
      coverageThroughDate,
      nextDueDate,
      accountStatus: accountStatus(totalPaidAllTime, outstandingBalance, advanceCredit)
    }
  };
}

async function loadOutstandingBills(residentId: string) {
  const rows = await listAppwriteTableRows<BillRow>(APPWRITE_TABLE_BILLS);
  return orderBillsForAllocation(
    rows
      .filter((bill) => bill.residentId === residentId)
      .filter((bill) => !["paid", "waived"].includes((bill.status ?? "").toLowerCase()))
      .filter((bill) => billOutstandingAmount(bill) > 0)
  );
}

function orderBillsForAllocation(bills: BillRow[]) {
  return [...bills].sort((left, right) => {
    const leftOpening = isOpeningBalanceBill(left);
    const rightOpening = isOpeningBalanceBill(right);
    if (leftOpening !== rightOpening) return leftOpening ? -1 : 1;
    return (left.dueDate ?? "").localeCompare(right.dueDate ?? "");
  });
}

function planBillAllocations(bills: BillRow[], amountPaid: number) {
  let remainingAmount = amountPaid;
  const billsSettled: BillAllocation[] = [];

  for (const bill of bills) {
    if (remainingAmount <= 0) break;
    const billOutstanding = billOutstandingAmount(bill);
    if (billOutstanding <= 0) continue;
    const amountApplied = Math.min(remainingAmount, billOutstanding);
    billsSettled.push({
      billId: bill.$id ?? "",
      billTitle: bill.title ?? "Resident bill",
      amountApplied,
      billFullySettled: amountApplied >= billOutstanding,
      remainingOnBill: Math.max(0, billOutstanding - amountApplied)
    });
    remainingAmount -= amountApplied;
  }

  return {
    totalAllocated: billsSettled.reduce((sum, allocation) => sum + allocation.amountApplied, 0),
    billsSettled
  };
}

async function createPaymentRecord(
  paymentId: string,
  params: AllocationParams,
  identity: { propertyId?: string; unitId?: string; propertyCode?: string; unitCode?: string },
  billsSettled: BillAllocation[],
  advanceCreditGenerated: number,
  now: string
) {
  const primaryBillId = billsSettled[0]?.billId;
  return appwriteUpsertRow<PaymentRow>(APPWRITE_TABLE_PAYMENTS, paymentId, {
    estateId: params.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    propertyId: identity.propertyId,
    unitId: identity.unitId,
    propertyCode: identity.propertyCode,
    unitCode: identity.unitCode,
    residentId: params.residentId,
    billId: primaryBillId,
    amount: params.amountPaid,
    reference: params.reference,
    processor: params.source === "monnify_webhook" ? "monnify" : "manual",
    channel: params.channel,
    providerReference: params.monnifyPaymentRef ?? params.reference,
    date: params.paymentDate,
    status: "confirmed",
    source: params.source,
    confirmedAt: now,
    confirmedBy: params.recordedBy,
    recordedBy: params.recordedBy,
    allocations: JSON.stringify(billsSettled),
    advanceCreditGenerated,
    monnifyTransactionRef: params.monnifyTransactionRef,
    monnifyPaymentRef: params.monnifyPaymentRef,
    notes: params.notes,
    createdAt: now,
    updatedAt: now
  });
}

async function applyBillAllocations(bills: BillRow[], allocations: BillAllocation[], now: string) {
  const billsById = new Map(bills.map((bill) => [bill.$id ?? "", bill]));

  for (const allocation of allocations) {
    const bill = billsById.get(allocation.billId);
    if (!bill) continue;
    const billAmount = numberOrZero(bill.amount);
    const nextPaidAmount = allocation.billFullySettled
      ? billAmount
      : numberOrZero(bill.paidAmount) + allocation.amountApplied;

    await appwriteUpsertRow<BillRow>(APPWRITE_TABLE_BILLS, allocation.billId, {
      estateId: bill.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
      propertyId: bill.propertyId,
      unitId: bill.unitId,
      propertyCode: bill.propertyCode,
      unitCode: bill.unitCode,
      residentId: bill.residentId,
      category: bill.category ?? "Subscription",
      title: bill.title ?? "Resident bill",
      amount: billAmount,
      paidAmount: nextPaidAmount,
      dueDate: bill.dueDate ?? new Date().toISOString().slice(0, 10),
      status: allocation.billFullySettled ? "paid" : "partially paid",
      createdAt: bill.createdAt,
      updatedAt: now
    });
  }
}

async function recalculateResidentSummary(
  residentId: string,
  amountPaid: number,
  paymentDate: string,
  resident: ResidentRow,
  now: string
) {
  const [payments, bills] = await Promise.all([
    listAppwriteTableRows<PaymentRow>(APPWRITE_TABLE_PAYMENTS),
    listAppwriteTableRows<BillRow>(APPWRITE_TABLE_BILLS)
  ]);
  const residentPayments = payments.filter((payment) => (
    payment.residentId === residentId &&
    payment.status === "confirmed" &&
    payment.channel !== "credit_applied" &&
    payment.source !== "system"
  ));
  const residentBills = bills.filter((bill) => bill.residentId === residentId);
  const totalPaidAllTime = residentPayments.reduce((sum, payment) => sum + numberOrZero(payment.amount), 0);
  const totalBilled = residentBills.reduce((sum, bill) => sum + numberOrZero(bill.amount), 0);
  const outstandingBalance = Math.max(0, totalBilled - totalPaidAllTime);
  const advanceCredit = Math.max(0, totalPaidAllTime - totalBilled);
  const monthlyRate = numberOrZero(resident.expectedMonthly);
  const monthsCreditCovers = monthlyRate > 0 ? Math.floor(advanceCredit / monthlyRate) : 0;
  const latestPaidDate = latestPaidBillDueDate(residentBills) || paymentDate;
  const coverageThroughDate = addMonths(latestPaidDate, monthsCreditCovers);
  const nextDueDate = firstDayOfNextMonth(coverageThroughDate);
  const residentSummary: ResidentSummary = {
    totalPaidAllTime,
    outstandingBalance,
    advanceCredit,
    coverageThroughDate,
    nextDueDate,
    accountStatus: accountStatus(totalPaidAllTime, outstandingBalance, advanceCredit)
  };

  await updateResidentSummary(residentId, resident, residentSummary, paymentDate, amountPaid, now);

  return {
    monthsCreditCovers,
    residentSummary
  };
}

async function updateResidentSummary(
  residentId: string,
  resident: ResidentRow,
  summary: ResidentSummary,
  paymentDate: string,
  amountPaid: number,
  now: string
) {
  await appwriteUpsertRow<ResidentRow>(APPWRITE_TABLE_RESIDENTS, residentId, {
    estateId: resident.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
    propertyId: resident.propertyId,
    unitId: resident.unitId,
    fullName: resident.fullName ?? "Unnamed resident",
    phone: resident.phone ?? "",
    email: resident.email ?? "",
    residentType: resident.residentType ?? "tenant",
    status: resident.status ?? "active",
    moveInDate: resident.moveInDate,
    legacyName: resident.legacyName,
    legacyAddress: resident.legacyAddress,
    sourceRow: resident.sourceRow,
    openingOutstanding: summary.outstandingBalance,
    expectedMonthly: numberOrZero(resident.expectedMonthly),
    totalPaidAllTime: summary.totalPaidAllTime,
    advanceCredit: summary.advanceCredit,
    coverageThroughDate: summary.coverageThroughDate,
    nextDueDate: summary.nextDueDate,
    lastPaymentDate: paymentDate,
    lastPaymentAmount: amountPaid,
    onboardingStatus: resident.onboardingStatus ?? "verified",
    reviewReasons: resident.reviewReasons,
    createdAt: resident.createdAt,
    updatedAt: now
  });
}

async function writePaymentAudit(
  params: AllocationParams,
  paymentId: string,
  billsSettledCount: number,
  advanceCreditGenerated: number,
  now: string,
  reconciliationError?: string
) {
  await appwriteUpsertRow<AuditRow>(APPWRITE_TABLE_AUDIT_LOGS, safeAppwriteId("audit", `payment-recorded-${paymentId}-${now}`), {
    estateId: params.estateId || APPWRITE_LBSVIEW_ESTATE_ID,
    actor: params.recordedBy,
    action: "payment_recorded",
    entityType: "payment",
    entityId: paymentId,
    metadata: JSON.stringify({
      amount: params.amountPaid,
      channel: params.channel,
      source: params.source,
      billsSettledCount,
      advanceCreditGenerated,
      reconciliationError: reconciliationError ?? ""
    }),
    createdAt: now
  });
}

async function getResidentRow(residentId: string) {
  const config = getAppwriteServerConfig();
  return appwriteRequest<ResidentRow>(
    `/tablesdb/${config.databaseId}/tables/${APPWRITE_TABLE_RESIDENTS}/rows/${encodeURIComponent(residentId)}`,
    { method: "GET" }
  );
}

async function resolveResidentIdentity(resident: ResidentRow) {
  const [units, properties] = await Promise.all([
    listAppwriteTableRows<UnitRow>(APPWRITE_TABLE_UNITS),
    listAppwriteTableRows<PropertyRow>(APPWRITE_TABLE_PROPERTIES)
  ]);
  const unit = units.find((item) => item.$id === resident.unitId || item.currentResidentId === resident.$id);
  const property = properties.find((item) => item.$id === (resident.propertyId ?? unit?.propertyId));

  return {
    propertyId: resident.propertyId ?? unit?.propertyId,
    unitId: resident.unitId ?? unit?.$id,
    propertyCode: property?.propertyCode,
    unitCode: unit?.unitCode
  };
}

function fallbackResidentSummary(params: AllocationParams, resident: ResidentRow, advanceCreditGenerated: number) {
  const monthlyRate = numberOrZero(resident.expectedMonthly);
  const monthsCreditCovers = monthlyRate > 0 ? Math.floor(advanceCreditGenerated / monthlyRate) : 0;
  const coverageThroughDate = addMonths(params.paymentDate, monthsCreditCovers);
  return {
    monthsCreditCovers,
    residentSummary: {
      totalPaidAllTime: params.amountPaid,
      outstandingBalance: 0,
      advanceCredit: advanceCreditGenerated,
      coverageThroughDate,
      nextDueDate: firstDayOfNextMonth(coverageThroughDate),
      accountStatus: advanceCreditGenerated > 0 ? "in_credit" : "fully_paid"
    } satisfies ResidentSummary
  };
}

function latestPaidBillDueDate(bills: BillRow[]) {
  return bills
    .filter((bill) => ["paid", "waived"].includes((bill.status ?? "").toLowerCase()) || billOutstandingAmount(bill) <= 0)
    .map((bill) => bill.dueDate ?? "")
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}

function latestSettledBillDate(bills: BillRow[], allocations: BillAllocation[]) {
  const settledIds = new Set(allocations.filter((allocation) => allocation.billFullySettled).map((allocation) => allocation.billId));
  return bills
    .filter((bill) => settledIds.has(bill.$id ?? ""))
    .map((bill) => bill.dueDate ?? "")
    .filter(Boolean)
    .sort()
    .at(-1) ?? "";
}

function billOutstandingAmount(bill: BillRow) {
  return Math.max(0, numberOrZero(bill.amount) - numberOrZero(bill.paidAmount));
}

function isOpeningBalanceBill(bill: BillRow) {
  const category = (bill.category ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return category === "opening_balance";
}

function accountStatus(totalPaidAllTime: number, outstandingBalance: number, advanceCredit: number): ResidentSummary["accountStatus"] {
  if (advanceCredit > 0) return "in_credit";
  if (outstandingBalance === 0) return "fully_paid";
  if (totalPaidAllTime === 0) return "unpaid";
  return "partially_paid";
}

function addMonths(value: string, months: number) {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + Math.max(0, months));
  return date.toISOString().slice(0, 10);
}

function firstDayOfNextMonth(value: string) {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
}

function validateAllocationParams(params: AllocationParams) {
  if (!params.residentId.trim()) throw new Error("Resident is required for payment allocation.");
  if (!params.reference.trim()) throw new Error("Payment reference is required.");
  if (params.amountPaid <= 0) throw new Error("Payment amount must be greater than zero.");
}

function numberOrZero(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
