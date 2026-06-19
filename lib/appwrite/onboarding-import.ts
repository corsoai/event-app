import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteUpsertRow,
  safeAppwriteId
} from "@/lib/appwrite/server";

export type LbsviewOnboardingPreviewRow = {
  sourceRow: number;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  residentStatus: "active" | "moved out" | "inactive" | string;
  propertyCode: string;
  propertyName: string;
  unitCode: string;
  apartmentType: string;
  legacyName: string;
  legacyAddress: string;
  legacyProperty: string;
  expectedPayment: number;
  amountPaid: number;
  openingOutstanding: number;
  expectedMonthly: number;
  reviewRequired: boolean;
  reviewReasons: string[];
};

export type AppwriteImportSummary = {
  totalRows: number;
  importableRows: number;
  skippedRows: number;
  reviewRows: number;
  duplicateActiveUnitRows: number;
  properties: number;
  units: number;
  residents: number;
  openingBills: number;
  legacyPayments: number;
  byProperty: Array<{ propertyCode: string; count: number }>;
  skippedReasons: Array<{ reason: string; count: number }>;
};

export type AppwriteImportResult = {
  dryRun: boolean;
  imported: boolean;
  summary: AppwriteImportSummary;
  progress?: {
    importedRows: number;
    totalRows: number;
    nextOffset: number | null;
    done: boolean;
  };
};

type ImportPlanRow = {
  source: LbsviewOnboardingPreviewRow;
  propertyId: string;
  unitId: string;
  residentId: string;
  propertyCode: string;
  unitCode: string;
  onboardingStatus: "verified" | "needs_review";
  reviewReasons: string[];
  openingBillId?: string;
  legacyPaymentId?: string;
};

type ImportPlan = {
  rows: ImportPlanRow[];
  summary: AppwriteImportSummary;
  duplicateActiveUnitCodes: Set<string>;
  skippedReasonCounts: Map<string, number>;
};

type ImportOptions = {
  offset?: number;
  limit?: number;
  estateId?: string;
  estateName?: string;
};

export function summarizeOnboardingPreview(rows: LbsviewOnboardingPreviewRow[]): AppwriteImportSummary {
  return buildImportPlan(rows).summary;
}

export async function importOnboardingPreviewRows(rows: LbsviewOnboardingPreviewRow[], options: ImportOptions = {}): Promise<AppwriteImportResult> {
  const plan = buildImportPlan(rows);
  const offset = Math.max(0, Math.min(Math.floor(options.offset ?? 0), plan.rows.length));
  const limit = Math.max(1, Math.floor(options.limit ?? (plan.rows.length || 1)));
  const chunkRows = plan.rows.slice(offset, offset + limit);
  const nextOffset = offset + chunkRows.length < plan.rows.length ? offset + chunkRows.length : null;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const estateId = targetEstateId(options.estateId);
  const estateName = targetEstateName(estateId, options.estateName);

  await appwriteUpsertRow("estates", estateId, {
    name: estateName,
    address: `${estateName}, Lagos`,
    contactEmail: "admin@lbsviewestate.example",
    contactPhone: "+234 801 111 2040",
    gateName: "Main Gate A",
    createdAt: now,
    updatedAt: now
  });

  const properties = uniqueBy(
    chunkRows,
    (row) => row.propertyCode
  );
  for (const row of properties) {
    const property = row.source;
    await appwriteUpsertRow("properties", row.propertyId, {
      estateId,
      propertyCode: row.propertyCode,
      name: property.propertyName || row.propertyCode,
      description: property.legacyProperty || property.propertyName || "",
      street: "LBS View Estate",
      legacyName: property.legacyProperty || property.propertyName || "",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  }

  const unitCurrentResident = new Map<string, string>();
  for (const row of plan.rows) {
    if (normalizedStatus(row.source.residentStatus) === "active" && !unitCurrentResident.has(row.unitId)) {
      unitCurrentResident.set(row.unitId, row.residentId);
    }
  }

  const units = uniqueBy(chunkRows, (row) => row.unitId);
  for (const row of units) {
    const source = row.source;
    await appwriteUpsertRow("units", row.unitId, {
      estateId,
      propertyId: row.propertyId,
      unitCode: row.unitCode,
      label: row.unitCode,
      apartmentType: source.apartmentType || "Pending classification",
      status: unitCurrentResident.has(row.unitId) ? "occupied" : "vacant",
      currentResidentId: unitCurrentResident.get(row.unitId),
      legacyName: source.legacyAddress || source.legacyProperty || "",
      createdAt: now,
      updatedAt: now
    });
  }

  for (const row of chunkRows) {
    const source = row.source;
    const status = normalizedStatus(source.residentStatus);
    await appwriteUpsertRow("residents", row.residentId, {
      estateId,
      propertyId: row.propertyId,
      unitId: row.unitId,
      fullName: source.fullName || `Legacy resident row ${source.sourceRow}`,
      phone: source.phone,
      email: source.email,
      residentType: "tenant",
      status: status === "moved_out" ? "moved_out" : status,
      legacyName: source.legacyName || source.legacyProperty || "",
      legacyAddress: source.legacyAddress || source.legacyProperty || "",
      sourceRow: source.sourceRow,
      openingOutstanding: numberOrZero(source.openingOutstanding),
      expectedMonthly: numberOrZero(source.expectedMonthly),
      onboardingStatus: row.onboardingStatus,
      reviewReasons: row.reviewReasons.join(", "),
      createdAt: now,
      updatedAt: now
    });

    await appwriteUpsertRow("resident_unit_history", historyIdFor(row.residentId, row.unitId), {
      estateId,
      residentId: row.residentId,
      propertyId: row.propertyId,
      unitId: row.unitId,
      unitCode: row.unitCode,
      residentStatus: status,
      source: "legacy_excel_import",
      legacyNote: source.legacyAddress || source.legacyProperty || "",
      createdAt: now,
      updatedAt: now
    });

    if (row.openingBillId) {
      const expectedPayment = numberOrZero(source.expectedPayment);
      const amountPaid = numberOrZero(source.amountPaid);
      const openingOutstanding = Math.max(0, numberOrZero(source.openingOutstanding));
      const billAmount = legacyBillAmount(expectedPayment, amountPaid, openingOutstanding);
      const paidAmount = amountPaid;

      await appwriteUpsertRow("bills", row.openingBillId, {
        estateId,
        propertyId: row.propertyId,
        unitId: row.unitId,
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
        estateId,
        propertyId: row.propertyId,
        unitId: row.unitId,
        residentId: row.residentId,
        billId: row.openingBillId,
        amount: numberOrZero(source.amountPaid),
        reference: `LEGACY-${source.sourceRow}`,
        processor: "manual",
        channel: "bank_transfer",
        providerReference: `legacy-excel-row-${source.sourceRow}`,
        date: today,
        status: "confirmed",
        source: "admin",
        confirmedAt: now,
        confirmedBy: "legacy import",
        createdAt: now,
        updatedAt: now
      });
    }
  }

  if (nextOffset === null) {
    await appwriteUpsertRow("audit_logs", safeAppwriteId("audit", `legacy-import-${now}`), {
      estateId,
      actor: "Estate admin",
      action: "imported legacy resident preview",
      entityType: "system",
      entityId: estateId,
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

function targetEstateId(estateId: string | undefined) {
  const value = String(estateId ?? "").trim();
  return value || APPWRITE_LBSVIEW_ESTATE_ID;
}

function targetEstateName(estateId: string, estateName: string | undefined) {
  const value = String(estateName ?? "").trim();
  if (value) {
    return value;
  }

  return estateId === APPWRITE_LBSVIEW_ESTATE_ID ? "LBS View Estate" : estateId;
}

function buildImportPlan(rows: LbsviewOnboardingPreviewRow[]): ImportPlan {
  const skippedReasonCounts = new Map<string, number>();
  const duplicateActiveUnitCodes = findDuplicateActiveUnitCodes(rows);
  const importRows: ImportPlanRow[] = [];

  for (const row of rows) {
    const skipReason = skipReasonFor(row, duplicateActiveUnitCodes);
    if (skipReason) {
      skippedReasonCounts.set(skipReason, (skippedReasonCounts.get(skipReason) ?? 0) + 1);
      continue;
    }

    const reviewReasons = reviewReasonsFor(row, duplicateActiveUnitCodes);
    const onboardingStatus = reviewReasons.length ? "needs_review" : "verified";
    const propertyCode = importPropertyCodeFor(row);
    const unitCode = importUnitCodeFor(row, duplicateActiveUnitCodes);
    const propertyId = propertyIdFor(propertyCode);
    const unitId = unitIdFor(unitCode);
    const residentId = residentIdFor(row);
    const hasBill = numberOrZero(row.expectedPayment) > 0 || numberOrZero(row.openingOutstanding) > 0;
    const hasPayment = numberOrZero(row.amountPaid) > 0;

    importRows.push({
      source: row,
      propertyId,
      unitId,
      residentId,
      propertyCode,
      unitCode,
      onboardingStatus,
      reviewReasons,
      openingBillId: hasBill ? openingBillIdFor(row) : undefined,
      legacyPaymentId: hasPayment ? legacyPaymentIdFor(row) : undefined
    });
  }

  return {
    rows: importRows,
    duplicateActiveUnitCodes,
    skippedReasonCounts,
    summary: summarizePlan(rows, importRows, duplicateActiveUnitCodes, skippedReasonCounts)
  };
}

function summarizePlan(
  sourceRows: LbsviewOnboardingPreviewRow[],
  planRows: ImportPlanRow[],
  duplicateActiveUnitCodes: Set<string>,
  skippedReasonCounts: Map<string, number>
): AppwriteImportSummary {
  const byProperty = new Map<string, number>();
  for (const row of planRows) {
    const key = row.propertyCode;
    byProperty.set(key, (byProperty.get(key) ?? 0) + 1);
  }

  return {
    totalRows: sourceRows.length,
    importableRows: planRows.length,
    skippedRows: sourceRows.length - planRows.length,
    reviewRows: planRows.filter((row) => row.onboardingStatus === "needs_review").length,
    duplicateActiveUnitRows: sourceRows.filter((row) => duplicateActiveUnitCodes.has(normalizedCode(row.unitCode))).length,
    properties: new Set(planRows.map((row) => row.propertyCode)).size,
    units: new Set(planRows.map((row) => row.unitId)).size,
    residents: planRows.length,
    openingBills: planRows.filter((row) => row.openingBillId).length,
    legacyPayments: planRows.filter((row) => row.legacyPaymentId).length,
    byProperty: [...byProperty.entries()]
      .map(([propertyCode, count]) => ({ propertyCode, count }))
      .sort((left, right) => left.propertyCode.localeCompare(right.propertyCode)),
    skippedReasons: [...skippedReasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count)
  };
}

function skipReasonFor(row: LbsviewOnboardingPreviewRow, duplicateActiveUnitCodes: Set<string>) {
  const role = row.role.trim().toLowerCase();
  void duplicateActiveUnitCodes;

  if (!["resident", "ex resident", "ex-resident"].includes(role)) return "not a resident role";

  return "";
}

function reviewReasonsFor(row: LbsviewOnboardingPreviewRow, duplicateActiveUnitCodes: Set<string>) {
  const reasons = new Set((row.reviewReasons ?? []).filter(Boolean));
  const propertyCode = normalizedCode(row.propertyCode);
  const unitCode = normalizedCode(row.unitCode);

  if (row.reviewRequired) reasons.add("legacy row flagged for manual review");
  if (!row.fullName.trim()) reasons.add("missing resident name");
  if (!propertyCode || propertyCode === "LDI-REVIEW") reasons.add("property group needs assignment");
  if (!unitCode) reasons.add("unit ID needs assignment");
  if (propertyCode && propertyCode !== "LDI-REVIEW" && !isApprovedPropertyCode(propertyCode)) reasons.add("property group needs approval");
  if (!row.phone && !row.email) reasons.add("missing login contact");
  if (normalizedStatus(row.residentStatus) === "active" && unitCode && duplicateActiveUnitCodes.has(unitCode)) {
    reasons.add("duplicate active resident for unit");
  }

  return [...reasons];
}

function importPropertyCodeFor(row: LbsviewOnboardingPreviewRow) {
  const propertyCode = normalizedCode(row.propertyCode);
  if (!propertyCode || propertyCode === "LDI-REVIEW" || !isApprovedPropertyCode(propertyCode)) {
    return "LDI-REVIEW";
  }

  return propertyCode;
}

function importUnitCodeFor(row: LbsviewOnboardingPreviewRow, duplicateActiveUnitCodes: Set<string>) {
  const unitCode = normalizedCode(row.unitCode);
  const needsFallback = !unitCode || (normalizedStatus(row.residentStatus) === "active" && duplicateActiveUnitCodes.has(unitCode));
  if (needsFallback) {
    return `REVIEW-ROW-${String(row.sourceRow).padStart(3, "0")}`;
  }

  return unitCode;
}

function findDuplicateActiveUnitCodes(rows: LbsviewOnboardingPreviewRow[]) {
  const activeCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.reviewRequired || normalizedStatus(row.residentStatus) !== "active") {
      continue;
    }

    const unitCode = normalizedCode(row.unitCode);
    if (!unitCode) {
      continue;
    }

    activeCounts.set(unitCode, (activeCounts.get(unitCode) ?? 0) + 1);
  }

  return new Set(
    [...activeCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([unitCode]) => unitCode)
  );
}

function isApprovedPropertyCode(propertyCode: string) {
  return propertyCode === "JC" || propertyCode === "AA" || /^LDI-\d{2,}$/.test(propertyCode);
}

function propertyIdFor(propertyCode: string) {
  return safeAppwriteId("prop", normalizedCode(propertyCode));
}

function unitIdFor(unitCode: string) {
  return safeAppwriteId("unit", normalizedCode(unitCode));
}

function residentIdFor(row: LbsviewOnboardingPreviewRow) {
  return safeAppwriteId("res", `${row.sourceRow}:${row.fullName}:${row.phone}:${row.email}:${row.unitCode}`);
}

function historyIdFor(residentId: string, unitId: string) {
  return safeAppwriteId("hist", `${residentId}:${unitId}`);
}

function openingBillIdFor(row: LbsviewOnboardingPreviewRow) {
  return safeAppwriteId("bill", `opening:${row.sourceRow}:${row.unitCode}:${row.fullName}`);
}

function legacyPaymentIdFor(row: LbsviewOnboardingPreviewRow) {
  return safeAppwriteId("pay", `legacy:${row.sourceRow}:${row.unitCode}:${row.fullName}`);
}

function normalizedCode(value: string) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
}

function normalizedStatus(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "moved_out") return "moved_out";
  if (normalized === "inactive") return "inactive";
  return "active";
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

function legacyBillAmount(expectedPayment: number, amountPaid: number, openingOutstanding: number) {
  if (expectedPayment > 0) return expectedPayment;
  if (openingOutstanding > 0 && amountPaid > 0) return openingOutstanding + amountPaid;
  return Math.max(openingOutstanding, amountPaid);
}

function uniqueBy<T>(rows: T[], keyFor: (row: T) => string) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const row of rows) {
    const key = keyFor(row);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(row);
  }

  return unique;
}
