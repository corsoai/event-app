import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteUpsertRow,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows } from "@/lib/appwrite/residents";
import type { LbsviewOnboardingPreviewRow } from "@/lib/appwrite/onboarding-import";

type AppwriteResidentRow = {
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
  onboardingStatus?: string;
  reviewReasons?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AppwriteBillingImportSummary = {
  totalRows: number;
  financeRows: number;
  matchedResidents: number;
  skippedRows: number;
  updatedResidents: number;
  openingBills: number;
  legacyPayments: number;
  totals: {
    expectedPayment: number;
    amountPaid: number;
    openingOutstanding: number;
    creditBalance: number;
    expectedMonthly: number;
  };
  skippedReasons: Array<{ reason: string; count: number }>;
};

export type AppwriteBillingImportResult = {
  dryRun: boolean;
  imported: boolean;
  summary: AppwriteBillingImportSummary;
  progress?: {
    importedRows: number;
    totalRows: number;
    nextOffset: number | null;
    done: boolean;
  };
};

type BillingPlanRow = {
  source: LbsviewOnboardingPreviewRow;
  resident: AppwriteResidentRow;
  residentId: string;
  openingBillId?: string;
  legacyPaymentId?: string;
};

type BillingPlan = {
  rows: BillingPlanRow[];
  summary: AppwriteBillingImportSummary;
};

type BillingImportOptions = {
  offset?: number;
  limit?: number;
};

export async function previewBillingImportRows(rows: LbsviewOnboardingPreviewRow[]): Promise<AppwriteBillingImportResult> {
  const plan = await buildBillingPlan(rows);
  return {
    dryRun: true,
    imported: false,
    summary: plan.summary
  };
}

export async function importBillingPreviewRows(rows: LbsviewOnboardingPreviewRow[], options: BillingImportOptions = {}): Promise<AppwriteBillingImportResult> {
  const plan = await buildBillingPlan(rows);
  const offset = Math.max(0, Math.min(Math.floor(options.offset ?? 0), plan.rows.length));
  const limit = Math.max(1, Math.floor(options.limit ?? (plan.rows.length || 1)));
  const chunkRows = plan.rows.slice(offset, offset + limit);
  const nextOffset = offset + chunkRows.length < plan.rows.length ? offset + chunkRows.length : null;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  for (const row of chunkRows) {
    const source = row.source;
    const resident = row.resident;
    const expectedPayment = numberOrZero(source.expectedPayment);
    const amountPaid = numberOrZero(source.amountPaid);
    const openingOutstanding = numberOrZero(source.openingOutstanding);
    const expectedMonthly = numberOrZero(source.expectedMonthly);
    const billAmount = legacyBillAmount(expectedPayment, amountPaid, openingOutstanding);
    const paidAmount = amountPaid;

    await appwriteUpsertRow<AppwriteResidentRow>("residents", row.residentId, {
      estateId: resident.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
      propertyId: resident.propertyId,
      unitId: resident.unitId,
      fullName: resident.fullName ?? source.fullName,
      phone: resident.phone ?? source.phone ?? "",
      email: resident.email ?? source.email ?? "",
      residentType: resident.residentType ?? "tenant",
      status: resident.status ?? "active",
      moveInDate: resident.moveInDate ?? "",
      legacyName: resident.legacyName ?? source.legacyName ?? "",
      legacyAddress: resident.legacyAddress ?? source.legacyAddress ?? "",
      sourceRow: resident.sourceRow ?? source.sourceRow,
      openingOutstanding,
      expectedMonthly,
      onboardingStatus: resident.onboardingStatus,
      reviewReasons: resident.reviewReasons,
      createdAt: resident.createdAt ?? now,
      updatedAt: now
    });

    if (row.openingBillId) {
      await appwriteUpsertRow("bills", row.openingBillId, {
        estateId: resident.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
        propertyId: resident.propertyId,
        unitId: resident.unitId,
        residentId: row.residentId,
        category: "Opening balance",
        title: "Opening balance from legacy system",
        amount: billAmount,
        paidAmount,
        dueDate: today,
        status: billStatus(billAmount, paidAmount, openingOutstanding),
        createdAt: now,
        updatedAt: now
      });
    }

    if (row.legacyPaymentId) {
      await appwriteUpsertRow("payments", row.legacyPaymentId, {
        estateId: resident.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID,
        propertyId: resident.propertyId,
        unitId: resident.unitId,
        residentId: row.residentId,
        billId: row.openingBillId,
        amount: amountPaid,
        reference: `LEGACY-${source.sourceRow}`,
        processor: "manual",
        channel: "bank_transfer",
        providerReference: `legacy-excel-row-${source.sourceRow}`,
        date: today,
        status: "confirmed",
        source: "admin",
        confirmedAt: now,
        confirmedBy: "legacy billing import",
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (nextOffset === null) {
    await appwriteUpsertRow("audit_logs", safeAppwriteId("audit", `legacy-billing-import-${now}`), {
      estateId: APPWRITE_LBSVIEW_ESTATE_ID,
      actor: "Estate admin",
      action: "imported legacy billing fields",
      entityType: "system",
      entityId: APPWRITE_LBSVIEW_ESTATE_ID,
      metadata: JSON.stringify(plan.summary),
      createdAt: now,
      updatedAt: now
    });
  }

  return {
    dryRun: false,
    imported: true,
    summary: plan.summary,
    progress: {
      importedRows: offset + chunkRows.length,
      totalRows: plan.rows.length,
      nextOffset,
      done: nextOffset === null
    }
  };
}

async function buildBillingPlan(rows: LbsviewOnboardingPreviewRow[]): Promise<BillingPlan> {
  const residents = await listAppwriteTableRows<AppwriteResidentRow>("residents");
  const residentLookup = buildResidentLookup(residents);
  const skippedReasonCounts = new Map<string, number>();
  const planRows: BillingPlanRow[] = [];

  for (const row of rows) {
    const financeValue = moneyTotal(row);
    if (financeValue <= 0) {
      increment(skippedReasonCounts, "no finance values");
      continue;
    }

    const resident = findMatchingResident(row, residentLookup);
    if (!resident?.$id) {
      increment(skippedReasonCounts, unmatchedReasonFor(row));
      continue;
    }

    const hasBill = numberOrZero(row.expectedPayment) > 0 || numberOrZero(row.openingOutstanding) > 0;
    const hasPayment = numberOrZero(row.amountPaid) > 0;
    planRows.push({
      source: row,
      resident,
      residentId: resident.$id,
      openingBillId: hasBill ? openingBillIdFor(row) : undefined,
      legacyPaymentId: hasPayment ? legacyPaymentIdFor(row) : undefined
    });
  }

  return {
    rows: planRows,
    summary: summarizeBillingPlan(rows, planRows, skippedReasonCounts)
  };
}

function buildResidentLookup(residents: AppwriteResidentRow[]) {
  const bySourceRow = new Map<number, AppwriteResidentRow>();
  const byId = new Map<string, AppwriteResidentRow>();
  const byUnitAndName = new Map<string, AppwriteResidentRow>();
  const byPhone = uniqueLookup(residents, (resident) => normalizedPhone(resident.phone ?? ""));
  const byEmail = uniqueLookup(residents, (resident) => normalizedEmail(resident.email ?? ""));

  for (const resident of residents) {
    if (typeof resident.sourceRow === "number") {
      bySourceRow.set(resident.sourceRow, resident);
    }
    if (resident.$id) {
      byId.set(resident.$id, resident);
    }
    if (resident.unitId && resident.fullName) {
      byUnitAndName.set(`${resident.unitId}:${normalizedName(resident.fullName)}`, resident);
    }
  }

  return { bySourceRow, byId, byUnitAndName, byPhone, byEmail };
}

function findMatchingResident(
  row: LbsviewOnboardingPreviewRow,
  lookup: ReturnType<typeof buildResidentLookup>
) {
  return lookup.bySourceRow.get(row.sourceRow)
    ?? lookup.byId.get(residentIdFor(row))
    ?? lookup.byPhone.get(normalizedPhone(row.phone))
    ?? lookup.byEmail.get(normalizedEmail(row.email))
    ?? lookup.byUnitAndName.get(`${unitIdFor(row.unitCode)}:${normalizedName(row.fullName)}`);
}

function summarizeBillingPlan(
  sourceRows: LbsviewOnboardingPreviewRow[],
  planRows: BillingPlanRow[],
  skippedReasonCounts: Map<string, number>
): AppwriteBillingImportSummary {
  const totals = sourceRows.reduce((sum, row) => ({
    expectedPayment: sum.expectedPayment + numberOrZero(row.expectedPayment),
    amountPaid: sum.amountPaid + numberOrZero(row.amountPaid),
    openingOutstanding: sum.openingOutstanding + numberOrZero(row.openingOutstanding),
    creditBalance: sum.creditBalance + Math.max(0, numberOrZero(row.amountPaid) - numberOrZero(row.expectedPayment)),
    expectedMonthly: sum.expectedMonthly + numberOrZero(row.expectedMonthly)
  }), {
    expectedPayment: 0,
    amountPaid: 0,
    openingOutstanding: 0,
    creditBalance: 0,
    expectedMonthly: 0
  });

  return {
    totalRows: sourceRows.length,
    financeRows: sourceRows.filter((row) => moneyTotal(row) > 0).length,
    matchedResidents: planRows.length,
    skippedRows: sourceRows.length - planRows.length,
    updatedResidents: planRows.length,
    openingBills: planRows.filter((row) => row.openingBillId).length,
    legacyPayments: planRows.filter((row) => row.legacyPaymentId).length,
    totals,
    skippedReasons: [...skippedReasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count)
  };
}

function legacyBillAmount(expectedPayment: number, amountPaid: number, openingOutstanding: number) {
  if (expectedPayment > 0) return expectedPayment;
  if (openingOutstanding > 0 && amountPaid > 0) return openingOutstanding + amountPaid;
  return Math.max(openingOutstanding, amountPaid);
}

function unmatchedReasonFor(row: LbsviewOnboardingPreviewRow) {
  const role = row.role.trim().toLowerCase();
  const isResidentRole = ["resident", "ex resident", "ex-resident"].includes(role);
  const hasUnit = Boolean(normalizedCode(row.unitCode));

  if (!isResidentRole && !hasUnit) return "no matching existing resident for review/admin row";
  if (!isResidentRole) return "no matching existing resident for non-resident role";
  if (!hasUnit) return "no matching existing resident with missing unit ID";
  return "no matching existing resident";
}

function moneyTotal(row: LbsviewOnboardingPreviewRow) {
  return numberOrZero(row.expectedPayment)
    + numberOrZero(row.amountPaid)
    + numberOrZero(row.openingOutstanding)
    + numberOrZero(row.expectedMonthly);
}

function openingBillIdFor(row: LbsviewOnboardingPreviewRow) {
  return safeAppwriteId("bill", `opening:${row.sourceRow}:${row.unitCode}:${row.fullName}`);
}

function legacyPaymentIdFor(row: LbsviewOnboardingPreviewRow) {
  return safeAppwriteId("pay", `legacy:${row.sourceRow}:${row.unitCode}:${row.fullName}`);
}

function residentIdFor(row: LbsviewOnboardingPreviewRow) {
  return safeAppwriteId("res", `${row.sourceRow}:${row.fullName}:${row.phone}:${row.email}:${row.unitCode}`);
}

function unitIdFor(unitCode: string) {
  return safeAppwriteId("unit", normalizedCode(unitCode));
}

function normalizedCode(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
}

function normalizedName(value: string) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizedEmail(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizedPhone(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length === 13) return `0${digits.slice(3)}`;
  return digits;
}

function numberOrZero(value: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function billStatus(amount: number, paidAmount: number, openingOutstanding: number) {
  if (paidAmount >= amount || (openingOutstanding === 0 && amount === paidAmount)) return "paid";
  if (paidAmount > 0) return "partially_paid";
  return "unpaid";
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function uniqueLookup<T>(rows: T[], keyFor: (row: T) => string) {
  const counts = new Map<string, number>();
  const values = new Map<string, T>();

  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;

    counts.set(key, (counts.get(key) ?? 0) + 1);
    values.set(key, row);
  }

  for (const [key, count] of counts) {
    if (count > 1) values.delete(key);
  }

  return values;
}
