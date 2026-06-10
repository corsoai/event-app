import type { Bill, Payment, Property, Resident, Unit } from "@/lib/types";
import { money } from "@/lib/utils";

export type ReportDataset = {
  residents: Resident[];
  bills: Bill[];
  payments: Payment[];
  properties: Property[];
  units: Unit[];
};

export type ResidentFinancialProfile = {
  resident: Resident;
  unitCode: string;
  propertyCode: string;
  monthlyRate: number;
  expectedRevenue: number;
  confirmedPaid: number;
  outstandingBalance: number;
  advanceCredit: number;
  lastPaymentDate: string | null;
};

export type PropertyGroupReport = {
  propertyCode: string;
  propertyName: string;
  totalUnits: number;
  expectedRevenue: number;
  confirmedPaid: number;
  outstanding: number;
  advanceCredit: number;
  collectionRate: number;
  debtorCount: number;
  creditCount: number;
  fullyPaidCount: number;
};

export type RateTierReport = {
  rate: number;
  label: string;
  units: number;
  monthlyPotential: number;
  annualPotential: number;
  expectedRevenue: number;
  confirmedPaid: number;
  collectionRate: number;
};

export type TrendPoint = {
  monthKey: string;
  monthLabel: string;
  monthLongLabel: string;
  totalCollected: number;
  expectedForMonth: number;
  collectionRate: number;
  manualPayments: number;
  onlinePayments: number;
};

export type AgingBucket = "current" | "early" | "moderate" | "serious" | "critical" | "severe";

export type DebtorAccount = ResidentFinancialProfile & {
  monthsOverdue: number;
  agingBucket: AgingBucket;
};

export type AgingBucketSummary = {
  bucket: AgingBucket;
  label: string;
  count: number;
  totalOutstanding: number;
};

export const PROPERTY_GROUP_NAMES: Record<string, string> = {
  JC: "Jed's Court Apartments",
  AA: "Ateeq Apartments",
  LBS3: "3 LBS View Estate",
  CHIEF: "Chief Meme Area",
  YM: "Young Money Apartments",
  PLOT001: "Plot 001 Development",
  KENS: "Ken's Compound",
  LANDLORD: "Landlord Occupier Units",
  "LDI-REVIEW": "Pending Unit Assignment",
  OTHERS: "Miscellaneous"
};

export const RATE_TIERS = [
  { rate: 2000, units: 7 },
  { rate: 3000, units: 6 },
  { rate: 4000, units: 61 },
  { rate: 5000, units: 14 },
  { rate: 7000, units: 35 },
  { rate: 10000, units: 14 }
];

export const AGING_BUCKETS: Array<{ bucket: AgingBucket; label: string }> = [
  { bucket: "current", label: "Current" },
  { bucket: "early", label: "Early" },
  { bucket: "moderate", label: "Moderate" },
  { bucket: "serious", label: "Serious" },
  { bucket: "critical", label: "Critical" },
  { bucket: "severe", label: "Severe" }
];

export function buildResidentFinancialProfiles(dataset: ReportDataset): ResidentFinancialProfile[] {
  const billsByResident = groupBy(dataset.bills, (bill) => bill.residentId);
  const confirmedPayments = dataset.payments.filter((payment) => payment.status === "confirmed");
  const paymentsByResident = groupBy(confirmedPayments, (payment) => payment.residentId);
  const paymentsByBill = groupBy(confirmedPayments, (payment) => payment.billId);

  return dataset.residents
    .filter((resident) => resident.status === "active")
    .map((resident) => {
      const residentBills = billsByResident.get(resident.id) ?? [];
      const residentPayments = paymentsByResident.get(resident.id) ?? [];
      const expectedRevenue = residentBills.reduce((sum, bill) => sum + bill.amount, 0);
      const paidFromPayments = residentPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const paidFromBills = residentBills.reduce((sum, bill) => {
        const directPayments = paymentsByBill.get(bill.id) ?? [];
        const directPaid = directPayments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
        return sum + Math.max(bill.paidAmount ?? 0, directPaid);
      }, 0);
      const confirmedPaid = Math.max(paidFromPayments, paidFromBills);
      const unitCode = resolveUnitCode(dataset, resident);
      const propertyCode = resolvePropertyGroup(dataset, resident, unitCode);
      const monthlyRate = resolveMonthlyRate(dataset, resident);
      const outstandingBalance = Math.max(0, expectedRevenue - confirmedPaid);
      const advanceCredit = Math.max(0, confirmedPaid - expectedRevenue);
      const lastPaymentDate = residentPayments
        .map((payment) => payment.confirmedAt || payment.date)
        .filter(Boolean)
        .sort((left, right) => right.localeCompare(left))[0] ?? null;

      return {
        resident,
        unitCode,
        propertyCode,
        monthlyRate,
        expectedRevenue,
        confirmedPaid,
        outstandingBalance,
        advanceCredit,
        lastPaymentDate
      };
    });
}

export function buildPropertyGroupReports(profiles: ResidentFinancialProfile[]): PropertyGroupReport[] {
  const groups = new Map<string, PropertyGroupReport>();

  for (const profile of profiles) {
    const current = groups.get(profile.propertyCode) ?? {
      propertyCode: profile.propertyCode,
      propertyName: propertyGroupName(profile.propertyCode),
      totalUnits: 0,
      expectedRevenue: 0,
      confirmedPaid: 0,
      outstanding: 0,
      advanceCredit: 0,
      collectionRate: 0,
      debtorCount: 0,
      creditCount: 0,
      fullyPaidCount: 0
    };

    current.totalUnits += 1;
    current.expectedRevenue += profile.expectedRevenue;
    current.confirmedPaid += profile.confirmedPaid;
    current.outstanding += profile.outstandingBalance;
    current.advanceCredit += profile.advanceCredit;
    current.debtorCount += profile.outstandingBalance > 0 ? 1 : 0;
    current.creditCount += profile.advanceCredit > 0 ? 1 : 0;
    current.fullyPaidCount += profile.outstandingBalance === 0 && profile.advanceCredit === 0 ? 1 : 0;
    current.collectionRate = percent(current.confirmedPaid, current.expectedRevenue);
    groups.set(profile.propertyCode, current);
  }

  return [...groups.values()].sort((left, right) => left.propertyCode.localeCompare(right.propertyCode));
}

export function buildEstateTotal(groups: PropertyGroupReport[]): PropertyGroupReport {
  const total = groups.reduce<PropertyGroupReport>((sum, group) => ({
    propertyCode: "ESTATE TOTAL",
    propertyName: "All property groups",
    totalUnits: sum.totalUnits + group.totalUnits,
    expectedRevenue: sum.expectedRevenue + group.expectedRevenue,
    confirmedPaid: sum.confirmedPaid + group.confirmedPaid,
    outstanding: sum.outstanding + group.outstanding,
    advanceCredit: sum.advanceCredit + group.advanceCredit,
    collectionRate: 0,
    debtorCount: sum.debtorCount + group.debtorCount,
    creditCount: sum.creditCount + group.creditCount,
    fullyPaidCount: sum.fullyPaidCount + group.fullyPaidCount
  }), {
    propertyCode: "ESTATE TOTAL",
    propertyName: "All property groups",
    totalUnits: 0,
    expectedRevenue: 0,
    confirmedPaid: 0,
    outstanding: 0,
    advanceCredit: 0,
    collectionRate: 0,
    debtorCount: 0,
    creditCount: 0,
    fullyPaidCount: 0
  });

  return { ...total, collectionRate: percent(total.confirmedPaid, total.expectedRevenue) };
}

export function buildRateBreakdown(profiles: ResidentFinancialProfile[]): RateTierReport[] {
  return RATE_TIERS.map((tier) => {
    const tierProfiles = profiles.filter((profile) => profile.monthlyRate === tier.rate);
    const expectedRevenue = tierProfiles.reduce((sum, profile) => sum + profile.expectedRevenue, 0);
    const confirmedPaid = tierProfiles.reduce((sum, profile) => sum + profile.confirmedPaid, 0);
    const monthlyPotential = tier.rate * tier.units;

    return {
      rate: tier.rate,
      label: `${money(tier.rate)}/month`,
      units: tier.units,
      monthlyPotential,
      annualPotential: monthlyPotential * 12,
      expectedRevenue,
      confirmedPaid,
      collectionRate: percent(confirmedPaid, expectedRevenue)
    };
  });
}

export function buildMonthlyTrend(dataset: ReportDataset, propertyGroup = "all"): TrendPoint[] {
  const profiles = buildResidentFinancialProfiles(dataset);
  const allowedResidents = new Set(
    profiles
      .filter((profile) => propertyGroup === "all" || profile.propertyCode === propertyGroup)
      .map((profile) => profile.resident.id)
  );
  const confirmedPayments = dataset.payments.filter((payment) => payment.status === "confirmed" && allowedResidents.has(payment.residentId));
  const bills = dataset.bills.filter((bill) => allowedResidents.has(bill.residentId));
  const monthKeys = new Set<string>();

  for (const payment of confirmedPayments) {
    const key = monthKey(payment.confirmedAt || payment.date);
    if (key) monthKeys.add(key);
  }

  for (const bill of bills) {
    const key = monthKey(bill.dueDate);
    if (key) monthKeys.add(key);
  }

  const sortedKeys = [...monthKeys].sort();

  return sortedKeys.map((key) => {
    const monthPayments = confirmedPayments.filter((payment) => monthKey(payment.confirmedAt || payment.date) === key);
    const monthBills = bills.filter((bill) => monthKey(bill.dueDate) === key);
    const manualPayments = monthPayments
      .filter((payment) => !isOnlineWebhookPayment(payment))
      .reduce((sum, payment) => sum + payment.amount, 0);
    const onlinePayments = monthPayments
      .filter(isOnlineWebhookPayment)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const totalCollected = manualPayments + onlinePayments;
    const expectedForMonth = monthBills.reduce((sum, bill) => sum + bill.amount, 0);

    return {
      monthKey: key,
      monthLabel: formatMonthLabel(key, "short"),
      monthLongLabel: formatMonthLabel(key, "long"),
      totalCollected,
      expectedForMonth,
      collectionRate: percent(totalCollected, expectedForMonth),
      manualPayments,
      onlinePayments
    };
  });
}

export function buildDebtorAccounts(profiles: ResidentFinancialProfile[]): DebtorAccount[] {
  return profiles
    .filter((profile) => profile.outstandingBalance > 0)
    .map((profile) => {
      const monthsOverdue = profile.monthlyRate > 0 ? profile.outstandingBalance / profile.monthlyRate : 0;
      return {
        ...profile,
        monthsOverdue,
        agingBucket: agingBucketForMonths(monthsOverdue)
      };
    });
}

export function buildAgingSummaries(debtors: DebtorAccount[]): AgingBucketSummary[] {
  return AGING_BUCKETS.map(({ bucket, label }) => {
    const bucketDebtors = debtors.filter((debtor) => debtor.agingBucket === bucket);
    return {
      bucket,
      label,
      count: bucketDebtors.length,
      totalOutstanding: bucketDebtors.reduce((sum, debtor) => sum + debtor.outstandingBalance, 0)
    };
  });
}

export function agingBucketForMonths(months: number): AgingBucket {
  if (months < 1) return "current";
  if (months < 3) return "early";
  if (months < 6) return "moderate";
  if (months < 12) return "serious";
  if (months < 24) return "critical";
  return "severe";
}

export function formatMonthsOverdue(months: number) {
  if (months < 1) return "< 1 month";
  if (months < 2) return "1 month";
  return `${months.toFixed(1)} months`;
}

export function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(999, Math.max(0, (value / total) * 100));
}

export function cappedPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function propertyGroupName(propertyCode: string) {
  return PROPERTY_GROUP_NAMES[propertyCode] ?? propertyCode;
}

export function formatDateLabel(value: string | null) {
  if (!value) return "Never";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Never";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

export function normalizePhoneForWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

export function encodeCsv(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

export function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function resolveUnitCode(dataset: ReportDataset, resident: Resident) {
  const unit = dataset.units.find((item) => item.id === resident.unitId || item.currentResidentId === resident.id);
  return unit?.unitCode || resident.houseNumber || "Unit pending";
}

function resolveMonthlyRate(dataset: ReportDataset, resident: Resident) {
  if (resident.expectedMonthly && resident.expectedMonthly > 0) {
    return resident.expectedMonthly;
  }

  const unit = dataset.units.find((item) => item.id === resident.unitId || item.currentResidentId === resident.id);
  const normalizedType = (unit?.apartmentType ?? "").toLowerCase();
  if (normalizedType.includes("self")) return 2000;
  if (normalizedType.includes("1") || normalizedType.includes("one")) return 3000;
  if (normalizedType.includes("2") || normalizedType.includes("two")) return 4000;
  if (normalizedType.includes("3") || normalizedType.includes("three")) return 5000;
  if (normalizedType.includes("duplex")) return 7000;
  if (resident.type === "owner") return 10000;
  return 0;
}

function resolvePropertyGroup(dataset: ReportDataset, resident: Resident, unitCode: string) {
  const unit = dataset.units.find((item) => item.id === resident.unitId || item.currentResidentId === resident.id);
  const property = dataset.properties.find((item) => item.id === (resident.propertyId ?? unit?.propertyId));
  const source = property?.propertyCode || extractPropertyCode(unitCode);
  if (!source || resident.onboardingStatus === "needs_review") return "LDI-REVIEW";

  const upper = source.toUpperCase();
  if (upper.startsWith("JC")) return "JC";
  if (upper.startsWith("AA")) return "AA";
  if (upper.startsWith("LBS3")) return "LBS3";
  if (upper.startsWith("CHIEF")) return "CHIEF";
  if (upper.startsWith("YM")) return "YM";
  if (upper.startsWith("PLOT001")) return "PLOT001";
  if (upper.startsWith("KENS")) return "KENS";
  if (upper.startsWith("LANDLORD")) return "LANDLORD";
  return upper;
}

function extractPropertyCode(unitCode: string) {
  const normalized = unitCode.trim().toUpperCase();
  const ldiMatch = normalized.match(/^(LDI-\d+)-[A-Z0-9]+$/);
  if (ldiMatch) return ldiMatch[1];
  const dashedMatch = normalized.match(/^([A-Z]+)-\d+/);
  if (dashedMatch) return dashedMatch[1];
  const compactMatch = normalized.match(/^([A-Z]+)\d+/);
  if (compactMatch) return compactMatch[1];
  return "";
}

function isOnlineWebhookPayment(payment: Payment) {
  return payment.source === "webhook" || payment.processor === "monnify";
}

function monthKey(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string, style: "short" | "long") {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    year: style === "short" ? "2-digit" : "numeric"
  }).format(new Date(year, month - 1, 1));
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
