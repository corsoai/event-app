import {
  APPWRITE_TABLE_BILLS,
  APPWRITE_TABLE_MONTHLY_BILLING_RUNS,
  APPWRITE_TABLE_PAYMENTS,
  APPWRITE_TABLE_PROPERTIES,
  APPWRITE_TABLE_RESIDENTS,
  APPWRITE_TABLE_SUBSCRIPTION_RATES,
  APPWRITE_TABLE_UNITS
} from "@/lib/appwrite/schema";
import { APPWRITE_LBSVIEW_ESTATE_ID, appwriteUpsertRow, safeAppwriteId } from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";
import { allocatePayment } from "@/lib/appwrite/payment-allocation";

export interface BillingRunParams {
  estateId: string;
  billingMonth: string;
  runBy: string;
  runByName: string;
  dryRun: boolean;
}

export interface BillingRunResult {
  billingMonth: string;
  dryRun: boolean;
  totalResidents: number;
  billsCreated: number;
  autoPaidFromCredit: number;
  requiresPayment: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{
    residentId: string;
    residentName: string;
    reason: string;
  }>;
  summary: BillingResidentSummary[];
}

export type BillingResidentSummary = {
  residentId: string;
  residentName: string;
  unitCode: string;
  monthlyRate: number;
  billCreated: boolean;
  autoPaid: boolean;
  creditUsed: number;
  creditRemaining: number;
  action: string;
};

type ResidentRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  fullName?: string;
  residentType?: string;
  status?: string;
  role?: string;
  userRole?: string;
  residentStatus?: string;
  openingOutstanding?: number;
  expectedMonthly?: number;
  createdAt?: string;
  updatedAt?: string;
};

type UnitRow = {
  $id?: string;
  estateId?: string;
  propertyId?: string;
  unitCode?: string;
  apartmentType?: string;
  status?: string;
  currentResidentId?: string;
};

type PropertyRow = {
  $id?: string;
  propertyCode?: string;
};

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
  billingMonth?: string;
  status?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PaymentRow = {
  residentId?: string;
  amount?: number;
  status?: string;
  channel?: string;
  source?: string;
};

type SubscriptionRateRow = {
  estateId?: string;
  apartmentType?: string;
  monthlyRate?: number;
  effectiveTo?: string;
};

type BillingRunRow = {
  $id?: string;
  estateId?: string;
  billingMonth?: string;
  runDate?: string;
  runBy?: string;
  runByName?: string;
  totalResidents?: number;
  billsCreated?: number;
  autoPaidFromCredit?: number;
  requiresPayment?: number;
  skipped?: number;
  errors?: number;
  errorDetails?: string;
  status?: string;
  createdAt?: string;
};

type BillingTarget = {
  resident: ResidentRow;
  unit?: UnitRow;
  property?: PropertyRow;
};

export async function runMonthlyBilling(params: BillingRunParams): Promise<BillingRunResult> {
  validateBillingMonth(params.billingMonth);
  const now = new Date().toISOString();
  const dueDate = `${params.billingMonth}-01`;
  const title = `Monthly Subscription - ${monthTitle(params.billingMonth)}`;
  const [residents, units, properties, bills, payments, rates] = await Promise.all([
    listAppwriteTableRows<ResidentRow>(APPWRITE_TABLE_RESIDENTS),
    listAppwriteTableRows<UnitRow>(APPWRITE_TABLE_UNITS),
    listAppwriteTableRows<PropertyRow>(APPWRITE_TABLE_PROPERTIES),
    listAppwriteTableRows<BillRow>(APPWRITE_TABLE_BILLS),
    listAppwriteTableRows<PaymentRow>(APPWRITE_TABLE_PAYMENTS),
    listAppwriteTableRows<SubscriptionRateRow>(APPWRITE_TABLE_SUBSCRIPTION_RATES)
  ]);
  const activeResidents = residents.filter((resident) => resident.estateId === params.estateId && normalized(resident.status) === "active");
  const targets = activeResidents.flatMap((resident) => targetsForResident(resident, units, properties));
  const result: BillingRunResult = {
    billingMonth: params.billingMonth,
    dryRun: params.dryRun,
    totalResidents: targets.length,
    billsCreated: 0,
    autoPaidFromCredit: 0,
    requiresPayment: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    summary: []
  };

  for (const target of targets) {
    try {
      const skipReason = skipReasonFor(target.resident);
      if (skipReason) {
        result.skipped += 1;
        result.summary.push(summaryForSkipped(target, skipReason));
        continue;
      }

      const monthlyRate = monthlyRateFor(target, rates);
      if (monthlyRate <= 0) {
        result.skipped += 1;
        result.summary.push(summaryForSkipped(target, "missing monthly subscription rate"));
        continue;
      }

      const duplicate = bills.some((bill) => (
        bill.residentId === target.resident.$id &&
        bill.billingMonth === params.billingMonth &&
        normalized(bill.category) === "subscription" &&
        sameOptionalId(bill.unitId, target.unit?.$id ?? target.resident.unitId)
      ));
      if (duplicate) {
        result.skipped += 1;
        result.summary.push(summaryForSkipped(target, "bill already exists for this month", monthlyRate));
        continue;
      }

      const creditBalance = creditBalanceFor(target.resident.$id ?? "", bills, payments);
      const creditUsed = Math.min(creditBalance, monthlyRate);
      const autoPaid = creditUsed >= monthlyRate;
      const partialCredit = creditUsed > 0 && creditUsed < monthlyRate;
      const billId = safeAppwriteId("bill", `${params.billingMonth}:${target.resident.$id}:${target.unit?.$id ?? target.resident.unitId}:subscription`);
      const billData = billPayload({
        billId,
        target,
        estateId: params.estateId,
        title,
        amount: monthlyRate,
        dueDate,
        billingMonth: params.billingMonth,
        runBy: params.runBy,
        now
      });

      result.billsCreated += 1;

      if (!params.dryRun) {
        await appwriteUpsertRow<BillRow>(APPWRITE_TABLE_BILLS, billId, billData);
        if (creditUsed > 0) {
          await allocatePayment({
            residentId: target.resident.$id ?? "",
            estateId: params.estateId,
            amountPaid: creditUsed,
            paymentDate: dueDate,
            channel: "credit_applied",
            reference: `CREDIT-${params.billingMonth}-${target.resident.$id}`,
            source: "system",
            recordedBy: params.runByName || "system",
            notes: "Auto-applied from advance credit balance"
          });
        }
      }

      if (autoPaid) {
        result.autoPaidFromCredit += 1;
      } else {
        result.requiresPayment += 1;
      }

      result.summary.push({
        residentId: target.resident.$id ?? "",
        residentName: target.resident.fullName ?? "Unnamed resident",
        unitCode: unitCodeFor(target),
        monthlyRate,
        billCreated: true,
        autoPaid,
        creditUsed,
        creditRemaining: Math.max(0, creditBalance - creditUsed),
        action: autoPaid
          ? "Paid from credit"
          : partialCredit
            ? "Partial credit applied; payment needed"
            : "Payment needed"
      });
    } catch (error) {
      result.errors += 1;
      result.errorDetails.push({
        residentId: target.resident.$id ?? "",
        residentName: target.resident.fullName ?? "Unnamed resident",
        reason: error instanceof Error ? error.message : "Billing failed for this resident."
      });
    }
  }

  if (!params.dryRun) {
    await writeBillingRun(params, result, now);
  }

  return result;
}

export async function listMonthlyBillingRuns(estateId: string) {
  const rows = await listAppwriteTableRows<BillingRunRow>(APPWRITE_TABLE_MONTHLY_BILLING_RUNS);
  return rows
    .filter((row) => row.estateId === estateId)
    .sort((left, right) => String(right.runDate ?? "").localeCompare(String(left.runDate ?? "")))
    .map((row) => ({
      id: row.$id ?? "",
      estateId: row.estateId ?? estateId,
      billingMonth: row.billingMonth ?? "",
      runDate: row.runDate ?? "",
      runBy: row.runBy ?? "",
      runByName: row.runByName ?? "Estate admin",
      totalResidents: numberOrZero(row.totalResidents),
      billsCreated: numberOrZero(row.billsCreated),
      autoPaidFromCredit: numberOrZero(row.autoPaidFromCredit),
      requiresPayment: numberOrZero(row.requiresPayment),
      skipped: numberOrZero(row.skipped),
      errors: numberOrZero(row.errors),
      errorDetails: row.errorDetails ?? "",
      status: row.status ?? "completed",
      createdAt: row.createdAt ?? ""
    }));
}

function targetsForResident(resident: ResidentRow, units: UnitRow[], properties: PropertyRow[]): BillingTarget[] {
  const linkedUnits = units.filter((unit) => (
    unit.estateId === resident.estateId &&
    (unit.currentResidentId === resident.$id || unit.$id === resident.unitId)
  ));
  const unitTargets = linkedUnits.length ? linkedUnits : [units.find((unit) => unit.$id === resident.unitId)].filter(Boolean);

  if (!unitTargets.length) {
    const property = properties.find((item) => item.$id === resident.propertyId);
    return [{ resident, property }];
  }

  return unitTargets.map((unit) => ({
    resident,
    unit,
    property: properties.find((item) => item.$id === (resident.propertyId ?? unit?.propertyId))
  }));
}

function skipReasonFor(resident: ResidentRow) {
  const status = normalized(resident.residentStatus ?? resident.status);
  if (status === "moved_out" || status === "moved out" || status === "inactive") {
    return "resident is inactive or moved out";
  }

  const role = normalized(resident.role ?? resident.userRole ?? resident.residentType);
  if (role === "reader" || role === "estate_staff") {
    return "resident role is not billable";
  }

  return "";
}

function monthlyRateFor(target: BillingTarget, rates: SubscriptionRateRow[]) {
  const apartmentType = apartmentTypeFor(target);
  if (apartmentType === "CUSTOM") {
    return numberOrZero(target.resident.expectedMonthly);
  }

  const rate = rates.find((item) => (
    item.estateId === target.resident.estateId &&
    item.apartmentType === apartmentType &&
    !item.effectiveTo
  ));

  return numberOrZero(rate?.monthlyRate) || numberOrZero(target.resident.expectedMonthly);
}

function apartmentTypeFor(target: BillingTarget) {
  const expectedMonthly = numberOrZero(target.resident.expectedMonthly);
  if (expectedMonthly === 12000 || normalized(target.resident.fullName).includes("total grace extension")) {
    return "CUSTOM";
  }

  const value = normalized(target.unit?.apartmentType ?? "");
  if (value.includes("self")) return "SELF_CONTAINED";
  if (value.includes("one") || value.includes("1")) return "ONE_BEDROOM";
  if (value.includes("two") || value.includes("2")) return "TWO_BEDROOM";
  if (value.includes("three") || value.includes("3")) return "THREE_BEDROOM";
  if (value.includes("duplex")) return "DUPLEX";
  if (value.includes("landlord") || normalized(target.resident.residentType).includes("owner")) return "LANDLORD_OCCUPIER";
  return "CUSTOM";
}

function creditBalanceFor(residentId: string, bills: BillRow[], payments: PaymentRow[]) {
  const totalPaid = payments
    .filter((payment) => payment.residentId === residentId)
    .filter((payment) => payment.status === "confirmed")
    .filter((payment) => payment.channel !== "credit_applied" && payment.source !== "system")
    .reduce((sum, payment) => sum + numberOrZero(payment.amount), 0);
  const totalBilled = bills
    .filter((bill) => bill.residentId === residentId)
    .reduce((sum, bill) => sum + numberOrZero(bill.amount), 0);
  return Math.max(0, totalPaid - totalBilled);
}

function billPayload(input: {
  billId: string;
  target: BillingTarget;
  estateId: string;
  title: string;
  amount: number;
  dueDate: string;
  billingMonth: string;
  runBy: string;
  now: string;
}) {
  return {
    estateId: input.estateId,
    propertyId: input.target.resident.propertyId ?? input.target.unit?.propertyId,
    unitId: input.target.unit?.$id ?? input.target.resident.unitId,
    propertyCode: input.target.property?.propertyCode,
    unitCode: unitCodeFor(input.target),
    residentId: input.target.resident.$id,
    category: "subscription",
    title: input.title,
    amount: input.amount,
    paidAmount: 0,
    dueDate: input.dueDate,
    billingMonth: input.billingMonth,
    status: "unpaid",
    createdBy: input.runBy || "system",
    createdAt: input.now,
    updatedAt: input.now
  };
}

async function writeBillingRun(params: BillingRunParams, result: BillingRunResult, now: string) {
  await appwriteUpsertRow(APPWRITE_TABLE_MONTHLY_BILLING_RUNS, safeAppwriteId("run", `${params.estateId}:${params.billingMonth}`), {
    estateId: params.estateId,
    billingMonth: params.billingMonth,
    runDate: now,
    runBy: params.runBy || "system",
    runByName: params.runByName || "System",
    totalResidents: result.totalResidents,
    billsCreated: result.billsCreated,
    autoPaidFromCredit: result.autoPaidFromCredit,
    requiresPayment: result.requiresPayment,
    skipped: result.skipped,
    errors: result.errors,
    errorDetails: JSON.stringify(result.errorDetails),
    status: result.errors > 0 ? "partial" : "completed",
    createdAt: now
  });
}

function summaryForSkipped(target: BillingTarget, reason: string, monthlyRate = 0): BillingResidentSummary {
  return {
    residentId: target.resident.$id ?? "",
    residentName: target.resident.fullName ?? "Unnamed resident",
    unitCode: unitCodeFor(target),
    monthlyRate,
    billCreated: false,
    autoPaid: false,
    creditUsed: 0,
    creditRemaining: 0,
    action: reason
  };
}

function unitCodeFor(target: BillingTarget) {
  return target.unit?.unitCode ?? target.resident.unitId ?? "Unit pending";
}

function sameOptionalId(left?: string, right?: string) {
  return (left || "") === (right || "");
}

function monthTitle(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function validateBillingMonth(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error("Billing month must use YYYY-MM format.");
  }
}

function normalized(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function numberOrZero(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}
