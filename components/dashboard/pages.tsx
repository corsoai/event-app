"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BellRing,
  BookOpen,
  Building2,
  CalendarClock,
  Camera,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Database,
  DoorOpen,
  Download,
  FileJson,
  FilePlus2,
  Flame,
  HeartPulse,
  IdCard,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Pencil,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Store,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
  Volume2,
  WalletCards,
  X
} from "lucide-react";
import Link from "next/link";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DebtorsAging } from "@/components/admin/reports/DebtorsAging";
import { MonthlyTrendChart } from "@/components/admin/reports/MonthlyTrendChart";
import { PropertyGroupBreakdown } from "@/components/admin/reports/PropertyGroupBreakdown";
import { RateBreakdown } from "@/components/admin/reports/RateBreakdown";
import { ReportsExportToolbar } from "@/components/admin/reports/ReportsExportToolbar";
import {
  buildDebtorAccounts,
  buildResidentFinancialProfiles,
  percent,
  type AgingBucket,
  type ReportDataset
} from "@/components/admin/reports/report-data";
import { roleLabels } from "@/lib/auth";
import {
  activityLogs,
} from "@/lib/demo-data";
import {
  billCreditAmount,
  billOutstandingAmount,
  billPaidAmount,
  getCurrentResident,
  getResidentProperty,
  getResidentUnit,
  residentBillingBalance,
  residentPropertyDisplayLabel,
  residentUnitDisplayLabel,
  residentUnitLabel,
  type LocalAccessRequest,
  type LocalEstateState,
  useLocalEstateStore
} from "@/lib/local-store";
import {
  createAppwriteResidentSos,
  createAppwriteResidentVisitor,
  findAppwriteVisitorByCode,
  readAppwriteAdminSosIncidents,
  readAppwriteAdminVisitors,
  readAppwriteExpectedVisitors,
  readAppwriteResidentSosHistory,
  readAppwriteResidentSosIncident,
  readAppwriteResidentVisitors,
  readAppwriteSecurityVisitorHistory,
  updateAppwriteSosIncident,
  updateAppwriteVisitorStatus as saveAppwriteVisitorStatus,
  type SosCreateInput,
  type SosUpdateInput,
  type AppwriteVisitorView
} from "@/lib/appwrite/browser-data";
import {
  installGuardTourSync,
  isGuardCheckpointQr,
  submitGuardCheckpointScan,
  syncPendingTourLogs
} from "@/lib/guard-tour";
import { APPWRITE_ONBOARDING_DATABASE_ID } from "@/lib/appwrite/schema";
import type { AppwriteAnnouncement, AppwriteComplaint, AppwriteKnowledgeBaseArticle, Bill, CsoReview, EmergencyAlert, EmergencyAlertStatus, EmergencyAlertType, Estate, GuardCheckpoint, GuardPatrolEvent, HouseholdMember, Payment, Property, Resident, SecurityIncident, StatusTone, Unit, UserRole, Visitor } from "@/lib/types";
import { contactLabel, makeDigitalIdNumber, money } from "@/lib/utils";
import { getVisitorWindowState, VISITOR_CODE_VALIDITY_HOURS } from "@/lib/visitor-window";
import { useRouter } from "next/navigation";

type BarcodeDetectorInstance = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

type VisitorQrPayload = {
  type: "corso.visitor.invitation";
  version: 1;
  visitor: Visitor;
  resident: Resident;
};

type AppwriteOnboardingStatus = {
  configured: boolean;
  missing: string[];
  endpoint: string;
  projectId: string;
  databaseId: string;
  apiKeyConfigured: boolean;
  tableIds: string[];
};

type AppwriteImportSummary = {
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

type AppwriteImportResponse = {
  dryRun: boolean;
  imported: boolean;
  summary: AppwriteImportSummary;
  progress?: {
    importedRows: number;
    totalRows: number;
    nextOffset: number | null;
    done: boolean;
  };
  error?: string;
};

type AppwriteBillingImportSummary = {
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
    creditBalance?: number;
    expectedMonthly: number;
  };
  skippedReasons: Array<{ reason: string; count: number }>;
};

type AppwriteBillingImportResponse = {
  dryRun: boolean;
  imported: boolean;
  summary: AppwriteBillingImportSummary;
  progress?: {
    importedRows: number;
    totalRows: number;
    nextOffset: number | null;
    done: boolean;
  };
  error?: string;
};

type AppwriteResidentDirectory = {
  properties: Property[];
  units: Unit[];
  residents: Resident[];
  total: {
    properties: number;
    units: number;
    residents: number;
  };
};

type AppwriteAccountingDirectory = AppwriteResidentDirectory & {
  bills: Bill[];
  payments: Payment[];
  auditLogs: LocalEstateState["auditLogs"];
  matchedResidentId?: string | null;
  resident?: Resident | null;
  summary?: ResidentAccountingSummary | null;
  total: AppwriteResidentDirectory["total"] & {
    bills: number;
    payments: number;
  };
};

type ResidentAccountingSummary = {
  totalBilled: number;
  totalPaid: number;
  outstandingBalance: number;
  advanceCredit: number;
  monthlyRate: number;
  monthsCreditCovers: number;
  coverageThroughDate: string;
  nextDueDate: string;
  accountStatus: "fully_paid" | "in_credit" | "partially_paid" | "unpaid";
  statusBannerText: string;
  lastPaymentDate: string | null;
  lastPaymentAmount: number;
};

type MonnifyInitiateBody = {
  billId?: string;
  months?: number;
  amount?: number;
};

type MonnifyInitiateResponse = {
  checkoutUrl?: string;
  paymentReference?: string;
  amount?: number;
  transactionReference?: string;
  error?: string;
};

type ResidentVirtualAccountDetails = {
  id: string;
  residentId: string;
  propertyCode?: string;
  unitCode?: string;
  provider: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode?: string;
  providerReference?: string;
  status: string;
  assignedAt?: string;
};

type AppwriteAccountingSummary = {
  expectedRevenue: number;
  paidAmount: number;
  outstandingBalance: number;
  creditBalance?: number;
  netReceivable?: number;
  pendingReviewAmount: number;
  debtorsCount: number;
  residentsInCredit?: number;
  monthlyExpected: number;
  residentsCount: number;
  billsCount: number;
  paymentsCount: number;
  channelTotals: Record<string, number>;
  paymentStatusTotals: Record<string, { count: number; amount: number }>;
  categoryTotals: Record<string, number>;
  generatedAt: string;
};

let adminAccountingSessionCache: AppwriteAccountingDirectory | null = null;
let adminAccountingSummarySessionCache: AppwriteAccountingSummary | null = null;
let adminAccountingSessionUpdatedAt: number | null = null;

type AnnouncementApiResponse = {
  announcements?: AppwriteAnnouncement[];
  announcement?: AppwriteAnnouncement;
  error?: string;
};

type ComplaintApiResponse = {
  complaints?: AppwriteComplaint[];
  complaint?: AppwriteComplaint;
  error?: string;
};

type ComplaintFilters = {
  status: string;
  priority: string;
  category: string;
  search: string;
};

type KnowledgeApiResponse = {
  articles?: AppwriteKnowledgeBaseArticle[];
  article?: AppwriteKnowledgeBaseArticle;
  error?: string;
};

const STATIC_DATA_CACHE_MS = 10 * 60 * 1000;
const announcementSessionCache = new Map<string, { savedAt: number; announcements: AppwriteAnnouncement[] }>();
const knowledgeSessionCache = new Map<string, { savedAt: number; articles: AppwriteKnowledgeBaseArticle[] }>();
const qrDataUrlCache = new Map<string, string>();

type HouseholdApiResponse = {
  members?: HouseholdMember[];
  member?: HouseholdMember;
  error?: string;
};

type PaymentAllocationSummary = {
  totalPaidAllTime: number;
  outstandingBalance: number;
  advanceCredit: number;
  coverageThroughDate: string;
  nextDueDate: string;
  accountStatus: "fully_paid" | "in_credit" | "partially_paid" | "unpaid";
};

type PaymentAllocationResult = {
  paymentId: string;
  totalAllocated: number;
  advanceCreditGenerated: number;
  monthsCreditCovers: number;
  residentSummary: PaymentAllocationSummary;
  success: boolean;
  errorMessage?: string;
};

type AdminPaymentConfirmation = {
  residentName: string;
  unitLabel: string;
  amount: number;
  channel: string;
  monthlyRate: number;
  allocation: PaymentAllocationResult;
};

type BillingRunSummaryRow = {
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

type BillingRunResult = {
  billingMonth: string;
  dryRun: boolean;
  totalResidents: number;
  billsCreated: number;
  autoPaidFromCredit: number;
  requiresPayment: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ residentId: string; residentName: string; reason: string }>;
  summary: BillingRunSummaryRow[];
};

type BillingRunHistoryRow = {
  id: string;
  billingMonth: string;
  runDate: string;
  runByName: string;
  billsCreated: number;
  autoPaidFromCredit: number;
  requiresPayment: number;
  errors: number;
  status: string;
};

type LbsviewOnboardingPreviewRow = {
  sourceRow: number;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  residentStatus: string;
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

const LAGOS_TIME_ZONE = "Africa/Lagos";
const RESIDENT_ACCOUNTING_CACHE_PREFIX = "corso_resident_accounting_v1:";
const RESIDENT_ACCOUNTING_CACHE_TTL_MS = 10 * 60 * 1000;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
    webkitAudioContext?: typeof AudioContext;
    __corsoSosAudioContext?: AudioContext;
  }
}

const SOS_SOUND_STORAGE_KEY = "corso_sos_alert_sound_enabled_v1";
const SOS_RESUBMIT_COOLDOWN_MS = 15000;

const emergencyAlertOptions: Array<{
  type: EmergencyAlertType;
  title: string;
  helper: string;
  icon: ReactNode;
  tone: string;
}> = [
  {
    type: "medical",
    title: "Medical emergency",
    helper: "Health emergency, ambulance, urgent assistance.",
    icon: <HeartPulse className="h-5 w-5" />,
    tone: "border-danger/40 bg-danger/10 text-red-100"
  },
  {
    type: "security",
    title: "Security emergency",
    helper: "Threat, attempted break-in, or urgent gate support.",
    icon: <ShieldCheck className="h-5 w-5" />,
    tone: "border-smart/40 bg-smart/10 text-smart"
  },
  {
    type: "fire",
    title: "Fire emergency",
    helper: "Fire, smoke, gas leak, or electrical hazard.",
    icon: <Flame className="h-5 w-5" />,
    tone: "border-orange-400/40 bg-orange-500/10 text-orange-100"
  },
  {
    type: "domestic_violence",
    title: "Domestic violence alert",
    helper: "Quiet alert to security and estate response team.",
    icon: <AlertTriangle className="h-5 w-5" />,
    tone: "border-pink-400/40 bg-pink-500/10 text-pink-100"
  },
  {
    type: "suspicious_movement",
    title: "Suspicious movement alert",
    helper: "Unusual person, movement, or activity nearby.",
    icon: <BellRing className="h-5 w-5" />,
    tone: "border-sky/40 bg-white/10 text-sky"
  }
];

const sosAlertOptions: Array<{
  type: SosCreateInput["alertType"];
  title: string;
  helper: string;
  icon: ReactNode;
  tone: string;
}> = [
  {
    type: "panic",
    title: "Panic / Intruder",
    helper: "Immediate threat, intruder, or break-in attempt.",
    icon: <Siren className="h-6 w-6" />,
    tone: "border-red-400/50 bg-red-500/10 text-red-100"
  },
  {
    type: "medical",
    title: "Medical Emergency",
    helper: "Urgent health incident or ambulance support.",
    icon: <HeartPulse className="h-6 w-6" />,
    tone: "border-rose-400/50 bg-rose-500/10 text-rose-100"
  },
  {
    type: "fire",
    title: "Fire",
    helper: "Fire, smoke, gas leak, or electrical danger.",
    icon: <Flame className="h-6 w-6" />,
    tone: "border-orange-400/50 bg-orange-500/10 text-orange-100"
  },
  {
    type: "security",
    title: "Security Concern",
    helper: "Suspicious movement or urgent security support.",
    icon: <ShieldCheck className="h-6 w-6" />,
    tone: "border-gold/50 bg-gold/10 text-gold"
  },
  {
    type: "other",
    title: "Other Emergency",
    helper: "Any urgent issue that needs estate response.",
    icon: <AlertTriangle className="h-6 w-6" />,
    tone: "border-sky/50 bg-sky/10 text-sky"
  }
];

export function PageHeader({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-smart">Corso</p>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {children}
    </div>
  );
}

function useCurrentResidentProfile(state: LocalEstateState) {
  const [resident, setResident] = useState(() => getCurrentResident(state));

  useEffect(() => {
    setResident(getCurrentResident(state));
  }, [state]);

  return resident ?? getCurrentResident(state);
}

function mergeRecordsById<T extends { id: string }>(localRecords: T[], liveRecords: T[]) {
  const merged = new Map(localRecords.map((record) => [record.id, record]));
  for (const record of liveRecords) {
    merged.set(record.id, record);
  }

  return Array.from(merged.values());
}

function mergeAccountingState(state: LocalEstateState, accounting: AppwriteAccountingDirectory | null): LocalEstateState {
  if (
    !accounting?.properties.length &&
    !accounting?.units.length &&
    !accounting?.residents.length &&
    !accounting?.bills.length &&
    !accounting?.payments.length &&
    !accounting?.auditLogs.length
  ) {
    return state;
  }

  return {
    ...state,
    properties: mergeRecordsById(state.properties, accounting?.properties ?? []),
    units: mergeRecordsById(state.units, accounting?.units ?? []),
    residents: accounting?.residents.length ? accounting.residents : state.residents,
    bills: accounting?.bills.length ? accounting.bills : state.bills,
    payments: accounting?.payments.length ? accounting.payments : state.payments,
    auditLogs: accounting?.auditLogs.length ? accounting.auditLogs : state.auditLogs
  };
}

function useLiveVisitorViews(loader: () => Promise<AppwriteVisitorView[]>, options: { refreshIntervalMs?: number } = {}) {
  const [visitorViews, setVisitorViews] = useState<AppwriteVisitorView[]>([]);
  const [loadingVisitors, setLoadingVisitors] = useState(true);
  const [visitorError, setVisitorError] = useState("");

  const refreshVisitors = async (refreshOptions: { silent?: boolean } = {}) => {
    if (!refreshOptions.silent) {
      setLoadingVisitors(true);
    }
    setVisitorError("");

    try {
      setVisitorViews(await loader());
    } catch (error) {
      setVisitorError(error instanceof Error ? error.message : "Visitor records could not be loaded.");
      setVisitorViews([]);
    } finally {
      setLoadingVisitors(false);
    }
  };

  useEffect(() => {
    void refreshVisitors();
  }, [loader]);

  useEffect(() => {
    if (!options.refreshIntervalMs) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshVisitors({ silent: true });
    }, options.refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [loader, options.refreshIntervalMs]);

  return { visitorViews, setVisitorViews, loadingVisitors, visitorError, refreshVisitors };
}

function LiveVisitorCards({
  title,
  visitorViews,
  loading,
  error,
  showResident = false,
  actionFor
}: {
  title: string;
  visitorViews: AppwriteVisitorView[];
  loading: boolean;
  error: string;
  showResident?: boolean;
  actionFor?: (visitor: Visitor) => ReactNode;
}) {
  return (
    <Card className="mb-6">
      <CardHeader
        title={title}
        description={loading ? "Loading live Appwrite visitor records..." : `${visitorViews.length} live visitor record${visitorViews.length === 1 ? "" : "s"} found.`}
      />
      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </div>
      ) : null}
      {!error && !loading && !visitorViews.length ? (
        <div className="rounded-lg border border-line bg-white/80 p-4 text-sm text-slate-500">
          No live visitor records returned for this account.
        </div>
      ) : null}
      <div className="grid gap-3">
        {visitorViews.map(({ visitor, residentName, unitCode }) => (
          <div key={visitor.id} className="rounded-lg border border-line bg-white/90 p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-950">{visitor.visitorName}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-smart">{visitor.code}</p>
              </div>
              <StatusBadge status={visitor.status} />
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {showResident ? <p><span className="text-slate-500">Resident:</span> {residentName}</p> : null}
              {showResident ? <p><span className="text-slate-500">Unit:</span> {unitCode}</p> : null}
              <p><span className="text-slate-500">Date:</span> {visitor.visitDate}</p>
              <p><span className="text-slate-500">Arrival:</span> {formatClockTime(visitor.arrivalTime)}</p>
              <p><span className="text-slate-500">Phone:</span> {visitor.phone || "Not recorded"}</p>
              <p><span className="text-slate-500">Guests:</span> {visitor.count}</p>
              <p className="sm:col-span-2"><span className="text-slate-500">Purpose:</span> {visitor.purpose || "Not recorded"}</p>
            </div>
            {actionFor ? <div className="mt-4">{actionFor(visitor)}</div> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function isExpectedResidentVisitor(visitor: Visitor) {
  return visitor.status === "pending" || visitor.status === "verified";
}

function isTodayVisitor(visitor: Visitor) {
  return visitor.visitDate === dateInputValue();
}

function visitorSortTime(visitor: Visitor) {
  const parsed = Date.parse(`${visitor.visitDate}T${visitor.arrivalTime || "00:00"}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function visitorLoadingRows(columns: number) {
  return Array.from({ length: 3 }, (_, rowIndex) =>
    Array.from({ length: columns }, (_, columnIndex) => (
      <span
        key={`${rowIndex}-${columnIndex}`}
        className="block h-4 w-full max-w-32 animate-pulse rounded bg-slate-200/70"
      />
    ))
  );
}

function residentAccountingCacheKey() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const raw = window.localStorage.getItem("corso_user");
    const session = raw ? JSON.parse(raw) as { email?: string; phone?: string; name?: string } : null;
    const identity = session?.phone || session?.email || session?.name || "resident";
    return `${RESIDENT_ACCOUNTING_CACHE_PREFIX}${identity.trim().toLowerCase()}`;
  } catch {
    return `${RESIDENT_ACCOUNTING_CACHE_PREFIX}resident`;
  }
}

function readCachedResidentAccounting() {
  if (typeof window === "undefined") {
    return null;
  }

  const cacheKey = residentAccountingCacheKey();
  if (!cacheKey) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as { savedAt?: number; data?: AppwriteAccountingDirectory };
    if (!cached.savedAt || !cached.data || Date.now() - cached.savedAt > RESIDENT_ACCOUNTING_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

function writeCachedResidentAccounting(data: AppwriteAccountingDirectory) {
  if (typeof window === "undefined") {
    return;
  }

  const cacheKey = residentAccountingCacheKey();
  if (!cacheKey) {
    return;
  }

  window.sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
}

function useResidentAccountingState(state: LocalEstateState) {
  const [accounting, setAccounting] = useState<AppwriteAccountingDirectory | null>(null);
  const [loadingAccounting, setLoadingAccounting] = useState(false);
  const [accountingStatus, setAccountingStatus] = useState("Loading your account...");
  const [accountingError, setAccountingError] = useState("");

  async function refreshAccounting(options: { bypassCache?: boolean } = {}) {
    setLoadingAccounting(true);
    setAccountingError("");
    const cached = options.bypassCache ? null : readCachedResidentAccounting();
    if (cached) {
      setAccounting(cached);
      setAccountingStatus("Loaded your saved account view. Refreshing latest records...");
    } else {
      setAccountingStatus("Loading your account...");
    }
    const refreshQuery = options.bypassCache ? "?refresh=1" : "";

    try {
      const response = await fetch(`/api/appwrite/resident/accounting${refreshQuery}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as (AppwriteAccountingDirectory & {
        error?: string;
        matchedResidentId?: string | null;
      }) | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to load your account.");
      }

      setAccounting(payload);
      writeCachedResidentAccounting(payload);
      setAccountingStatus(payload.residents.length
        ? `Loaded ${payload.bills.length} bills and ${payload.payments.length} payments from your account.`
        : "No resident accounting record matched this login yet.");
    } catch (error) {
      setAccounting(null);
      const message = error instanceof Error ? error.message : "Unable to load your account.";
      setAccountingError(message);
      setAccountingStatus(message);
    } finally {
      setLoadingAccounting(false);
    }
  }

  useEffect(() => {
    void refreshAccounting();
  }, []);

  useEffect(() => {
    function refreshVisibleAccount() {
      if (document.visibilityState === "visible") {
        void refreshAccounting();
      }
    }

    document.addEventListener("visibilitychange", refreshVisibleAccount);
    window.addEventListener("focus", refreshVisibleAccount);

    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleAccount);
      window.removeEventListener("focus", refreshVisibleAccount);
    };
  }, []);

  return {
    residentState: mergeAccountingState(state, accounting),
    accounting,
    accountingStatus,
    accountingError,
    loadingAccounting,
    refreshAccounting
  };
}

async function redirectToMonnifyCheckout(body: MonnifyInitiateBody) {
  const response = await fetch("/api/monnify/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as MonnifyInitiateResponse | null;

  if (!response.ok || !payload?.checkoutUrl) {
    throw new Error(payload?.error ?? "Unable to initiate payment. Please try again or contact admin.");
  }

  window.location.assign(payload.checkoutUrl);
}

function useAdminAccountingState(state: LocalEstateState) {
  const [accounting, setAccounting] = useState<AppwriteAccountingDirectory | null>(adminAccountingSessionCache);
  const [summary, setSummary] = useState<AppwriteAccountingSummary | null>(adminAccountingSummarySessionCache);
  const [loadingAccounting, setLoadingAccounting] = useState(false);
  const [loadingAccountingDetails, setLoadingAccountingDetails] = useState(false);
  const [accountingStatus, setAccountingStatus] = useState(adminAccountingSummarySessionCache
    ? `Loaded accounting summary for ${adminAccountingSummarySessionCache.billsCount} bills and ${adminAccountingSummarySessionCache.paymentsCount} payments.`
    : "Loading accounting summary...");
  const [lastUpdated, setLastUpdated] = useState<number | null>(adminAccountingSessionUpdatedAt);

  async function refreshAccounting(options: { bypassCache?: boolean } = {}) {
    setLoadingAccounting(true);
    setLoadingAccountingDetails(false);
    setAccountingStatus("Loading accounting summary...");
    const refreshQuery = options.bypassCache ? "?refresh=1" : "";

    try {
      const summaryResponse = await fetch(`/api/appwrite/admin/accounting/summary${refreshQuery}`, { cache: "no-store" });
      const summaryPayload = await summaryResponse.json().catch(() => null) as (AppwriteAccountingSummary & { error?: string }) | null;
      if (!summaryResponse.ok || !summaryPayload) {
        throw new Error(summaryPayload?.error ?? "Unable to load Appwrite accounting summary.");
      }

      setSummary(summaryPayload);
      adminAccountingSummarySessionCache = summaryPayload;
      adminAccountingSessionUpdatedAt = Date.now();
      setLastUpdated(adminAccountingSessionUpdatedAt);
      setAccountingStatus(`Loaded accounting summary for ${summaryPayload.billsCount} bills and ${summaryPayload.paymentsCount} payments. Loading details...`);
      setLoadingAccounting(false);
      setLoadingAccountingDetails(true);

      try {
        const response = await fetch(`/api/appwrite/admin/accounting${refreshQuery}`, { cache: "no-store" });
        const payload = await response.json().catch(() => null) as (AppwriteAccountingDirectory & { error?: string }) | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.error ?? "Unable to load Appwrite accounting.");
        }

        setAccounting(payload);
        adminAccountingSessionCache = payload;
        adminAccountingSessionUpdatedAt = Date.now();
        setLastUpdated(adminAccountingSessionUpdatedAt);
        setAccountingStatus(`Loaded ${payload.bills.length} bills and ${payload.payments.length} payments from Appwrite TablesDB.`);
      } catch (detailError) {
        setAccounting(null);
        setAccountingStatus(detailError instanceof Error
          ? `Loaded summary. Detailed accounting is still unavailable: ${detailError.message}`
          : "Loaded summary. Detailed accounting is still unavailable.");
      }
    } catch (error) {
      setAccounting(null);
      setSummary(null);
      setAccountingStatus(error instanceof Error ? error.message : "Using local accounting records.");
    } finally {
      setLoadingAccounting(false);
      setLoadingAccountingDetails(false);
    }
  }

  useEffect(() => {
    if (!adminAccountingSummarySessionCache) {
      void refreshAccounting();
    }
  }, []);

  return {
    accountingState: mergeAccountingState(state, accounting),
    accounting,
    summary,
    accountingStatus,
    loadingAccounting,
    loadingAccountingDetails,
    refreshAccounting,
    lastUpdated
  };
}

function filenameFromContentDisposition(value: string | null) {
  const match = value?.match(/filename="?([^"]+)"?/i);
  return match?.[1];
}

function useLiveAnnouncements(scope: "admin" | "resident") {
  const [announcements, setAnnouncements] = useState<AppwriteAnnouncement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementError, setAnnouncementError] = useState("");
  const endpoint = scope === "admin"
    ? "/api/appwrite/admin/announcements"
    : "/api/appwrite/resident/announcements";

  async function refreshAnnouncements(options: { force?: boolean } = {}) {
    const cached = announcementSessionCache.get(endpoint);
    if (!options.force && cached && Date.now() - cached.savedAt < STATIC_DATA_CACHE_MS) {
      setAnnouncements(cached.announcements);
      setLoadingAnnouncements(false);
      setAnnouncementError("");
      return;
    }

    setLoadingAnnouncements(true);
    setAnnouncementError("");

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as AnnouncementApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to load announcements.");
      }

      const nextAnnouncements = payload.announcements ?? [];
      announcementSessionCache.set(endpoint, { savedAt: Date.now(), announcements: nextAnnouncements });
      setAnnouncements(nextAnnouncements);
    } catch (error) {
      setAnnouncements([]);
      setAnnouncementError(error instanceof Error ? error.message : "Unable to load announcements.");
    } finally {
      setLoadingAnnouncements(false);
    }
  }

  useEffect(() => {
    void refreshAnnouncements();
  }, [endpoint]);

  return {
    announcements,
    loadingAnnouncements,
    announcementError,
    refreshAnnouncements,
    setAnnouncements
  };
}

function emptyAnnouncementForm() {
  return {
    title: "",
    message: "",
    targetRole: "all" as AppwriteAnnouncement["targetRole"],
    priority: "normal" as AppwriteAnnouncement["priority"],
    status: "published" as AppwriteAnnouncement["status"],
    expiresAt: "",
    isPinned: false
  };
}

function announcementTargetLabel(targetRole: AppwriteAnnouncement["targetRole"]) {
  const labels: Record<AppwriteAnnouncement["targetRole"], string> = {
    all: "all residents",
    resident: "residents",
    security: "security",
    cso: "cso"
  };

  return labels[targetRole];
}

function announcementPriorityTone(priority: AppwriteAnnouncement["priority"]) {
  if (priority === "urgent") {
    return "red";
  }

  if (priority === "high") {
    return "yellow";
  }

  return priority === "low" ? "slate" : "green";
}

function announcementCardClassName(announcement: AppwriteAnnouncement) {
  if (announcement.priority === "urgent") {
    return "rounded-lg border border-danger/50 bg-ink/50 p-4";
  }

  if (announcement.priority === "high") {
    return "rounded-lg border border-warn/50 bg-ink/50 p-4";
  }

  return "rounded-lg border border-line bg-ink/50 p-4";
}

function formatAnnouncementDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

function announcementExpiryLabel(value?: string) {
  if (!value) {
    return "";
  }

  const expiry = Date.parse(value);
  if (!Number.isFinite(expiry)) {
    return "";
  }

  const days = Math.ceil((expiry - Date.now()) / 86_400_000);
  if (days < 0 || days > 7) {
    return "";
  }

  return days === 1 ? "Expires in 1 day" : `Expires in ${days} days`;
}

function useAdminComplaints(filters: ComplaintFilters) {
  const [complaints, setComplaints] = useState<AppwriteComplaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [complaintError, setComplaintError] = useState("");

  async function refreshComplaints() {
    setLoadingComplaints(true);
    setComplaintError("");

    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.category) params.set("category", filters.category);
      if (filters.search.trim()) params.set("search", filters.search.trim());

      const query = params.toString();
      const response = await fetch(`/api/appwrite/admin/complaints${query ? `?${query}` : ""}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as ComplaintApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to load complaints.");
      }

      setComplaints(payload.complaints ?? []);
    } catch (error) {
      setComplaints([]);
      setComplaintError(error instanceof Error ? error.message : "Unable to load complaints.");
    } finally {
      setLoadingComplaints(false);
    }
  }

  useEffect(() => {
    void refreshComplaints();
  }, [filters.status, filters.priority, filters.category, filters.search]);

  return {
    complaints,
    loadingComplaints,
    complaintError,
    refreshComplaints
  };
}

function useResidentComplaints() {
  const [complaints, setComplaints] = useState<AppwriteComplaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [complaintError, setComplaintError] = useState("");

  async function refreshComplaints() {
    setLoadingComplaints(true);
    setComplaintError("");

    try {
      const response = await fetch("/api/appwrite/resident/complaints", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as ComplaintApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to load complaints.");
      }

      setComplaints(payload.complaints ?? []);
    } catch (error) {
      setComplaints([]);
      setComplaintError(error instanceof Error ? error.message : "Unable to load complaints.");
    } finally {
      setLoadingComplaints(false);
    }
  }

  useEffect(() => {
    void refreshComplaints();
  }, []);

  return {
    complaints,
    loadingComplaints,
    complaintError,
    refreshComplaints
  };
}

function useAdminOpenComplaintsCount(fallbackCount: number) {
  const [count, setCount] = useState(fallbackCount);

  useEffect(() => {
    let active = true;

    fetch("/api/appwrite/admin/complaints?status=open", { cache: "no-store" })
      .then((response) => response.json().then((payload) => ({ response, payload: payload as ComplaintApiResponse })))
      .then(({ response, payload }) => {
        if (active && response.ok) {
          setCount(payload.complaints?.length ?? 0);
        }
      })
      .catch(() => {
        if (active) {
          setCount(fallbackCount);
        }
      });

    return () => {
      active = false;
    };
  }, [fallbackCount]);

  return count;
}

function complaintStatusLabel(status: AppwriteComplaint["status"]) {
  return status === "in_progress" ? "in progress" : status;
}

function formatComplaintDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(timestamp));
}

function useKnowledgeArticles(manager: boolean) {
  const [articles, setArticles] = useState<AppwriteKnowledgeBaseArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [articleError, setArticleError] = useState("");
  const endpoint = manager ? "/api/appwrite/admin/knowledge-base" : "/api/appwrite/resident/knowledge-base";

  async function refreshArticles(options: { force?: boolean } = {}) {
    const cached = knowledgeSessionCache.get(endpoint);
    if (!options.force && cached && Date.now() - cached.savedAt < STATIC_DATA_CACHE_MS) {
      setArticles(cached.articles);
      setLoadingArticles(false);
      setArticleError("");
      return;
    }

    setLoadingArticles(true);
    setArticleError("");

    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as KnowledgeApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to load knowledge base articles.");
      }

      const nextArticles = payload.articles ?? [];
      knowledgeSessionCache.set(endpoint, { savedAt: Date.now(), articles: nextArticles });
      setArticles(nextArticles);
    } catch (error) {
      setArticles([]);
      setArticleError(error instanceof Error ? error.message : "Unable to load knowledge base articles.");
    } finally {
      setLoadingArticles(false);
    }
  }

  useEffect(() => {
    void refreshArticles();
  }, [endpoint]);

  return { articles, loadingArticles, articleError, refreshArticles };
}

function emptyKnowledgeForm() {
  return {
    title: "",
    category: "general" as AppwriteKnowledgeBaseArticle["category"],
    content: "",
    targetRole: "all" as AppwriteKnowledgeBaseArticle["targetRole"],
    tags: "",
    sortOrder: 0,
    isPublished: true
  };
}

function formatKnowledgeDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

function useHouseholdMembers() {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberError, setMemberError] = useState("");

  async function refreshMembers() {
    setLoadingMembers(true);
    setMemberError("");

    try {
      const response = await fetch("/api/appwrite/resident/household", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as HouseholdApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to load household members.");
      }

      setMembers(payload.members ?? []);
    } catch (error) {
      setMembers([]);
      setMemberError(error instanceof Error ? error.message : "Unable to load household members.");
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    void refreshMembers();
  }, []);

  return { members, loadingMembers, memberError, refreshMembers };
}

function emptyHouseholdForm() {
  return {
    fullName: "",
    relationship: "relative" as HouseholdMember["relationship"],
    phone: "",
    idType: "none" as NonNullable<HouseholdMember["idType"]>,
    idNumber: "",
    hasEstateAccess: true,
    accessNote: ""
  };
}

function relationshipLabel(value: HouseholdMember["relationship"]) {
  return value.replace(/_/g, " ");
}

export function AdminDashboard() {
  const { state } = useLocalEstateStore();
  const { visitorViews, loadingVisitors, visitorError } = useLiveVisitorViews(readAppwriteAdminVisitors);
  const todaysVisitorViews = visitorViews.filter(({ visitor }) => isTodayVisitor(visitor));
  const recentTodayVisitorViews = [...todaysVisitorViews]
    .sort((left, right) => visitorSortTime(right.visitor) - visitorSortTime(left.visitor))
    .slice(0, 5);
  const visitorAccessRows = loadingVisitors
    ? visitorLoadingRows(5)
    : recentTodayVisitorViews.length
      ? recentTodayVisitorViews.map(({ visitor, residentName }) => [
        visitor.visitorName,
        residentName,
        `${visitor.visitDate} ${formatClockTime(visitor.arrivalTime)}`,
        <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
        <StatusBadge key={visitor.status} status={visitor.status} />
      ])
      : [["No visitors today", "—", "—", "—", "—"]];
  const { accountingState, summary } = useAdminAccountingState(state);
  const confirmedPayments = accountingState.payments.filter((payment) => payment.status === "confirmed");
  const paid = summary?.paidAmount ?? confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const expected = summary?.expectedRevenue ?? accountingState.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const outstanding = summary?.outstandingBalance ?? accountingState.bills.reduce((sum, bill) => sum + billOutstandingAmount(accountingState, bill), 0);
  const credit = summary?.creditBalance ?? accountingState.bills.reduce((sum, bill) => sum + billCreditAmount(accountingState, bill), 0);
  const onlinePayments = confirmedPayments.filter((payment) => isResidentOnlinePaymentChannel(payment.channel)).reduce((sum, payment) => sum + payment.amount, 0);
  const manualPayments = confirmedPayments.filter((payment) => payment.channel !== "online").reduce((sum, payment) => sum + payment.amount, 0);
  const pendingPayments = summary?.pendingReviewAmount ?? accountingState.payments.filter((payment) => payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);
  const openComplaints = useAdminOpenComplaintsCount(state.complaints.filter((item) => item.status !== "resolved").length);

  return (
    <>
      <PageHeader
        title="Estate command center"
        description="Manage LBS View Estate operations across residents, access control, billing, complaints, announcements, and reports."
      >
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/sos-alerts">
            <Button variant="danger">
              <Siren className="h-4 w-4" />
              SOS Alerts
            </Button>
          </Link>
          <Link href="/admin/bills">
            <Button>
              <FilePlus2 className="h-4 w-4" />
              Create bill
            </Button>
          </Link>
        </div>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatCard label="Total residents" value={String(state.residents.length)} helper="Across active demo estates" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Visitors today" value={loadingVisitors ? "..." : String(todaysVisitorViews.length)} helper="Live Appwrite records for today" icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Open complaints" value={String(openComplaints)} helper="Needs admin action" icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <DataTable
          title="Visitor access log"
          description={visitorError || "Five most recent live Appwrite visitor records for today."}
          headers={["Visitor", "Resident", "Date", "Code", "Status"]}
          rows={visitorAccessRows}
        />
        <Card>
          <CardHeader title="Revenue snapshot" description="Expected revenue, confirmed payments, outstanding balances, credits, and pending reviews." />
          <div className="space-y-5">
            <Progress label="Expected revenue" value={expected} max={expected} />
            <Progress label="Confirmed paid" value={paid} max={expected} />
            <Progress label="Outstanding" value={outstanding} max={expected} tone="bg-warn" />
            <Progress label="Credit / advance" value={credit} max={expected} tone="bg-smart" />
            <Progress label="Confirmed online" value={onlinePayments} max={expected} tone="bg-sky" />
            <Progress label="Confirmed manual" value={manualPayments} max={expected} tone="bg-slate-400" />
            <Progress label="Pending review" value={pendingPayments} max={expected} tone="bg-red-400" />
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-medium text-white">Recent activities</p>
            <div className="mt-3 grid gap-3">
              {activityLogs.map((log) => (
                <div key={log} className="rounded-lg border border-line bg-ink/50 px-3 py-3 text-sm text-slate-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

export function EstateProfilePage() {
  const [message, setMessage] = useState("");

  return (
    <>
      <PageHeader title="Estate profile" description="Configure estate identity, gate details, billing account, contact information, and service charge categories." />
      <Card>
        <CardHeader title="LBS View Estate settings" description="These fields map to the estates table and are scoped by estate_id." />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Estate name"><Input defaultValue="LBS View Estate" /></Field>
          <Field label="Address"><Input defaultValue="LBS View Estate, Lagos" /></Field>
          <Field label="Primary contact email"><Input defaultValue="admin@lbsviewestate.example" /></Field>
          <Field label="Contact phone"><Input defaultValue="+234 801 111 2040" /></Field>
          <Field label="Security gate name"><Input defaultValue="Main Gate A" /></Field>
          <Field label="Payment account"><Input defaultValue="Corso Estate Collections - 0123456789 - GTBank" /></Field>
        </div>
        <div className="mt-5">
          <Field label="Service charge categories">
            <Textarea defaultValue={"Service charge\nSecurity levy\nWaste management\nPower/infrastructure levy\nMaintenance fee"} />
          </Field>
        </div>
        {message ? <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
        <Button className="mt-5" type="button" onClick={() => setMessage("Estate profile settings saved for this session.")}>
          Save estate profile
        </Button>
      </Card>
    </>
  );
}

export function ResidentsAdminPage() {
  const {
    state,
    approveAccessRequest,
    rejectAccessRequest,
    refreshEstateState,
    addProperty,
    addUnit,
    onboardResident
  } = useLocalEstateStore();
  const pendingRequests = state.accessRequests.filter((request) => request.status === "pending");
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [savingResident, setSavingResident] = useState(false);
  const [residentMessage, setResidentMessage] = useState("");
  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [appwriteDirectory, setAppwriteDirectory] = useState<AppwriteResidentDirectory | null>(null);
  const [appwriteDirectoryStatus, setAppwriteDirectoryStatus] = useState("Loading Appwrite residents...");
  const [loadingAppwriteDirectory, setLoadingAppwriteDirectory] = useState(false);
  const [exportingScope, setExportingScope] = useState<"" | "residents" | "all">("");
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [creatingResidentLoginId, setCreatingResidentLoginId] = useState("");
  const [assigningVirtualAccountId, setAssigningVirtualAccountId] = useState("");
  const [virtualAccountsByResidentId, setVirtualAccountsByResidentId] = useState<Record<string, ResidentVirtualAccountDetails>>({});
  const [residentLoginCredential, setResidentLoginCredential] = useState<TemporaryCredential | null>(null);
  const directoryState: LocalEstateState = {
    ...state,
    properties: appwriteDirectory?.properties ?? [],
    units: appwriteDirectory?.units ?? [],
    residents: appwriteDirectory?.residents ?? [],
    bills: [],
    payments: [],
    visitors: [],
    complaints: [],
    emergencyAlerts: []
  };
  const directoryResidents = appwriteDirectory?.residents ?? [];

  useEffect(() => {
    void refreshAppwriteResidentDirectory();
  }, []);

  async function refreshAppwriteResidentDirectory() {
    setLoadingAppwriteDirectory(true);
    setAppwriteDirectoryStatus("Loading Appwrite residents...");

    try {
      const response = await fetch("/api/appwrite/admin/residents", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as (AppwriteResidentDirectory & { error?: string }) | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to load Appwrite residents.");
      }

      setAppwriteDirectory(payload);
      setAppwriteDirectoryStatus(
        payload?.residents.length
          ? `Loaded ${payload.residents.length} imported residents from Appwrite TablesDB.`
          : "Appwrite is connected, but no imported residents were found."
      );
    } catch (error) {
      setAppwriteDirectory(null);
      setAppwriteDirectoryStatus(error instanceof Error ? error.message : "Unable to load Appwrite residents.");
    } finally {
      setLoadingAppwriteDirectory(false);
    }
  }

  async function downloadAppwriteCsv(scope: "residents" | "all") {
    setExportingScope(scope);
    setResidentMessage("");

    try {
      const response = await fetch(`/api/appwrite/admin/export?scope=${scope}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "CSV export failed.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFromContentDisposition(response.headers.get("content-disposition")) ?? (
        scope === "residents" ? "corso-residents.csv" : "corso-appwrite-all-data.csv"
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setResidentMessage(scope === "residents" ? "Residents CSV download started." : "Full Appwrite CSV download started.");
    } catch (error) {
      setResidentMessage(error instanceof Error ? error.message : "CSV export failed.");
    } finally {
      setExportingScope("");
    }
  }

  async function saveResident(resident: Resident, input: ResidentEditInput) {
    setSavingResident(true);
    setResidentMessage("");

    try {
      const updatedResident = await updateAppwriteResidentFromDirectory(resident.id, input);

      setAppwriteDirectory((current) => current
        ? {
            ...current,
            residents: current.residents.map((item) => item.id === updatedResident.id ? updatedResident : item)
          }
        : current
      );

      setEditingResident(null);
      setResidentMessage(`${updatedResident.name}'s resident record has been updated.`);
    } catch (error) {
      setResidentMessage(error instanceof Error ? error.message : "Resident details could not be updated.");
    } finally {
      setSavingResident(false);
    }
  }

  async function createResidentLogin(resident: Resident) {
    const unit = getResidentUnit(directoryState, resident);
    const houseNumber = unit?.unitCode ?? (
      resident.houseNumber && resident.houseNumber !== "Pending assignment" ? resident.houseNumber : ""
    );

    if (!resident.phone.trim()) {
      setResidentMessage("Add this resident's phone number before creating a login.");
      return;
    }

    if (!houseNumber.trim()) {
      setResidentMessage("Assign this resident to a property / unit ID before creating a login.");
      return;
    }

    const password = window.prompt(
      `Set login password for ${resident.name}. Leave blank to auto-generate a temporary password.`,
      ""
    );

    if (password === null) {
      return;
    }

    setCreatingResidentLoginId(resident.id);
    setResidentMessage("");
    setResidentLoginCredential(null);

    try {
      const response = await fetch("/api/appwrite/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: resident.name,
          email: resident.email,
          phone: resident.phone,
          role: "resident",
          estateId: resident.estateId || state.estates[0]?.id || "",
          houseNumber,
          password
        })
      });
      const payload = await response.json().catch(() => null) as {
        message?: string;
        loginIdentifier?: string;
        temporaryPassword?: string;
        user?: { fullName?: string };
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Resident login could not be created.");
      }

      setResidentMessage(payload?.message ?? `${resident.name}'s resident login has been created.`);
      setResidentLoginCredential({
        fullName: payload?.user?.fullName ?? resident.name,
        role: "resident",
        loginIdentifier: payload?.loginIdentifier ?? resident.phone,
        password: payload?.temporaryPassword ?? password
      });
      await refreshAppwriteResidentDirectory();
    } catch (error) {
      setResidentMessage(error instanceof Error ? error.message : "Resident login could not be created.");
    } finally {
      setCreatingResidentLoginId("");
    }
  }

  async function assignVirtualAccount(resident: Resident) {
    setAssigningVirtualAccountId(resident.id);
    setResidentMessage("");

    try {
      const response = await fetch("/api/monnify/virtual-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ residentId: resident.id })
      });
      const payload = await response.json().catch(() => null) as {
        account?: ResidentVirtualAccountDetails;
        error?: string;
      } | null;

      if (!response.ok || !payload?.account) {
        throw new Error(payload?.error ?? "Virtual account could not be assigned.");
      }

      setVirtualAccountsByResidentId((current) => ({
        ...current,
        [resident.id]: payload.account as ResidentVirtualAccountDetails
      }));
      setResidentMessage(`Virtual account assigned to ${resident.name}: ${payload.account.accountNumber} (${payload.account.bankName}).`);
    } catch (error) {
      setResidentMessage(error instanceof Error ? error.message : "Virtual account could not be assigned.");
    } finally {
      setAssigningVirtualAccountId("");
    }
  }

  async function updateAppwriteResidentFromDirectory(residentId: string, input: ResidentEditInput) {
    const response = await fetch("/api/appwrite/admin/residents", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        residentId,
        name: input.name,
        propertyId: input.propertyId,
        unitId: input.unitId,
        phone: input.phone,
        email: input.email,
        type: input.type,
        status: input.status,
        moveInDate: input.moveInDate,
        legacyName: input.legacyName,
        legacyAddress: input.legacyAddress,
        openingOutstanding: input.openingOutstanding,
        expectedMonthly: input.expectedMonthly,
        onboardingStatus: input.onboardingStatus,
        reviewReasons: input.reviewReasons
      })
    });
    const payload = await response.json().catch(() => null) as { resident?: Resident; error?: string } | null;
    if (!response.ok || !payload?.resident) {
      throw new Error(payload?.error ?? "Appwrite resident could not be updated.");
    }

    return payload.resident;
  }

  return (
    <>
      <PageHeader title="Residents" description="Add residents, manage household details, ownership status, and estate access." >
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void downloadAppwriteCsv("residents")} disabled={Boolean(exportingScope)}>
            <Download className="h-4 w-4" />
            {exportingScope === "residents" ? "Preparing" : "Residents CSV"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void downloadAppwriteCsv("all")} disabled={Boolean(exportingScope)}>
            <Database className="h-4 w-4" />
            {exportingScope === "all" ? "Preparing" : "All data CSV"}
          </Button>
          <Link href="/admin/users">
            <Button><Users className="h-4 w-4" />Add resident</Button>
          </Link>
        </div>
      </PageHeader>
      <AccessRequestsPanel
        requests={pendingRequests}
        onApprove={approveAccessRequest}
        onReject={rejectAccessRequest}
        onRefresh={() => void refreshEstateState()}
      />
      {residentMessage ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{residentMessage}</p> : null}
      {residentLoginCredential ? (
        <div className="mb-4">
          <TemporaryCredentialBox credential={residentLoginCredential} />
        </div>
      ) : null}
      {onboardingMessage ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{onboardingMessage}</p> : null}
      {editingResident ? (
        <ResidentEditCard
          resident={editingResident}
          state={directoryState}
          saving={savingResident}
          onSave={saveResident}
          onCancel={() => setEditingResident(null)}
        />
      ) : null}
      <ResidentDirectoryPanel
        residents={directoryResidents}
        state={directoryState}
        localResidents={[]}
        selectedResidentId={selectedResidentId}
        description={appwriteDirectoryStatus}
        loading={loadingAppwriteDirectory}
        onRefresh={() => void refreshAppwriteResidentDirectory()}
        onSelect={setSelectedResidentId}
        onEdit={(resident) => setEditingResident(resident)}
        onCreateLogin={(resident) => void createResidentLogin(resident)}
        creatingLoginId={creatingResidentLoginId}
        virtualAccountsByResidentId={virtualAccountsByResidentId}
        onAssignVirtualAccount={(resident) => void assignVirtualAccount(resident)}
        assigningVirtualAccountId={assigningVirtualAccountId}
      />
      <div className="mt-6">
        <ResidentOnboardingPanel
          state={state}
          appwriteDirectory={appwriteDirectory}
          onCreateProperty={(input) => {
            const property = addProperty(input);
            setOnboardingMessage(`${property.propertyCode} property group is ready.`);
          }}
          onCreateUnit={(input) => {
            try {
              const unit = addUnit(input);
              setOnboardingMessage(`${unit.unitCode} unit is ready.`);
            } catch (error) {
              setOnboardingMessage(error instanceof Error ? error.message : "Unit could not be saved.");
            }
          }}
          onCreateResident={(input) => {
            try {
              const resident = onboardResident(input);
              setOnboardingMessage(`${resident.name} has been attached to ${resident.houseNumber}.`);
            } catch (error) {
              setOnboardingMessage(error instanceof Error ? error.message : "Resident could not be onboarded.");
            }
          }}
        />
      </div>
    </>
  );
}

type PropertyOnboardingInput = {
  estateId: string;
  propertyCode: string;
  name: string;
  description: string;
  street: string;
  legacyName?: string;
  status?: Property["status"];
};

type UnitOnboardingInput = {
  estateId: string;
  propertyId: string;
  unitCode: string;
  label: string;
  apartmentType: string;
  status?: Unit["status"];
  moveInDate?: string;
  legacyName?: string;
};

type ResidentOnboardingInput = Pick<Resident, "name" | "phone" | "email" | "type" | "status"> & {
  estateId: string;
  unitId: string;
  moveInDate?: string;
  legacyName?: string;
  legacyAddress?: string;
  openingBalance?: number;
  monthlyCharge?: number;
};

function ResidentDirectoryPanel({
  residents,
  state,
  localResidents,
  selectedResidentId,
  description,
  loading,
  onRefresh,
  onSelect,
  onEdit,
  onCreateLogin,
  creatingLoginId,
  virtualAccountsByResidentId,
  onAssignVirtualAccount,
  assigningVirtualAccountId
}: {
  residents: Resident[];
  state: LocalEstateState;
  localResidents: Resident[];
  selectedResidentId: string;
  description: string;
  loading: boolean;
  onRefresh: () => void;
  onSelect: (residentId: string) => void;
  onEdit: (resident: Resident) => void;
  onCreateLogin: (resident: Resident) => void;
  creatingLoginId: string;
  virtualAccountsByResidentId: Record<string, ResidentVirtualAccountDetails>;
  onAssignVirtualAccount: (resident: Resident) => void;
  assigningVirtualAccountId: string;
}) {
  const [residentSearch, setResidentSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const propertyOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const property of state.properties) {
      options.set(property.id, `${property.propertyCode} - ${property.name}`);
    }
    return [...options.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [state.properties]);
  const filteredResidents = useMemo(() => {
    const query = residentSearch.trim().toLowerCase();
    return residents.filter((resident) => {
      const unit = getResidentUnit(state, resident);
      const property = getResidentProperty(state, resident);
      const haystack = [
        resident.name,
        resident.phone,
        resident.email,
        resident.houseNumber,
        unit?.unitCode,
        property?.propertyCode,
        property?.name,
        resident.legacyName,
        resident.legacyAddress
      ].filter(Boolean).join(" ").toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (propertyFilter !== "all" && resident.propertyId !== propertyFilter && unit?.propertyId !== propertyFilter) return false;
      if (statusFilter !== "all" && resident.status !== statusFilter) return false;
      if (reviewFilter === "needs_review" && resident.onboardingStatus !== "needs_review") return false;
      if (reviewFilter === "verified" && resident.onboardingStatus === "needs_review") return false;
      return true;
    });
  }, [propertyFilter, residentSearch, residents, reviewFilter, state, statusFilter]);
  const selectedResident = filteredResidents.find((resident) => resident.id === selectedResidentId) ?? filteredResidents[0];
  const explicitlySelectedResident = filteredResidents.find((resident) => resident.id === selectedResidentId);
  const selectedIsLocal = selectedResident ? localResidents.some((resident) => resident.id === selectedResident.id) : false;
  const explicitlySelectedIsLocal = explicitlySelectedResident
    ? localResidents.some((resident) => resident.id === explicitlySelectedResident.id)
    : false;

  return (
    <Card>
      <CardHeader
        title="Resident directory"
        description={description}
        action={
          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={onRefresh} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            {loading ? "Loading" : "Refresh"}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <Field label="Search residents">
          <Input value={residentSearch} onChange={(event) => setResidentSearch(event.currentTarget.value)} placeholder="Name, phone, unit, legacy text" />
        </Field>
        <Field label="Property group">
          <Select value={propertyFilter} onChange={(event) => setPropertyFilter(event.currentTarget.value)}>
            <option value="all">All property groups</option>
            {propertyOptions.map(([propertyId, label]) => (
              <option key={propertyId} value={propertyId}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Resident status">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="moved out">Moved out</option>
          </Select>
        </Field>
        <Field label="Review state">
          <Select value={reviewFilter} onChange={(event) => setReviewFilter(event.currentTarget.value)}>
            <option value="all">All records</option>
            <option value="needs_review">Needs review</option>
            <option value="verified">Verified</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400 md:col-span-4">
          <span className="rounded-full border border-white/10 px-2.5 py-1">{filteredResidents.length} shown</span>
          <span className="rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 text-warn">
            {residents.filter((resident) => resident.onboardingStatus === "needs_review").length} need review
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,28rem)] xl:grid-cols-[minmax(0,1fr)_minmax(27rem,30rem)]">
        <div className="grid gap-3 lg:hidden">
          {filteredResidents.length ? filteredResidents.map((resident) => {
            const source = localResidents.some((item) => item.id === resident.id) ? "Local" : "Database";
            const selected = explicitlySelectedResident?.id === resident.id;

            return (
              <ResidentDirectoryCard
                key={resident.id}
                resident={resident}
                state={state}
                selected={selected}
                source={source}
                onSelect={() => onSelect(selected ? "" : resident.id)}
              />
            );
          }) : (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-4 text-sm text-slate-400">
              No resident records match these filters.
            </div>
          )}
        </div>

        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/10 bg-black/10 lg:block">
          <table className="w-full table-auto border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {["Name", "Property / Unit", "Type", "Phone", "Status", "Review"].map((header) => (
                  <th key={header} className="border-b border-white/10 bg-white/[0.04] px-3 py-3 align-top font-semibold text-slate-300">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResidents.length ? filteredResidents.map((resident) => {
                const unit = getResidentUnit(state, resident);
                const property = getResidentProperty(state, resident);
                const selected = selectedResident?.id === resident.id;
                const source = localResidents.some((item) => item.id === resident.id) ? "Local" : "Database";

                return (
                  <tr
                    key={resident.id}
                    className={`cursor-pointer transition hover:bg-white/[0.05] ${selected ? "bg-smart/10" : ""}`}
                    onClick={() => onSelect(resident.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(resident.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td className="border-b border-white/10 px-3 py-4 align-top">
                      <p className="font-medium text-white">{resident.name}</p>
                      <p className="text-xs text-slate-500">{resident.email || "No email"}</p>
                    </td>
                    <td className="border-b border-white/10 px-3 py-4 align-top">
                      <p className="font-mono text-smart">{residentUnitLabel(state, resident)}</p>
                      <p className="text-xs text-slate-500">{unit?.apartmentType ?? "Unit pending"}{property?.legacyName ? ` - Legacy: ${property.legacyName}` : ""}</p>
                    </td>
                    <td className="border-b border-white/10 px-3 py-4 align-top capitalize text-slate-100">{resident.type}</td>
                    <td className="border-b border-white/10 px-3 py-4 align-top font-mono text-slate-100">{resident.phone || "No phone"}</td>
                    <td className="border-b border-white/10 px-3 py-4 align-top"><StatusBadge status={resident.status} /></td>
                    <td className="border-b border-white/10 px-3 py-4 align-top">
                      <span className={resident.onboardingStatus === "needs_review"
                        ? "inline-flex rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-xs font-semibold text-warn"
                        : "inline-flex rounded-full border border-smart/30 bg-smart/10 px-3 py-1 text-xs font-semibold text-smart"}
                      >
                        {resident.onboardingStatus === "needs_review" ? "Needs review" : source}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td className="px-3 py-4 text-sm text-slate-400" colSpan={6}>No resident records match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-hidden">
          <ResidentDetailsPanel
            resident={selectedResident}
            state={state}
            source={selectedIsLocal ? "Local" : "Database"}
            onEdit={selectedResident ? () => onEdit(selectedResident) : undefined}
            onCreateLogin={selectedResident ? () => onCreateLogin(selectedResident) : undefined}
            creatingLogin={selectedResident ? creatingLoginId === selectedResident.id : false}
            virtualAccount={selectedResident ? virtualAccountsByResidentId[selectedResident.id] : undefined}
            onAssignVirtualAccount={selectedResident ? () => onAssignVirtualAccount(selectedResident) : undefined}
            assigningVirtualAccount={selectedResident ? assigningVirtualAccountId === selectedResident.id : false}
          />
        </div>
      </div>

      {explicitlySelectedResident ? (
        <ResidentMobileDetailsOverlay
          resident={explicitlySelectedResident}
          state={state}
          source={explicitlySelectedIsLocal ? "Local" : "Database"}
          onClose={() => onSelect("")}
          onEdit={() => {
            onEdit(explicitlySelectedResident);
            onSelect("");
          }}
          onCreateLogin={() => onCreateLogin(explicitlySelectedResident)}
          creatingLogin={creatingLoginId === explicitlySelectedResident.id}
          virtualAccount={virtualAccountsByResidentId[explicitlySelectedResident.id]}
          onAssignVirtualAccount={() => onAssignVirtualAccount(explicitlySelectedResident)}
          assigningVirtualAccount={assigningVirtualAccountId === explicitlySelectedResident.id}
        />
      ) : null}
    </Card>
  );
}

function ResidentMobileDetailsOverlay({
  resident,
  state,
  source,
  onClose,
  onEdit,
  onCreateLogin,
  creatingLogin,
  virtualAccount,
  onAssignVirtualAccount,
  assigningVirtualAccount
}: {
  resident: Resident;
  state: LocalEstateState;
  source: string;
  onClose: () => void;
  onEdit: () => void;
  onCreateLogin: () => void;
  creatingLogin: boolean;
  virtualAccount?: ResidentVirtualAccountDetails;
  onAssignVirtualAccount?: () => void;
  assigningVirtualAccount?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 lg:hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[10000] flex max-h-[85vh] max-h-[85dvh] w-[92vw] max-w-md flex-col overflow-hidden rounded-xl border border-smart/30 bg-ink/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <span className="rounded-full border border-smart/25 bg-smart/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-smart">
            Resident details
          </span>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-slate-200"
            onClick={onClose}
            aria-label="Close resident details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ResidentDetailsPanel
            resident={resident}
            state={state}
            source={source}
            onEdit={onEdit}
            onCreateLogin={onCreateLogin}
            creatingLogin={creatingLogin}
            virtualAccount={virtualAccount}
            onAssignVirtualAccount={onAssignVirtualAccount}
            assigningVirtualAccount={assigningVirtualAccount}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function ResidentDirectoryCard({
  resident,
  state,
  selected,
  source,
  onSelect
}: {
  resident: Resident;
  state: LocalEstateState;
  selected: boolean;
  source: string;
  onSelect: () => void;
}) {
  const unit = getResidentUnit(state, resident);
  const property = getResidentProperty(state, resident);
  const contactSummary = [
    resident.phone ? "Phone" : "",
    resident.email ? "Email" : ""
  ].filter(Boolean).join(" + ") || "No contact";

  return (
    <button
      className={`min-h-[7.5rem] rounded-lg border p-3 text-left transition active:scale-[0.99] ${selected ? "border-smart/50 bg-smart/10 shadow-[0_0_0_1px_rgba(192,255,107,0.12)]" : "border-white/10 bg-black/20 hover:border-white/20"}`}
      onClick={onSelect}
      type="button"
      aria-expanded={selected}
    >
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{resident.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-smart/25 bg-smart/10 px-2.5 py-1 font-mono text-xs font-semibold text-smart">
                {residentUnitLabel(state, resident)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold capitalize text-slate-300">
                {resident.type}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={resident.status} />
            <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300">
              {selected ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </div>
        </div>

        <div className="grid gap-2 text-xs text-slate-400">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{unit?.apartmentType ?? "Unit pending"}{property?.street ? `, ${property.street}` : ""}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              {source}
            </span>
            {resident.onboardingStatus === "needs_review" ? (
              <span className="rounded-full border border-warn/30 bg-warn/10 px-2.5 py-1 text-[11px] font-semibold text-warn">
                Needs review
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              {contactSummary}
            </span>
            <span className="ml-auto text-[11px] font-semibold text-slate-500">
              {selected ? "Hide details" : "View details"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ResidentDetailsPanel({
  resident,
  state,
  source,
  onEdit,
  onCreateLogin,
  creatingLogin = false,
  virtualAccount,
  onAssignVirtualAccount,
  assigningVirtualAccount = false
}: {
  resident?: Resident;
  state: LocalEstateState;
  source: string;
  onEdit?: () => void;
  onCreateLogin?: () => void;
  creatingLogin?: boolean;
  virtualAccount?: ResidentVirtualAccountDetails;
  onAssignVirtualAccount?: () => void;
  assigningVirtualAccount?: boolean;
}) {
  if (!resident) {
    return (
      <aside className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
        Select a resident to view more information and actions.
      </aside>
    );
  }

  const propertyDisplay = residentPropertyDisplayLabel(state, resident);
  const unitDisplay = residentUnitDisplayLabel(state, resident);

  return (
    <aside className="rounded-lg border border-smart/20 bg-black/30 p-3 shadow-[0_14px_32px_rgba(0,0,0,0.22)] sm:p-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:overscroll-contain">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-smart">Resident</p>
          <h2 className="mt-1 break-words text-lg font-semibold text-white sm:text-xl">{resident.name}</h2>
          <p className="mt-1 font-mono text-sm text-smart">{propertyDisplay} / {unitDisplay}</p>
        </div>
        <StatusBadge status={resident.status} />
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <ResidentDetailLine label="Source" value={source} />
        <ResidentDetailLine label="Type" value={resident.type} />
        <ResidentDetailLine label="Phone" value={resident.phone || "No phone"} />
        <ResidentDetailLine label="Email" value={resident.email || "No email"} />
        <ResidentDetailLine label="Property" value={propertyDisplay} />
        <ResidentDetailLine label="Unit" value={unitDisplay} />
        <ResidentDetailLine label="Opening balance" value={money(resident.openingOutstanding ?? 0)} />
        <ResidentDetailLine label="Monthly due" value={money(resident.expectedMonthly ?? 0)} />
        <ResidentDetailLine label="Review state" value={resident.onboardingStatus === "needs_review" ? "Needs review" : "Verified"} />
        <ResidentDetailLine label="Review notes" value={resident.reviewReasons || "None"} />
        <ResidentDetailLine label="Move-in" value={resident.moveInDate || "Not recorded"} />
        <ResidentDetailLine label="Legacy name" value={resident.legacyName || "None"} />
        <ResidentDetailLine label="Legacy address" value={resident.legacyAddress || "None"} />
      </div>

      {virtualAccount ? (
        <div className="mt-4 rounded-lg border border-smart/30 bg-smart/10 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-smart">Virtual account</p>
          <p className="mt-2 font-mono text-lg font-semibold text-white">{virtualAccount.accountNumber}</p>
          <p className="mt-1 text-slate-300">{virtualAccount.bankName}</p>
          <p className="mt-1 text-xs text-slate-500">{virtualAccount.accountName}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {onEdit ? (
          <Button type="button" onClick={onEdit} className="w-full">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : (
          <Button type="button" variant="secondary" className="w-full" disabled>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={!onCreateLogin || creatingLogin}
          onClick={onCreateLogin}
        >
          <KeyRound className="h-4 w-4" />
          {creatingLogin ? "Creating" : "Create login"}
        </Button>
        <Link href="/admin/payments">
          <Button type="button" variant="secondary" className="w-full">
            <WalletCards className="h-4 w-4" />
            Payments
          </Button>
        </Link>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:col-span-3"
          disabled={!onAssignVirtualAccount || assigningVirtualAccount}
          onClick={onAssignVirtualAccount}
        >
          <Landmark className="h-4 w-4" />
          {assigningVirtualAccount ? "Assigning" : virtualAccount ? "Refresh virtual account" : "Assign virtual account"}
        </Button>
      </div>
    </aside>
  );
}

function ResidentDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-white/10 pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[6.75rem_1fr] sm:gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-100">{value}</span>
    </div>
  );
}

function ResidentOnboardingPanel({
  state,
  appwriteDirectory,
  onCreateProperty,
  onCreateUnit,
  onCreateResident
}: {
  state: LocalEstateState;
  appwriteDirectory: AppwriteResidentDirectory | null;
  onCreateProperty: (input: PropertyOnboardingInput) => void;
  onCreateUnit: (input: UnitOnboardingInput) => void;
  onCreateResident: (input: ResidentOnboardingInput) => void;
}) {
  const estate = state.estates[0];
  const localEstateProperties = state.properties.filter((property) => property.estateId === estate.id);
  const localEstateUnits = state.units.filter((unit) => unit.estateId === estate.id);
  const displayProperties = appwriteDirectory?.properties.length ? appwriteDirectory.properties : localEstateProperties;
  const displayUnits = appwriteDirectory?.units.length ? appwriteDirectory.units : localEstateUnits;
  const displayResidents = appwriteDirectory?.residents.length ? appwriteDirectory.residents : state.residents;
  const propertyCount = appwriteDirectory?.total.properties ?? localEstateProperties.length;
  const unitCount = appwriteDirectory?.total.units ?? localEstateUnits.length;
  const activeResidentCount = displayResidents.filter((resident) => resident.status === "active").length;

  function submitProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onCreateProperty({
      estateId: String(form.get("estateId") ?? estate.id),
      propertyCode: String(form.get("propertyCode") ?? "").trim(),
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      street: String(form.get("street") ?? "").trim(),
      legacyName: String(form.get("legacyName") ?? "").trim(),
      status: String(form.get("status") ?? "active") as Property["status"]
    });
    event.currentTarget.reset();
  }

  function submitUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const propertyId = String(form.get("propertyId") ?? "");
    const property = state.properties.find((item) => item.id === propertyId);

    onCreateUnit({
      estateId: property?.estateId ?? estate.id,
      propertyId,
      unitCode: String(form.get("unitCode") ?? "").trim(),
      label: String(form.get("label") ?? "").trim(),
      apartmentType: String(form.get("apartmentType") ?? "").trim(),
      status: String(form.get("status") ?? "vacant") as Unit["status"],
      moveInDate: String(form.get("moveInDate") ?? "").trim(),
      legacyName: String(form.get("legacyName") ?? "").trim()
    });
    event.currentTarget.reset();
  }

  function submitResident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const unitId = String(form.get("unitId") ?? "");
    const unit = state.units.find((item) => item.id === unitId);

    onCreateResident({
      estateId: unit?.estateId ?? estate.id,
      unitId,
      name: String(form.get("name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      type: String(form.get("type") ?? "tenant") as Resident["type"],
      status: String(form.get("status") ?? "active") as Resident["status"],
      moveInDate: String(form.get("moveInDate") ?? "").trim(),
      legacyName: String(form.get("legacyName") ?? "").trim(),
      legacyAddress: String(form.get("legacyAddress") ?? "").trim(),
      openingBalance: moneyInputToNumber(String(form.get("openingBalance") ?? "")),
      monthlyCharge: moneyInputToNumber(String(form.get("monthlyCharge") ?? ""))
    });
    event.currentTarget.reset();
  }

  return (
    <div className="mb-6 grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatCard label="Property groups" value={String(propertyCount)} helper="Includes LDI, JC, AA" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Units" value={String(unitCount)} helper="Official unit IDs" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Active residents" value={String(activeResidentCount)} helper="Current occupants" icon={<Users className="h-5 w-5" />} />
      </div>
      <AppwriteOnboardingPanel />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Property group" description="Create LDI, JC, AA, or any other group." />
          <form className="grid gap-3" onSubmit={submitProperty}>
            <input type="hidden" name="estateId" value={estate.id} />
            <Field label="Code"><Input name="propertyCode" placeholder="JC or AA" required /></Field>
            <Field label="Name"><Input name="name" placeholder="Jeds Court Apartments" required /></Field>
            <Field label="Street / location"><Input name="street" placeholder="LBS View Estate" /></Field>
            <Field label="Description"><Input name="description" placeholder="Mini estate inside LBS View" /></Field>
            <Field label="Legacy label"><Input name="legacyName" placeholder="Old landlord or export label" /></Field>
            <Field label="Status">
              <Select name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
            <Button className="w-fit"><Building2 className="h-4 w-4" />Save group</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Unit" description="Normalize IDs like JC1, A1, AA-1." />
          <form className="grid gap-3" onSubmit={submitUnit}>
            <Field label="Property group">
              <Select name="propertyId" required>
                {localEstateProperties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.propertyCode} - {property.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unit ID"><Input name="unitCode" placeholder="JC1 or A1" required /></Field>
            <Field label="Label"><Input name="label" placeholder="Apartment 1" /></Field>
            <Field label="Apartment type"><Input name="apartmentType" placeholder="2 bedroom apartment" /></Field>
            <Field label="Legacy note"><Input name="legacyName" placeholder="JC1 Jed's Court Apartments" /></Field>
            <Field label="Status">
              <Select name="status" defaultValue="vacant">
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
                <option value="moved out">Moved out</option>
              </Select>
            </Field>
            <Button className="w-fit"><Landmark className="h-4 w-4" />Save unit</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Resident" description="Attach resident to official unit ID." />
          <form className="grid gap-3" onSubmit={submitResident}>
            <Field label="Unit">
              <Select name="unitId" required>
                {localEstateUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitCode} - {unit.apartmentType}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Full name"><Input name="name" required /></Field>
            <Field label="Phone"><Input name="phone" placeholder="+234..." /></Field>
            <Field label="Email"><Input name="email" type="email" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <Select name="type" defaultValue="tenant">
                  <option value="tenant">Tenant</option>
                  <option value="owner">Owner</option>
                  <option value="family member">Family member</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="active">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="moved out">Moved out</option>
                </Select>
              </Field>
            </div>
            <Field label="Move-in date"><Input name="moveInDate" type="date" /></Field>
            <Field label="Legacy name"><Input name="legacyName" placeholder="Old alias or landlord label" /></Field>
            <Field label="Legacy address"><Input name="legacyAddress" placeholder="Old address/export text" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Opening balance"><Input name="openingBalance" inputMode="decimal" placeholder="90000" /></Field>
              <Field label="Monthly charge"><Input name="monthlyCharge" inputMode="decimal" placeholder="10000" /></Field>
            </div>
            <Button className="w-fit"><UserCheck className="h-4 w-4" />Onboard resident</Button>
          </form>
        </Card>
      </div>
      <DataTable
        title="Property and unit groups"
        description="Use this to confirm mini-estate IDs before attaching residents."
        headers={["Group", "Name", "Units", "Legacy"]}
        rows={displayProperties.map((property) => [
          <span key={property.id} className="font-mono text-smart">{property.propertyCode}</span>,
          property.name,
          String(displayUnits.filter((unit) => unit.propertyId === property.id).length),
          property.legacyName ?? "-"
        ])}
      />
    </div>
  );
}

function AppwriteOnboardingPanel() {
  const [status, setStatus] = useState<AppwriteOnboardingStatus | null>(null);
  const [rows, setRows] = useState<LbsviewOnboardingPreviewRow[]>([]);
  const [summary, setSummary] = useState<AppwriteImportSummary | null>(null);
  const [billingSummary, setBillingSummary] = useState<AppwriteBillingImportSummary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<"" | "status" | "setup" | "dry-run" | "import" | "billing-dry-run" | "billing-import">("");
  const ready = Boolean(status?.configured);
  const hasRows = rows.length > 0;
  const importChunkSize = 12;

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    setBusy("status");
    setMessage("");

    try {
      const response = await fetch("/api/appwrite/onboarding/status", { cache: "no-store" });
      const payload = await response.json() as AppwriteOnboardingStatus;
      setStatus(payload);
    } catch {
      setMessage("Appwrite status could not be checked.");
    } finally {
      setBusy("");
    }
  }

  async function setupSchema() {
    setBusy("setup");
    setMessage("");

    try {
      const response = await fetch("/api/appwrite/onboarding/setup", { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Appwrite schema setup failed.");
      }

      setMessage("Appwrite database and tables are ready.");
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Appwrite schema setup failed.");
    } finally {
      setBusy("");
    }
  }

  async function loadPreviewFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setBusy("dry-run");
    setMessage("");

    try {
      const parsed = JSON.parse(cleanJsonText(await file.text())) as unknown;
      const previewRows = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "rows" in parsed && Array.isArray((parsed as { rows?: unknown }).rows)
          ? (parsed as { rows: unknown[] }).rows
          : [];

      if (!previewRows.length) {
        throw new Error("That file does not contain onboarding preview rows.");
      }

      const typedRows = previewRows as LbsviewOnboardingPreviewRow[];
      setRows(typedRows);
      const result = await sendImportRequest(typedRows, true);
      setMessage(`${result.summary.importableRows} resident rows are ready; ${result.summary.reviewRows} will be imported as needs review; ${result.summary.skippedRows} skipped.`);
    } catch (error) {
      setRows([]);
      setSummary(null);
      setBillingSummary(null);
      setMessage(error instanceof Error ? error.message : "Preview file could not be loaded.");
    } finally {
      setBusy("");
    }
  }

  async function dryRunLoadedRows() {
    if (!rows.length) {
      setMessage("Upload the onboarding preview JSON first.");
      return;
    }

    setBusy("dry-run");
    setMessage("");

    try {
      const result = await sendImportRequest(rows, true);
      setMessage(`${result.summary.importableRows} resident rows are ready; ${result.summary.reviewRows} will be imported as needs review; ${result.summary.skippedRows} skipped.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dry run failed.");
    } finally {
      setBusy("");
    }
  }

  async function importLoadedRows() {
    if (!rows.length) {
      setMessage("Upload the onboarding preview JSON first.");
      return;
    }

    setBusy("import");
    setMessage("");

    try {
      let offset = 0;
      let latest: AppwriteImportResponse | null = null;

      while (true) {
        latest = await sendImportRequest(rows, false, offset, importChunkSize);
        const progress = latest.progress;
        if (!progress) {
          break;
        }

        setMessage(`Importing residents ${progress.importedRows} of ${progress.totalRows}...`);
        if (progress.done || progress.nextOffset === null) {
          break;
        }

        offset = progress.nextOffset;
      }

      const result = latest;
      setMessage(result
        ? `Imported ${result.summary.residents} residents, including ${result.summary.reviewRows} review records, plus ${result.summary.openingBills} opening bills.`
        : "Import completed."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy("");
    }
  }

  async function dryRunBillingRows() {
    if (!rows.length) {
      setMessage("Upload the onboarding preview JSON first.");
      return;
    }

    setBusy("billing-dry-run");
    setMessage("");

    try {
      const result = await sendBillingImportRequest(rows, true);
      setMessage(`${result.summary.matchedResidents} existing residents matched for billing; ${result.summary.skippedRows} rows skipped.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing dry run failed.");
    } finally {
      setBusy("");
    }
  }

  async function importBillingRows() {
    if (!rows.length) {
      setMessage("Upload the onboarding preview JSON first.");
      return;
    }

    setBusy("billing-import");
    setMessage("");

    try {
      let offset = 0;
      let latest: AppwriteBillingImportResponse | null = null;

      while (true) {
        latest = await sendBillingImportRequest(rows, false, offset, importChunkSize);
        const progress = latest.progress;
        if (!progress) {
          break;
        }

        setMessage(`Updating balances ${progress.importedRows} of ${progress.totalRows}...`);
        if (progress.done || progress.nextOffset === null) {
          break;
        }

        offset = progress.nextOffset;
      }

      const result = latest;
      setMessage(`Updated ${result.summary.updatedResidents} resident balances, ${result.summary.openingBills} opening bills, and ${result.summary.legacyPayments} legacy payments.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing import failed.");
    } finally {
      setBusy("");
    }
  }

  async function sendImportRequest(previewRows: LbsviewOnboardingPreviewRow[], dryRun: boolean, offset?: number, limit?: number) {
    const response = await fetch("/api/appwrite/onboarding/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun, offset, limit, rows: previewRows })
    });
    const payload = await readJsonResponse<AppwriteImportResponse>(response);
    if (!response.ok) {
      throw new Error(payload.error ?? "Import request failed.");
    }

    setSummary(payload.summary);
    return payload;
  }

  async function sendBillingImportRequest(previewRows: LbsviewOnboardingPreviewRow[], dryRun: boolean, offset?: number, limit?: number) {
    const response = await fetch("/api/appwrite/onboarding/billing-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun, offset, limit, rows: previewRows })
    });
    const payload = await readJsonResponse<AppwriteBillingImportResponse>(response);
    if (!response.ok) {
      throw new Error(payload.error ?? "Billing import request failed.");
    }

    setBillingSummary(payload.summary);
    return payload;
  }

  return (
    <Card>
      <CardHeader
        title="Appwrite import"
        description="Create the live TablesDB schema, then import approved Excel-preview rows."
        action={
          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={busy === "status"} onClick={() => void refreshStatus()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-line bg-ink/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-smart/10 text-smart">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">TablesDB</p>
                <p className="text-xs text-slate-400">{status?.databaseId ?? "lbsview_estate"}</p>
              </div>
            </div>
            <StatusBadge status={ready ? "configured" : "missing key"} tone={ready ? "green" : "yellow"} />
          </div>
          <div className="mt-4 grid gap-2 text-xs text-slate-400">
            <p><span className="text-slate-500">Project:</span> {status?.projectId || "Not set"}</p>
            <p><span className="text-slate-500">Endpoint:</span> {status?.endpoint || "Not checked"}</p>
            <p><span className="text-slate-500">Missing:</span> {status?.missing.length ? status.missing.join(", ") : "None"}</p>
            <p><span className="text-slate-500">Tables:</span> {status?.tableIds.length ?? 0}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" className="min-h-9 px-3 py-1 text-xs" disabled={!ready || busy === "setup"} onClick={() => void setupSchema()}>
              <Database className="h-3.5 w-3.5" />
              Setup schema
            </Button>
            <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/15">
              <FileJson className="h-3.5 w-3.5" />
              Upload preview
              <input
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={(event) => void loadPreviewFile(event.currentTarget.files?.[0])}
              />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-ink/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Preview result</p>
              <p className="mt-1 text-xs text-slate-400">{hasRows ? `${rows.length} rows loaded` : "Upload .local-import/lbsview-onboarding-preview.json"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={!hasRows || busy === "dry-run"} onClick={() => void dryRunLoadedRows()}>
                <Search className="h-3.5 w-3.5" />
                Dry run
              </Button>
              <Button type="button" className="min-h-9 px-3 py-1 text-xs" disabled={!ready || !hasRows || busy === "import"} onClick={() => void importLoadedRows()}>
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-smart">Billing-only update</p>
                <p className="mt-1 text-xs text-slate-400">Adds old Excel payment totals to existing residents without changing names, units, or contacts.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={!ready || !hasRows || busy === "billing-dry-run"} onClick={() => void dryRunBillingRows()}>
                  <Search className="h-3.5 w-3.5" />
                  Billing dry run
                </Button>
                <Button type="button" className="min-h-9 px-3 py-1 text-xs" disabled={!ready || !hasRows || busy === "billing-import"} onClick={() => void importBillingRows()}>
                  <WalletCards className="h-3.5 w-3.5" />
                  Import balances
                </Button>
              </div>
            </div>
            {billingSummary ? (
              <div className="mt-3 grid gap-3 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <p>Finance rows: <span className="font-semibold text-white">{billingSummary.financeRows}</span></p>
                <p>Matched: <span className="font-semibold text-white">{billingSummary.matchedResidents}</span></p>
                <p>Expected: <span className="font-semibold text-white">{money(billingSummary.totals.expectedPayment)}</span></p>
                <p>Paid: <span className="font-semibold text-smart">{money(billingSummary.totals.amountPaid)}</span></p>
                <p>Outstanding: <span className="font-semibold text-warn">{money(billingSummary.totals.openingOutstanding)}</span></p>
                <p>Credit: <span className="font-semibold text-smart">{money(billingSummary.totals.creditBalance ?? 0)}</span></p>
                <p>Monthly due: <span className="font-semibold text-smart">{money(billingSummary.totals.expectedMonthly)}</span></p>
              </div>
            ) : null}
            {billingSummary?.skippedReasons.length ? (
              <div className="mt-3 grid gap-1 text-xs text-slate-400">
                {billingSummary.skippedReasons.slice(0, 3).map((item) => (
                  <p key={item.reason}>{item.reason}: <span className="text-slate-200">{item.count}</span></p>
                ))}
              </div>
            ) : null}
          </div>
          {summary ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniImportStat label="Ready" value={summary.importableRows} />
                <MiniImportStat label="Units" value={summary.units} />
                <MiniImportStat label="Skipped" value={summary.skippedRows} tone="text-warn" />
              </div>
              <div className="mt-4 grid gap-3 text-xs text-slate-400 sm:grid-cols-2">
                <p>Properties: <span className="font-semibold text-white">{summary.properties}</span></p>
                <p>Opening bills: <span className="font-semibold text-white">{summary.openingBills}</span></p>
                <p>Legacy payments: <span className="font-semibold text-white">{summary.legacyPayments}</span></p>
                <p>Manual review: <span className="font-semibold text-white">{summary.reviewRows}</span></p>
              </div>
              {summary.byProperty.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {summary.byProperty.map((item) => (
                    <span key={item.propertyCode} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs text-slate-300">
                      {item.propertyCode}: {item.count}
                    </span>
                  ))}
                </div>
              ) : null}
              {summary.skippedReasons.length ? (
                <div className="mt-4 grid gap-1 text-xs text-slate-400">
                  {summary.skippedReasons.slice(0, 3).map((item) => (
                    <p key={item.reason}>{item.reason}: <span className="text-slate-200">{item.count}</span></p>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-6 text-center text-sm text-slate-400">
              No preview loaded.
            </div>
          )}
          {message ? (
            <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("The server returned an empty response. Please refresh and try again.");
  }

  return JSON.parse(cleanJsonText(text)) as T;
}

function cleanJsonText(text: string) {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    throw new Error("The selected JSON file is empty.");
  }

  return cleaned;
}

function MiniImportStat({ label, value, tone = "text-smart" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

type ResidentEditInput = Pick<Resident, "name" | "houseNumber" | "phone" | "email" | "type" | "status"> & {
  propertyId?: string;
  unitId?: string;
  moveInDate?: string;
  legacyName?: string;
  legacyAddress?: string;
  openingOutstanding?: number;
  expectedMonthly?: number;
  onboardingStatus?: string;
  reviewReasons?: string;
};

function ResidentEditCard({
  resident,
  state,
  saving,
  onSave,
  onCancel
}: {
  resident: Resident;
  state: LocalEstateState;
  saving: boolean;
  onSave: (resident: Resident, input: ResidentEditInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const selectedUnit = getResidentUnit(state, resident);

  function submitResidentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const unitId = String(form.get("unitId") ?? resident.unitId ?? "");
    const unit = state.units.find((item) => item.id === unitId);

    void onSave(resident, {
      name: String(form.get("name") ?? "").trim(),
      houseNumber: unit?.unitCode ?? String(form.get("houseNumber") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      type: String(form.get("type") ?? resident.type) as Resident["type"],
      status: String(form.get("status") ?? resident.status) as Resident["status"],
      propertyId: unit?.propertyId ?? resident.propertyId,
      unitId: unit?.id ?? resident.unitId,
      moveInDate: String(form.get("moveInDate") ?? resident.moveInDate ?? "").trim(),
      legacyName: String(form.get("legacyName") ?? "").trim(),
      legacyAddress: String(form.get("legacyAddress") ?? "").trim(),
      openingOutstanding: formNumber(form.get("openingOutstanding")),
      expectedMonthly: formNumber(form.get("expectedMonthly")),
      onboardingStatus: String(form.get("onboardingStatus") ?? resident.onboardingStatus ?? "verified"),
      reviewReasons: String(form.get("reviewReasons") ?? "").trim()
    });
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="Edit resident"
        description={resident.name}
      />
      <form className="grid gap-4" onSubmit={submitResidentEdit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input name="name" defaultValue={resident.name} required />
          </Field>
          <Field label="Property / unit">
            <Select name="unitId" defaultValue={selectedUnit?.id ?? resident.unitId ?? ""}>
              <option value="">Unassigned / legacy only</option>
              {state.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitCode} - {unit.label} - {unit.apartmentType}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Legacy / fallback house number">
            <Input name="houseNumber" defaultValue={resident.houseNumber} required />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={resident.phone} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={resident.email} />
          </Field>
          <Field label="Resident type">
            <Select name="type" defaultValue={resident.type}>
              <option value="owner">Owner</option>
              <option value="tenant">Tenant</option>
              <option value="family member">Family member</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={resident.status}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="moved out">Moved out</option>
            </Select>
          </Field>
          <Field label="Move-in date">
            <Input name="moveInDate" type="date" defaultValue={resident.moveInDate ?? ""} />
          </Field>
          <Field label="Opening balance">
            <Input name="openingOutstanding" type="number" min="0" step="0.01" defaultValue={resident.openingOutstanding ?? 0} />
          </Field>
          <Field label="Monthly due">
            <Input name="expectedMonthly" type="number" min="0" step="0.01" defaultValue={resident.expectedMonthly ?? 0} />
          </Field>
          <Field label="Onboarding status">
            <Select name="onboardingStatus" defaultValue={resident.onboardingStatus ?? "verified"}>
              <option value="verified">Verified</option>
              <option value="needs_review">Needs review</option>
            </Select>
          </Field>
          <Field label="Legacy name">
            <Input name="legacyName" defaultValue={resident.legacyName ?? ""} placeholder="Old alias or landlord label" />
          </Field>
          <Field label="Legacy address">
            <Input name="legacyAddress" defaultValue={resident.legacyAddress ?? ""} placeholder="Old address/export text" />
          </Field>
          <Field label="Review notes">
            <Textarea name="reviewReasons" defaultValue={resident.reviewReasons ?? ""} placeholder="Why this record needs cleanup" />
          </Field>
        </div>
        <div className="sticky bottom-2 z-10 grid gap-2 rounded-lg border border-white/10 bg-ink/95 p-2 shadow-[0_-12px_32px_rgba(0,0,0,0.28)] backdrop-blur sm:static sm:flex sm:flex-wrap sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <Button className="w-full sm:w-auto" disabled={saving}>{saving ? "Saving resident" : "Save resident"}</Button>
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onCancel} disabled={saving}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function formNumber(value: FormDataEntryValue | null) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function AccessRequestsPanel({
  requests,
  onApprove,
  onReject,
  onRefresh
}: {
  requests: LocalAccessRequest[];
  onApprove: (requestId: string) => void | Promise<void>;
  onReject: (requestId: string) => void | Promise<void>;
  onRefresh?: () => void;
}) {
  const [workingRequestId, setWorkingRequestId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionTone, setActionTone] = useState<"success" | "error">("success");

  async function runRequestAction(requestId: string, action: "approve" | "reject") {
    setWorkingRequestId(requestId);
    setActionMessage("");

    try {
      if (action === "approve") {
        await onApprove(requestId);
        setActionMessage("Access request approved and removed from the approval queue.");
      } else {
        await onReject(requestId);
        setActionMessage("Access request rejected.");
      }

      setActionTone("success");
      onRefresh?.();
    } catch (error) {
      setActionTone("error");
      setActionMessage(error instanceof Error ? error.message : "Access request could not be updated.");
    } finally {
      setWorkingRequestId("");
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="Access requests"
        description="Residents can request an account from signup. Admin approval is required before they can log in."
        action={onRefresh ? (
          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={onRefresh}>
            Refresh
          </Button>
        ) : null}
      />
      {actionMessage ? (
        <p className={actionTone === "error"
          ? "mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100"
          : "mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart"}
        >
          {actionMessage}
        </p>
      ) : null}
      {requests.length ? (
        <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-lg">
          <table className="w-full table-auto border-separate border-spacing-0 text-left text-xs sm:text-sm">
            <thead>
              <tr>
                {["Name", "Phone", "Role", "Estate", "Date", "Action"].map((header) => (
                  <th key={header} className="max-w-56 border-b border-line pb-3 pr-3 align-top font-medium text-slate-400 last:pr-0">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="max-w-64 border-b border-line/60 py-4 pr-3 align-top text-white">{request.fullName}</td>
                  <td className="max-w-64 border-b border-line/60 py-4 pr-3 align-top font-mono text-smart">{contactLabel(request.email, request.phone)}</td>
                  <td className="max-w-64 border-b border-line/60 py-4 pr-3 align-top text-slate-200">{roleLabel(request.role)}</td>
                  <td className="max-w-64 border-b border-line/60 py-4 pr-3 align-top text-slate-200">{request.estate}</td>
                  <td className="max-w-64 border-b border-line/60 py-4 pr-3 align-top text-slate-200">{request.requestedAt}</td>
                  <td className="max-w-64 border-b border-line/60 py-4 pr-0 align-top">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="min-h-9 px-3 py-1 text-xs"
                        disabled={workingRequestId === request.id}
                        onClick={() => void runRequestAction(request.id, "approve")}
                      >
                        {workingRequestId === request.id ? "Working" : "Approve"}
                      </Button>
                      <Button
                        variant="danger"
                        className="min-h-9 px-3 py-1 text-xs"
                        disabled={workingRequestId === request.id}
                        onClick={() => void runRequestAction(request.id, "reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-ink/50 p-4 text-sm text-slate-400">
          No pending access requests. New signup requests will appear here after residents submit the request form.
        </div>
      )}
    </Card>
  );
}

export function VisitorLogsPage() {
  const { visitorViews, loadingVisitors, visitorError, refreshVisitors } = useLiveVisitorViews(readAppwriteAdminVisitors);

  return (
    <>
      <PageHeader title="Visitor logs" description="Review access codes, entry status, guard notes, entry times, and exit times.">
        <Button type="button" variant="secondary" onClick={() => void refreshVisitors()} disabled={loadingVisitors}>
          <RefreshCw className="h-4 w-4" />
          {loadingVisitors ? "Loading" : "Refresh"}
        </Button>
      </PageHeader>
      {visitorError ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{visitorError}</p> : null}
      <LiveVisitorCards
        title={loadingVisitors ? "Loading access control logs" : "Access control logs"}
        visitorViews={visitorViews}
        loading={loadingVisitors}
        error={visitorError}
        showResident
      />
    </>
  );
}

export function BillsAdminPage() {
  const { state } = useLocalEstateStore();
  const { accountingState, accounting, accountingStatus, loadingAccounting, loadingAccountingDetails, refreshAccounting } = useAdminAccountingState(state);
  const liveState: LocalEstateState = accounting
    ? accountingState
    : { ...state, residents: [], bills: [], payments: [], auditLogs: [] };
  const loading = loadingAccounting || loadingAccountingDetails;

  return (
    <>
      <PageHeader title="Bills" description="Create estate bills, assign them to residents or houses, and track due dates and payment status.">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void refreshAccounting({ bypassCache: true })} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            {loading ? "Loading" : "Refresh"}
          </Button>
          <Button type="button" onClick={() => scrollToSection("create-bill")}><ReceiptText className="h-4 w-4" />New bill</Button>
        </div>
      </PageHeader>
      <p className="mb-4 rounded-lg border border-line bg-ink/50 px-3 py-2 text-sm text-slate-400">{accountingStatus}</p>
      <MonthlyBillingPanel onBillingRun={() => void refreshAccounting({ bypassCache: true })} />
      <BillComposer
        onCreated={() => void refreshAccounting({ bypassCache: true })}
        state={liveState}
        residentsDirectory={liveState.residents}
      />
      <div className="mt-6">
        <BillsTable
          title={loading ? "Loading Appwrite billing register" : "Current billing register"}
          rows={liveState.bills}
          state={liveState}
          admin
          residentsDirectory={liveState.residents}
        />
      </div>
    </>
  );
}

function MonthlyBillingPanel({ onBillingRun }: { onBillingRun: () => void }) {
  const [billingMonth, setBillingMonth] = useState(currentMonthInputValue());
  const [running, setRunning] = useState<"dry" | "live" | "">("");
  const [result, setResult] = useState<BillingRunResult | null>(null);
  const [history, setHistory] = useState<BillingRunHistoryRow[]>([]);
  const [message, setMessage] = useState("");
  const completedForMonth = history.some((run) => run.billingMonth === billingMonth && run.status === "completed");

  async function refreshHistory() {
    try {
      const response = await fetch("/api/appwrite/admin/billing/run", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { runs?: BillingRunHistoryRow[]; error?: string } | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to load billing run history.");
      }
      setHistory(payload.runs ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load billing run history.");
    }
  }

  useEffect(() => {
    void refreshHistory();
  }, []);

  async function executeBillingRun(dryRun: boolean) {
    setMessage("");
    if (!dryRun && completedForMonth) {
      setMessage("Billing already run for this month. Use preview to inspect expected results.");
      return;
    }
    if (!dryRun) {
      const confirmed = window.confirm(`This will create subscription bills for active residents for ${formatBillingMonth(billingMonth)}. Residents with advance credit will be auto-settled. This cannot be undone. Continue?`);
      if (!confirmed) return;
    }

    setRunning(dryRun ? "dry" : "live");
    try {
      const response = await fetch("/api/appwrite/admin/billing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth, dryRun })
      });
      const payload = await response.json().catch(() => null) as (BillingRunResult & { error?: string }) | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to run monthly billing.");
      }

      setResult(payload);
      setMessage(dryRun ? `Billing preview for ${formatBillingMonth(billingMonth)} is ready.` : `Billing run complete for ${formatBillingMonth(billingMonth)}.`);
      await refreshHistory();
      if (!dryRun) {
        onBillingRun();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run monthly billing.");
    } finally {
      setRunning("");
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="Monthly Subscription Billing"
        description="Generate subscription bills for all active residents for a given month."
        action={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void executeBillingRun(true)} disabled={Boolean(running)}>
              <RefreshCw className={`h-4 w-4 ${running === "dry" ? "animate-spin" : ""}`} />
              {running === "dry" ? "Previewing" : "Preview billing run"}
            </Button>
            <Button type="button" onClick={() => void executeBillingRun(false)} disabled={Boolean(running) || completedForMonth}>
              <ReceiptText className={`h-4 w-4 ${running === "live" ? "animate-pulse" : ""}`} />
              {running === "live" ? "Running" : `Run billing for ${formatBillingMonth(billingMonth)}`}
            </Button>
          </div>
        )}
      />
      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <Field label="Billing month">
          <Input type="month" value={billingMonth} onChange={(event) => setBillingMonth(event.target.value)} />
        </Field>
        <div className="rounded-lg border border-line bg-ink/50 px-3 py-3 text-sm text-slate-300">
          {completedForMonth ? "Billing has already been completed for this month. Preview remains available." : "Choose a month, preview the run, then create bills when ready."}
        </div>
      </div>
      {message ? <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
      {result ? <BillingRunResultPanel result={result} /> : null}
      <div className="mt-6">
        <DataTable
          title="Billing run history"
          headers={["Month", "Run date", "Run by", "Bills created", "Auto-paid", "Need payment", "Errors", "Status"]}
          rows={history.map((run) => [
            formatBillingMonth(run.billingMonth),
            formatPaymentDate(run.runDate),
            run.runByName,
            String(run.billsCreated),
            String(run.autoPaidFromCredit),
            String(run.requiresPayment),
            String(run.errors),
            <StatusBadge key={run.id} status={run.status} tone={run.status === "completed" ? "green" : run.status === "partial" ? "yellow" : "red"} />
          ])}
        />
      </div>
    </Card>
  );
}

function BillingRunResultPanel({ result }: { result: BillingRunResult }) {
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-white">
        {result.dryRun ? "Billing preview" : "Billing run complete"} for {formatBillingMonth(result.billingMonth)}
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        <StatCard label="Total residents" value={String(result.totalResidents)} helper="Billable unit targets" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Bills to create" value={String(result.billsCreated)} helper={result.dryRun ? "Preview count" : "Created"} icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Auto-paid" value={String(result.autoPaidFromCredit)} helper="Settled from credit" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Requires payment" value={String(result.requiresPayment)} helper="Resident needs to pay" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Skipped" value={String(result.skipped)} helper="Not billed" icon={<UserX className="h-5 w-5" />} />
        <StatCard label="Errors" value={String(result.errors)} helper="Needs review" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>
      {result.errors > 0 ? (
        <details className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-red-100">
          <summary className="cursor-pointer font-semibold">View billing errors</summary>
          <div className="mt-3 grid gap-2">
            {result.errorDetails.map((error) => (
              <p key={`${error.residentId}-${error.reason}`}>{error.residentName}: {error.reason}</p>
            ))}
          </div>
        </details>
      ) : null}
      <details className="mt-4 rounded-lg border border-line bg-ink/50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">View full summary</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {["Resident", "Unit", "Rate", "Bill Created", "Auto-paid", "Action"].map((header) => (
                  <th key={header} className="border-b border-line px-3 py-3 text-slate-300">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.summary.map((row) => (
                <tr key={`${row.residentId}-${row.unitCode}`}>
                  <td className="border-b border-line/60 px-3 py-3 text-white">{row.residentName}</td>
                  <td className="border-b border-line/60 px-3 py-3 font-mono text-smart">{row.unitCode}</td>
                  <td className="border-b border-line/60 px-3 py-3 text-slate-200">{money(row.monthlyRate)}</td>
                  <td className="border-b border-line/60 px-3 py-3 text-slate-200">{row.billCreated ? "Yes" : "No"}</td>
                  <td className="border-b border-line/60 px-3 py-3 text-slate-200">{row.autoPaid ? "Yes" : "No"}</td>
                  <td className="border-b border-line/60 px-3 py-3">
                    <StatusBadge status={row.autoPaid ? "Paid from credit" : row.billCreated ? "Payment needed" : row.action} tone={row.autoPaid ? "green" : row.billCreated ? "yellow" : "slate"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function PaymentsAdminPage() {
  const { state, addPayment, confirmPayment } = useLocalEstateStore();
  const { accountingState, accounting, summary, accountingStatus, loadingAccounting, loadingAccountingDetails, refreshAccounting } = useAdminAccountingState(state);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentChannel, setPaymentChannel] = useState<NonNullable<Payment["channel"]>>("bank_transfer");
  const [paymentConfirmation, setPaymentConfirmation] = useState<AdminPaymentConfirmation | null>(null);
  const expected = summary?.expectedRevenue ?? accountingState.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const confirmed = summary?.paidAmount ?? accountingState.payments.filter((payment) => payment.status === "confirmed").reduce((sum, payment) => sum + payment.amount, 0);
  const pendingReview = summary?.pendingReviewAmount ?? accountingState.payments.filter((payment) => payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = summary?.outstandingBalance ?? accountingState.bills.reduce((sum, bill) => sum + billOutstandingAmount(accountingState, bill), 0);
  const credit = summary?.creditBalance ?? accountingState.bills.reduce((sum, bill) => sum + billCreditAmount(accountingState, bill), 0);
  const netReceivable = summary?.netReceivable ?? Math.max(0, outstanding - credit);
  const debtors = summary?.debtorsCount ?? accountingState.residents.filter((resident) => residentBillingBalance(accountingState, resident.id).netReceivable > 0).length;
  const payableBills = accountingState.bills.filter((bill) => billOutstandingAmount(accountingState, bill) > 0);
  const selectedBill = accountingState.bills.find((bill) => bill.id === selectedBillId) ?? payableBills[0];
  const selectedResident = selectedBill ? accountingState.residents.find((resident) => resident.id === selectedBill.residentId) : undefined;
  const selectedBalance = selectedResident ? residentBillingBalance(accountingState, selectedResident.id) : null;
  const selectedMonthlyRate = selectedResident?.expectedMonthly ?? 0;
  const paymentPreview = selectedBalance && selectedResident
    ? buildPaymentPreview(Number(paymentAmount || 0), selectedBalance.netReceivable, selectedMonthlyRate)
    : null;

  useEffect(() => {
    if (!selectedBillId && payableBills[0]?.id) {
      setSelectedBillId(payableBills[0].id);
    }
  }, [payableBills, selectedBillId]);

  async function submitAdminPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPayment(true);
    setPaymentMessage("");
    setPaymentConfirmation(null);

    const form = new FormData(event.currentTarget);
    const billId = String(form.get("billId") || selectedBillId);
    const bill = accountingState.bills.find((item) => item.id === billId);
    const amount = Number(form.get("amount") || paymentAmount || 0);
    const reference = String(form.get("reference") || `ADMIN-${Date.now()}`);
    const channel = String(form.get("channel") || paymentChannel || "bank_transfer") as NonNullable<Payment["channel"]>;
    const date = String(form.get("date") || dateInputValue());
    const resident = bill ? accountingState.residents.find((item) => item.id === bill.residentId) : undefined;

    if (!bill || amount <= 0) {
      setPaymentMessage("Select a bill and enter a payment amount.");
      setSavingPayment(false);
      return;
    }

    try {
      const isLocalBill = state.bills.some((item) => item.id === bill.id);
      if (accounting?.bills.some((item) => item.id === bill.id) && !isLocalBill) {
        const response = await fetch("/api/appwrite/admin/accounting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billId: bill.id, amount, reference, channel, date })
        });
        const payload = await response.json().catch(() => null) as {
          allocation?: PaymentAllocationResult;
          error?: string;
        } | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to record Appwrite payment.");
        }
        if (payload?.allocation && resident) {
          setPaymentConfirmation({
            residentName: resident.name,
            unitLabel: residentUnitLabel(accountingState, resident),
            amount,
            channel,
            monthlyRate: resident.expectedMonthly ?? 0,
            allocation: payload.allocation
          });
        }
        await refreshAccounting({ bypassCache: true });
      } else {
        addPayment({
          billId: bill.id,
          amount,
          reference,
          channel,
          processor: "manual",
          source: "admin",
          date
        });
      }

      setPaymentMessage(`Payment ${reference} has been recorded and the reports have been updated.`);
      setPaymentAmount("");
      event.currentTarget.reset();
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : "Payment could not be recorded.");
    } finally {
      setSavingPayment(false);
    }
  }

  return (
    <>
      <PageHeader title="Payments" description="Online payments confirm automatically through processor webhooks. Manual bank transfers, cash, POS, and WhatsApp receipts stay available as admin-reviewed fallback.">
        <Button type="button" variant="secondary" onClick={() => void refreshAccounting({ bypassCache: true })} disabled={loadingAccounting || loadingAccountingDetails}>
          <RefreshCw className="h-4 w-4" />
          {loadingAccounting || loadingAccountingDetails ? "Refreshing" : "Refresh accounting"}
        </Button>
      </PageHeader>
      <p className="mb-4 rounded-lg border border-line bg-ink/50 px-3 py-2 text-sm text-slate-300">{accountingStatus}</p>
      {paymentMessage ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{paymentMessage}</p> : null}
      {paymentConfirmation ? <PaymentConfirmationCard confirmation={paymentConfirmation} /> : null}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 xl:gap-4">
        <StatCard label="Expected revenue" value={money(expected)} helper="All issued bills" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Confirmed paid" value={money(confirmed)} helper="Webhook and admin confirmed" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Outstanding" value={money(outstanding)} helper="Balance still owed" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Credit balance" value={money(credit)} helper="Advance payments held" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Net receivable" value={money(netReceivable)} helper="Outstanding after credits" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Pending review" value={money(pendingReview)} helper="Manual proofs awaiting admin" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Debtors" value={String(debtors)} helper="Bills with balance" icon={<Users className="h-5 w-5" />} />
      </div>
      <Card className="mb-6">
        <CardHeader title="Record resident payment" description="Use this for bank transfers, POS, cash, WhatsApp receipts, and other manual updates before automatic payment processing goes live." />
        <form onSubmit={submitAdminPayment}>
          <div className="grid gap-4 md:grid-cols-6">
            <Field label="Resident bill">
              <Select name="billId" value={selectedBillId} onChange={(event) => setSelectedBillId(event.target.value)} required>
                {payableBills.length ? payableBills.map((bill) => {
                  const resident = accountingState.residents.find((item) => item.id === bill.residentId);
                  return (
                    <option key={bill.id} value={bill.id}>
                      {resident?.name ?? "Unknown"} - {resident ? residentUnitLabel(accountingState, resident) : bill.unitId ?? "Unit"} - {money(billOutstandingAmount(accountingState, bill))}
                    </option>
                  );
                }) : <option value="">No outstanding bills</option>}
              </Select>
            </Field>
            <Field label="Amount">
              <Input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="50000"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                required
              />
            </Field>
            <Field label="Reference"><Input name="reference" placeholder={`ADMIN-${Date.now()}`} required /></Field>
            <Field label="Channel">
              <Select name="channel" value={paymentChannel} onChange={(event) => setPaymentChannel(event.target.value as NonNullable<Payment["channel"]>)}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="pos">POS</option>
                <option value="cash">Cash</option>
                <option value="whatsapp_receipt">WhatsApp receipt</option>
              </Select>
            </Field>
            <Field label="Payment date"><Input name="date" type="date" defaultValue={dateInputValue()} /></Field>
            <div className="flex items-end">
              <Button className="w-full" disabled={savingPayment || !payableBills.length}>
                <WalletCards className="h-4 w-4" />
                {savingPayment ? "Saving" : "Record"}
              </Button>
            </div>
          </div>
          {paymentPreview ? <PaymentPreviewIndicator preview={paymentPreview} /> : null}
        </form>
      </Card>
      <DataTable
        title="Payment queue"
        headers={["Reference", "Resident / unit", "Bill", "Amount", "Channel", "Status", "Action"]}
        rows={accountingState.payments.map((payment) => {
          const resident = accountingState.residents.find((item) => item.id === payment.residentId);

          return [
          <span key={payment.reference} className="font-mono text-smart">{payment.reference}</span>,
          <div key={`${payment.id}-resident`}>
            <p className="font-medium text-white">{resident?.name ?? "Unknown"}</p>
            <p className="text-xs font-mono text-smart">{resident ? residentUnitLabel(accountingState, resident) : payment.unitId ?? "Unit pending"}</p>
          </div>,
          accountingState.bills.find((bill) => bill.id === payment.billId)?.title ?? "Unknown bill",
          money(payment.amount),
          <div key={`${payment.id}-channel`}>
            <p className="capitalize text-slate-200">{paymentChannelLabel(payment)}</p>
            <p className="text-xs text-slate-500">{payment.processor ?? "manual"} - {payment.date}</p>
          </div>,
          <StatusBadge key={payment.status} status={payment.status} />,
          payment.status === "confirmed" ? (
            <span key="done" className="text-xs text-slate-500">Confirmed</span>
          ) : (
            <Button key="confirm" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => confirmPayment(payment.id)}>
              Confirm
            </Button>
          )
        ];
        })}
      />
      <div className="mt-6">
        <DataTable
          title="Recent audit trail"
          description="Payment and billing changes should always leave a trace of who or what updated the record."
          headers={["Time", "Actor", "Action", "Entity"]}
          rows={accountingState.auditLogs.slice(0, 8).map((log) => [
            formatAuditTime(log.createdAt),
            log.actor,
            log.action,
            `${log.entityType}: ${log.entityId}`
          ])}
        />
      </div>
    </>
  );
}

export function ComplaintsAdminPage() {
  const [filters, setFilters] = useState<ComplaintFilters>({
    status: "",
    priority: "",
    category: "",
    search: ""
  });
  const {
    complaints,
    loadingComplaints,
    complaintError,
    refreshComplaints
  } = useAdminComplaints(filters);
  const [selectedComplaint, setSelectedComplaint] = useState<AppwriteComplaint | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [complaintMessage, setComplaintMessage] = useState("");
  const openCount = complaints.filter((complaint) => complaint.status === "open").length;

  async function patchComplaint(complaint: AppwriteComplaint, updates: Partial<AppwriteComplaint>) {
    setComplaintMessage("");

    try {
      const response = await fetch(`/api/appwrite/admin/complaints/${encodeURIComponent(complaint.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const payload = await response.json().catch(() => null) as ComplaintApiResponse | null;
      if (!response.ok || !payload?.complaint) {
        throw new Error(payload?.error ?? "Unable to update complaint.");
      }

      setSelectedComplaint(payload.complaint);
      setAdminResponse(payload.complaint.adminResponse ?? "");
      setComplaintMessage("Complaint updated.");
      await refreshComplaints();
    } catch (error) {
      setComplaintMessage(error instanceof Error ? error.message : "Unable to update complaint.");
    }
  }

  function selectComplaint(complaint: AppwriteComplaint) {
    setSelectedComplaint(complaint);
    setAdminResponse(complaint.adminResponse ?? "");
  }

  async function submitAdminResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedComplaint) {
      return;
    }

    await patchComplaint(selectedComplaint, { adminResponse });
  }

  return (
    <>
      <PageHeader title="Complaints" description={`${openCount} open complaints. Assign maintenance requests, update status, track priority, and keep resident history in one place.`} />
      <Card className="mb-6">
        <CardHeader title="Complaint filters" description="Filter complaint records from Appwrite." />
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Search">
            <Input
              value={filters.search}
              placeholder="Resident or subject"
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </Field>
          <Field label="Status">
            <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">all statuses</option>
              <option value="open">open</option>
              <option value="in_progress">in progress</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
              <option value="">all priorities</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}>
              <option value="">all categories</option>
              <option value="security">security</option><option value="power">power</option><option value="water">water</option><option value="waste">waste</option><option value="noise">noise</option><option value="road">road</option><option value="facility">facility</option><option value="other">other</option>
            </Select>
          </Field>
        </div>
      </Card>
      {loadingComplaints ? <Card className="mb-6"><p className="text-sm text-slate-400">Loading complaints...</p></Card> : null}
      {complaintError ? <Card className="mb-6"><p className="text-sm text-danger">Unable to load complaints. Please refresh the page.</p></Card> : null}
      {!loadingComplaints && !complaintError && !complaints.length ? <Card className="mb-6"><p className="text-sm text-slate-400">No complaints matching your filters.</p></Card> : null}
      <DataTable
        title="Maintenance and complaint queue"
        headers={["Ticket", "Category", "Priority", "Assigned to", "Created", "Status", "Action"]}
        rows={complaints.map((complaint) => [
          <button key={complaint.id} type="button" className="text-left" onClick={() => selectComplaint(complaint)}>
            <p className="font-medium text-white">{complaint.subject}</p>
            <p className="text-xs text-slate-500">{complaint.residentName} - {complaint.id.toUpperCase()}</p>
          </button>,
          complaint.category,
          <StatusBadge key={complaint.priority} status={complaint.priority} />,
          complaint.assignedToName ?? complaint.assignedTo ?? "Unassigned",
          formatComplaintDate(complaint.createdAt),
          <StatusBadge key={complaint.status} status={complaintStatusLabel(complaint.status)} />,
          <Button key={`${complaint.id}-view`} type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => selectComplaint(complaint)}>View</Button>
        ])}
      />
      {selectedComplaint ? (
        <Card className="mt-6">
          <CardHeader title={selectedComplaint.subject} description={`${selectedComplaint.residentName} - ${selectedComplaint.unitCode || "No unit recorded"}`} />
          <div className="grid gap-4 text-sm text-slate-300">
            <p>{selectedComplaint.description}</p>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status">
                <Select
                  value={selectedComplaint.status}
                  onChange={(event) => void patchComplaint(selectedComplaint, { status: event.target.value as AppwriteComplaint["status"] })}
                >
                  <option value="open">open</option>
                  <option value="in_progress">in progress</option>
                  <option value="resolved">resolved</option>
                  <option value="closed">closed</option>
                </Select>
              </Field>
              <Field label="Priority">
                <Select
                  value={selectedComplaint.priority}
                  onChange={(event) => void patchComplaint(selectedComplaint, { priority: event.target.value as AppwriteComplaint["priority"] })}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </Select>
              </Field>
              <Field label="Assigned to">
                <Input
                  value={selectedComplaint.assignedToName ?? ""}
                  onChange={(event) => setSelectedComplaint((current) => current ? { ...current, assignedToName: event.target.value } : current)}
                  onBlur={(event) => void patchComplaint(selectedComplaint, { assignedToName: event.target.value })}
                />
              </Field>
            </div>
            <form className="grid gap-3" onSubmit={submitAdminResponse}>
              <Field label="Admin response">
                <Textarea value={adminResponse} onChange={(event) => setAdminResponse(event.target.value)} placeholder="Write response to the resident" />
              </Field>
              {complaintMessage ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{complaintMessage}</p> : null}
              <Button className="w-fit">Save response</Button>
            </form>
          </div>
        </Card>
      ) : null}
    </>
  );
}

export function AnnouncementsAdminPage() {
  const {
    announcements,
    loadingAnnouncements,
    announcementError,
    refreshAnnouncements
  } = useLiveAnnouncements("admin");
  const [message, setMessage] = useState("");
  const [editingAnnouncement, setEditingAnnouncement] = useState<AppwriteAnnouncement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    message: "",
    targetRole: "all" as AppwriteAnnouncement["targetRole"],
    priority: "normal" as AppwriteAnnouncement["priority"],
    status: "published" as AppwriteAnnouncement["status"],
    expiresAt: "",
    isPinned: false
  });

  async function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const endpoint = editingAnnouncement
      ? `/api/appwrite/admin/announcements/${encodeURIComponent(editingAnnouncement.id)}`
      : "/api/appwrite/admin/announcements";
    const method = editingAnnouncement ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announcementForm)
      });
      const payload = await response.json().catch(() => null) as AnnouncementApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to save announcement.");
      }

      setMessage(editingAnnouncement
        ? "Announcement updated."
        : "Announcement published to Appwrite.");
      setEditingAnnouncement(null);
      setAnnouncementForm(emptyAnnouncementForm());
      await refreshAnnouncements({ force: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save announcement.");
    }
  }

  function editAnnouncement(announcement: AppwriteAnnouncement) {
    setEditingAnnouncement(announcement);
    setAnnouncementForm({
      title: announcement.title,
      message: announcement.message,
      targetRole: announcement.targetRole,
      priority: announcement.priority,
      status: announcement.status,
      expiresAt: announcement.expiresAt ? announcement.expiresAt.slice(0, 10) : "",
      isPinned: announcement.isPinned
    });
    scrollToSection("publish-announcement");
  }

  async function archiveExistingAnnouncement(announcement: AppwriteAnnouncement) {
    setMessage("");

    try {
      const response = await fetch(`/api/appwrite/admin/announcements/${encodeURIComponent(announcement.id)}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => null) as AnnouncementApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "Unable to archive announcement.");
      }

      setMessage("Announcement archived.");
      await refreshAnnouncements({ force: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive announcement.");
    }
  }

  return (
    <>
      <PageHeader title="Announcements" description="Publish estate-wide or targeted communication for residents, owners, tenants, security, and vendors.">
        <Button type="button" onClick={() => scrollToSection("publish-announcement")}><Megaphone className="h-4 w-4" />Create announcement</Button>
      </PageHeader>
      <Card id="publish-announcement" className="scroll-mt-24">
        <CardHeader title="Publish update" description="Prepared for future email, SMS, and push notification delivery." />
        <form className="grid gap-4" onSubmit={publishAnnouncement}>
          <Field label="Title">
            <Input
              name="title"
              placeholder="Power maintenance window"
              required
              value={announcementForm.title}
              onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          <Field label="Message">
            <Textarea
              name="message"
              placeholder="Write announcement message"
              required
              value={announcementForm.message}
              onChange={(event) => setAnnouncementForm((current) => ({ ...current, message: event.target.value }))}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Target audience">
              <Select
                name="targetRole"
                value={announcementForm.targetRole}
                onChange={(event) => setAnnouncementForm((current) => ({
                  ...current,
                  targetRole: event.target.value as AppwriteAnnouncement["targetRole"]
                }))}
              >
                <option value="all">all residents</option>
                <option value="resident">residents</option>
                <option value="security">security</option>
                <option value="cso">cso</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                name="priority"
                value={announcementForm.priority}
                onChange={(event) => setAnnouncementForm((current) => ({
                  ...current,
                  priority: event.target.value as AppwriteAnnouncement["priority"]
                }))}
              >
                <option>low</option>
                <option>normal</option>
                <option>high</option>
                <option>urgent</option>
              </Select>
            </Field>
            <Field label="Publish date">
              <Select
                name="status"
                value={announcementForm.status}
                onChange={(event) => setAnnouncementForm((current) => ({
                  ...current,
                  status: event.target.value as AppwriteAnnouncement["status"]
                }))}
              >
                <option value="published">publish now</option>
                <option value="draft">save draft</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
          </div>
          {message ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button className="w-fit">{editingAnnouncement ? "Update announcement" : "Publish announcement"}</Button>
            {editingAnnouncement ? (
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                onClick={() => {
                  setEditingAnnouncement(null);
                  setAnnouncementForm(emptyAnnouncementForm());
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {loadingAnnouncements ? (
          <Card><p className="text-sm text-slate-400">Loading announcements...</p></Card>
        ) : null}
        {announcementError ? (
          <Card><p className="text-sm text-danger">Unable to load announcements. Please refresh the page.</p></Card>
        ) : null}
        {!loadingAnnouncements && !announcementError && !announcements.length ? (
          <Card><p className="text-sm text-slate-400">No announcements yet. Create one above.</p></Card>
        ) : null}
        {announcements.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <Megaphone className="h-5 w-5 text-smart" />
              <StatusBadge status={item.priority} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.message}</p>
            <p className="mt-4 text-xs text-slate-500">{announcementTargetLabel(item.targetRole)} - {formatAnnouncementDate(item.publishedAt ?? item.createdAt)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => editAnnouncement(item)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              {item.status !== "archived" ? (
                <Button type="button" variant="danger" className="min-h-9 px-3 py-1 text-xs" onClick={() => void archiveExistingAnnouncement(item)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Archive
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

export function DigitalIdsAdminPage() {
  const { state } = useLocalEstateStore();

  return (
    <>
      <PageHeader title="Digital IDs" description="Issue and verify resident, domestic staff, vendor, and security IDs with QR-ready status checks." />
      <div className="grid gap-5 lg:grid-cols-3">
        {state.residents.slice(0, 3).map((resident) => (
          <DigitalIdCard key={resident.id} name={resident.name} role={resident.type} estate="LBS View Estate" house={residentUnitLabel(state, resident)} idNumber={makeDigitalIdNumber(resident)} status={resident.status} />
        ))}
      </div>
    </>
  );
}

export function KnowledgeBaseManagerPage() {
  return <KnowledgeBasePage manager />;
}

export function KnowledgeBaseViewerPage() {
  return <KnowledgeBasePage />;
}

function KnowledgeBasePage({ manager = false }: { manager?: boolean }) {
  const { articles, loadingArticles, articleError, refreshArticles } = useKnowledgeArticles(manager);
  const [message, setMessage] = useState("");
  const [editingArticle, setEditingArticle] = useState<AppwriteKnowledgeBaseArticle | null>(null);
  const [articleForm, setArticleForm] = useState(emptyKnowledgeForm());

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const endpoint = editingArticle
      ? `/api/appwrite/admin/knowledge-base/${encodeURIComponent(editingArticle.id)}`
      : "/api/appwrite/admin/knowledge-base";
    const method = editingArticle ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(articleForm)
      });
      const payload = await response.json().catch(() => null) as KnowledgeApiResponse | null;
      if (!response.ok || !payload?.article) {
        throw new Error(payload?.error ?? "Unable to save article.");
      }

      setMessage(editingArticle ? "Knowledge base article updated." : "Knowledge base article saved.");
      setEditingArticle(null);
      setArticleForm(emptyKnowledgeForm());
      await refreshArticles({ force: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save article.");
    }
  }

  function editArticle(article: AppwriteKnowledgeBaseArticle) {
    setEditingArticle(article);
    setArticleForm({
      title: article.title,
      category: article.category,
      content: article.content,
      targetRole: article.targetRole,
      tags: article.tags ?? "",
      sortOrder: article.sortOrder,
      isPublished: article.isPublished
    });
    scrollToSection("new-article");
  }

  async function togglePublished(article: AppwriteKnowledgeBaseArticle) {
    await patchArticle(article, { isPublished: !article.isPublished });
  }

  async function deleteArticle(article: AppwriteKnowledgeBaseArticle) {
    setMessage("");

    try {
      const response = await fetch(`/api/appwrite/admin/knowledge-base/${encodeURIComponent(article.id)}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => null) as KnowledgeApiResponse | null;
      if (!response.ok || !payload?.article) {
        throw new Error(payload?.error ?? "Unable to delete article.");
      }

      setMessage("Knowledge base article unpublished.");
      await refreshArticles({ force: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete article.");
    }
  }

  async function patchArticle(article: AppwriteKnowledgeBaseArticle, update: Partial<AppwriteKnowledgeBaseArticle>) {
    setMessage("");

    try {
      const response = await fetch(`/api/appwrite/admin/knowledge-base/${encodeURIComponent(article.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update)
      });
      const payload = await response.json().catch(() => null) as KnowledgeApiResponse | null;
      if (!response.ok || !payload?.article) {
        throw new Error(payload?.error ?? "Unable to update article.");
      }

      setMessage("Knowledge base article updated.");
      await refreshArticles({ force: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update article.");
    }
  }

  return (
    <>
      <PageHeader
        title="Knowledge Base"
        description="Estate rules, security guidelines, waste disposal notes, payment instructions, and emergency contacts."
      >
        {manager ? (
          <Button type="button" onClick={() => scrollToSection("new-article")}><BookOpen className="h-4 w-4" />New article</Button>
        ) : null}
      </PageHeader>
      {manager ? (
        <Card id="new-article" className="mb-6 scroll-mt-24">
          <CardHeader title="New article" description="Publish estate rules, guides, payment instructions, and emergency contacts." />
          <form className="grid gap-4" onSubmit={saveArticle}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title">
                <Input
                  name="title"
                  placeholder="Estate access rules"
                  required
                  value={articleForm.title}
                  onChange={(event) => setArticleForm((current) => ({ ...current, title: event.target.value }))}
                />
              </Field>
              <Field label="Category">
                <Select
                  name="category"
                  value={articleForm.category}
                  onChange={(event) => setArticleForm((current) => ({
                    ...current,
                    category: event.target.value as AppwriteKnowledgeBaseArticle["category"]
                  }))}
                >
                  <option value="general">general</option>
                  <option value="billing">billing</option>
                  <option value="access">access</option>
                  <option value="security">security</option>
                  <option value="facilities">facilities</option>
                  <option value="rules">rules</option>
                  <option value="emergency">emergency</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Audience">
                <Select
                  name="targetRole"
                  value={articleForm.targetRole}
                  onChange={(event) => setArticleForm((current) => ({
                    ...current,
                    targetRole: event.target.value as AppwriteKnowledgeBaseArticle["targetRole"]
                  }))}
                >
                  <option value="all">all</option>
                  <option value="resident">resident</option>
                  <option value="security">security</option>
                  <option value="cso">cso</option>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  name="isPublished"
                  value={articleForm.isPublished ? "true" : "false"}
                  onChange={(event) => setArticleForm((current) => ({ ...current, isPublished: event.target.value === "true" }))}
                >
                  <option value="true">published</option>
                  <option value="false">draft</option>
                </Select>
              </Field>
              <Field label="Sort order">
                <Input
                  name="sortOrder"
                  type="number"
                  value={articleForm.sortOrder}
                  onChange={(event) => setArticleForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                />
              </Field>
            </div>
            <Field label="Summary">
              <Textarea
                name="summary"
                placeholder="Write the article summary or instruction."
                required
                value={articleForm.content}
                onChange={(event) => setArticleForm((current) => ({ ...current, content: event.target.value }))}
              />
            </Field>
            <Field label="Tags">
              <Input
                name="tags"
                placeholder="billing, access, rules"
                value={articleForm.tags}
                onChange={(event) => setArticleForm((current) => ({ ...current, tags: event.target.value }))}
              />
            </Field>
            {message ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button className="w-fit">{editingArticle ? "Update article" : "Save article"}</Button>
              {editingArticle ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-fit"
                  onClick={() => {
                    setEditingArticle(null);
                    setArticleForm(emptyKnowledgeForm());
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadingArticles ? <Card><p className="text-sm text-slate-400">Loading knowledge base articles...</p></Card> : null}
        {articleError ? <Card><p className="text-sm text-danger">Unable to load knowledge base articles. Please refresh the page.</p></Card> : null}
        {!loadingArticles && !articleError && !articles.length ? (
          <Card><p className="text-sm text-slate-400">{manager ? "No articles yet. Create one above." : "No knowledge base articles available yet."}</p></Card>
        ) : null}
        {articles.map((article) => (
          <Card key={article.id}>
            <BookOpen className="h-5 w-5 text-smart" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{article.category}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{article.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{article.content}</p>
            <p className="mt-4 text-xs text-slate-500">Updated {formatKnowledgeDate(article.updatedAt)} - {article.viewCount} views</p>
            {manager ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => editArticle(article)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => void togglePublished(article)}>
                  {article.isPublished ? "Unpublish" : "Publish"}
                </Button>
                <Button type="button" variant="danger" className="min-h-9 px-3 py-1 text-xs" onClick={() => void deleteArticle(article)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}

type PaymentPreview = {
  tone: "green" | "amber" | "blue";
  title: string;
  message: string;
};

function buildPaymentPreview(amount: number, outstandingBalance: number, expectedMonthly: number): PaymentPreview | null {
  if (amount <= 0) {
    return null;
  }

  if (outstandingBalance <= 0) {
    const months = expectedMonthly > 0 ? Math.floor(amount / expectedMonthly) : 0;
    return {
      tone: "blue",
      title: "Advance payment",
      message: `Advance payment - covers ${months} month${months === 1 ? "" : "s"} from next due date.`
    };
  }

  if (amount < outstandingBalance) {
    return {
      tone: "amber",
      title: "Partial payment",
      message: `Partial payment - ${money(outstandingBalance - amount)} will remain outstanding after this payment.`
    };
  }

  if (amount === outstandingBalance) {
    return {
      tone: "green",
      title: "Full settlement",
      message: "Full settlement - account will be cleared."
    };
  }

  const credit = amount - outstandingBalance;
  const months = expectedMonthly > 0 ? Math.floor(credit / expectedMonthly) : 0;
  return {
    tone: "blue",
    title: "Overpayment",
    message: `Overpayment - ${money(credit)} advance credit will be generated, covering ${months} additional month${months === 1 ? "" : "s"}.`
  };
}

function PaymentPreviewIndicator({ preview }: { preview: PaymentPreview }) {
  const className = preview.tone === "green"
    ? "border-smart/30 bg-smart/10 text-smart"
    : preview.tone === "amber"
      ? "border-warn/40 bg-warn/10 text-warn"
      : "border-sky-400/40 bg-sky-500/10 text-sky-200";

  return (
    <div className={`mt-4 rounded-lg border px-3 py-3 text-sm ${className}`}>
      <p className="font-semibold">{preview.title}</p>
      <p className="mt-1">{preview.message}</p>
    </div>
  );
}

function PaymentConfirmationCard({ confirmation }: { confirmation: AdminPaymentConfirmation }) {
  const summary = confirmation.allocation.residentSummary;

  return (
    <Card className="mb-4 border-smart/30 bg-smart/10">
      <p className="text-sm font-semibold text-smart">
        Payment recorded for {confirmation.residentName} - {confirmation.unitLabel}
      </p>
      <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2 xl:grid-cols-5">
        <p>Amount: <span className="font-semibold text-white">{money(confirmation.amount)}</span></p>
        <p>Channel: <span className="font-semibold text-white">{paymentChannelText(confirmation.channel)}</span></p>
        <p>Account status: <span className="font-semibold text-white">{allocationStatusText(summary.accountStatus)}</span></p>
        <p>Coverage through: <span className="font-semibold text-white">{formatPaymentDate(summary.coverageThroughDate)}</span></p>
        <p>Next due: <span className="font-semibold text-white">{formatPaymentDate(summary.nextDueDate)} - {money(confirmation.monthlyRate)}</span></p>
      </div>
      {!confirmation.allocation.success ? (
        <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          Payment was recorded, but reconciliation needs admin review: {confirmation.allocation.errorMessage}
        </p>
      ) : null}
    </Card>
  );
}

function allocationStatusText(value: PaymentAllocationSummary["accountStatus"]) {
  if (value === "in_credit") return "In credit";
  if (value === "fully_paid") return "Fully paid";
  if (value === "partially_paid") return "Partially paid";
  return "Unpaid";
}

function paymentChannelText(value: string) {
  return value.replace(/_/g, " ");
}

function formatPaymentDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

export function ReportsPage() {
  const { state } = useLocalEstateStore();
  const { accountingState, summary, accountingStatus, loadingAccounting, loadingAccountingDetails, refreshAccounting, lastUpdated } = useAdminAccountingState(state);
  const [forcedAgingBucket, setForcedAgingBucket] = useState<AgingBucket | null>(null);
  const sectionLoading = useProgressiveReportSections(loadingAccounting || loadingAccountingDetails);
  const expectedRevenue = summary?.expectedRevenue ?? accountingState.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const confirmedPayments = accountingState.payments.filter((payment) => payment.status === "confirmed");
  const paidAmount = summary?.paidAmount ?? confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingBalance = summary?.outstandingBalance ?? accountingState.bills.reduce((sum, bill) => sum + billOutstandingAmount(accountingState, bill), 0);
  const creditBalance = summary?.creditBalance ?? accountingState.bills.reduce((sum, bill) => sum + billCreditAmount(accountingState, bill), 0);
  const netReceivable = summary?.netReceivable ?? Math.max(0, outstandingBalance - creditBalance);
  const residentBalances = accountingState.residents.map((resident) => ({
    resident,
    balance: residentBillingBalance(accountingState, resident.id)
  }));
  const debtorResidents = residentBalances.filter(({ balance }) => balance.netReceivable > 0);
  const creditResidents = residentBalances.filter(({ balance }) => balance.availableCredit > 0);
  const reportDataset = useMemo<ReportDataset>(() => ({
    residents: accountingState.residents,
    bills: accountingState.bills,
    payments: accountingState.payments,
    properties: accountingState.properties,
    units: accountingState.units
  }), [accountingState.bills, accountingState.payments, accountingState.properties, accountingState.residents, accountingState.units]);
  const financialProfiles = useMemo(() => buildResidentFinancialProfiles(reportDataset), [reportDataset]);
  const agedDebtors = useMemo(() => buildDebtorAccounts(financialProfiles), [financialProfiles]);
  const criticalDebtorsCount = agedDebtors.filter((debtor) => debtor.monthsOverdue >= 24).length;
  const collectionRate = percent(paidAmount, expectedRevenue);
  const channelTotals = summary?.channelTotals ?? confirmedPayments.reduce<Record<string, number>>((totals, payment) => {
    const channel = paymentChannelLabel(payment);
    totals[channel] = (totals[channel] ?? 0) + payment.amount;
    return totals;
  }, {});
  const paymentStatusTotals = summary?.paymentStatusTotals ?? accountingState.payments.reduce<Record<string, { count: number; amount: number }>>((totals, payment) => {
    const confirmation = payment.status === "confirmed"
      ? "Confirmed"
      : payment.status === "pending"
        ? "Unconfirmed"
        : "Rejected";
    const method = isResidentOnlinePaymentChannel(payment.channel) ? "online" : "manual";
    const key = `${confirmation} ${method}`;

    totals[key] = {
      count: (totals[key]?.count ?? 0) + 1,
      amount: (totals[key]?.amount ?? 0) + payment.amount
    };

    return totals;
  }, {});
  const categoryTotals = summary?.categoryTotals ?? accountingState.bills.reduce<Record<string, number>>((totals, bill) => {
    const category = bill.category ?? "Service charge";
    totals[category] = (totals[category] ?? 0) + bill.amount;
    return totals;
  }, {});

  return (
    <>
      {criticalDebtorsCount > 0 ? (
        <div className="mb-5 rounded-lg border border-danger/50 bg-danger/15 p-4 text-sm text-red-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <p>
                <span className="font-semibold">{criticalDebtorsCount} residents</span> have outstanding balances exceeding 24 months. Immediate action recommended.
              </p>
            </div>
            <button
              type="button"
              className="text-left text-sm font-semibold text-red-50 underline underline-offset-4"
              onClick={() => {
                setForcedAgingBucket("severe");
                scrollToSection("debtors-aging");
              }}
            >
              View critical accounts -&gt;
            </button>
          </div>
        </div>
      ) : null}
      <PageHeader title="Reports" description="Accounting and operations analytics for expected revenue, confirmed payments, outstanding balances, credit balances, debtors, channels, categories, and audit trail.">
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-xs text-slate-400">Last updated {lastUpdatedLabel(lastUpdated)}</p>
          <div className="flex flex-wrap gap-2">
            <ReportsExportToolbar
              profiles={financialProfiles}
              payments={accountingState.payments}
              expectedRevenue={expectedRevenue}
              paidAmount={paidAmount}
              outstandingBalance={outstandingBalance}
              creditBalance={creditBalance}
            />
            <Button type="button" variant="secondary" onClick={() => void refreshAccounting({ bypassCache: true })} disabled={loadingAccounting || loadingAccountingDetails}>
              <RefreshCw className="h-4 w-4" />
              {loadingAccounting || loadingAccountingDetails ? "Refreshing" : "Refresh reports"}
            </Button>
          </div>
        </div>
      </PageHeader>
      <p className="mb-4 rounded-lg border border-line bg-ink/50 px-3 py-2 text-sm text-slate-300">{accountingStatus}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 xl:gap-4">
        <StatCard label="Expected revenue" value={money(expectedRevenue)} helper="All bills issued" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Paid amount" value={money(paidAmount)} helper="Confirmed payments" icon={<WalletCards className="h-5 w-5" />} />
        <ClickableReportCard onClick={() => scrollToSection("debtors-aging")}>
          <StatCard label="Outstanding" value={money(outstandingBalance)} helper="Open balance" icon={<Landmark className="h-5 w-5" />} />
        </ClickableReportCard>
        <StatCard label="Credit balance" value={money(creditBalance)} helper="Advance payments" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Net receivable" value={money(netReceivable)} helper="Outstanding after credits" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="In credit" value={String(summary?.residentsInCredit ?? creditResidents.length)} helper="Advance payment residents" icon={<BadgeCheck className="h-5 w-5" />} />
        <ClickableReportCard onClick={() => scrollToSection("debtors-aging")}>
          <StatCard label="Debtors" value={String(summary?.debtorsCount ?? debtorResidents.length)} helper="Residents with net balance" icon={<Users className="h-5 w-5" />} />
        </ClickableReportCard>
        <CollectionRateCard rate={collectionRate} onClick={() => scrollToSection("property-group-breakdown")} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Debtors"
          headers={["Resident", "Unit", "Outstanding", "Credit", "Net due"]}
          rows={debtorResidents.map(({ resident, balance }) => [
            resident.name,
            residentUnitLabel(accountingState, resident),
            money(balance.outstandingBalance),
            money(balance.creditBalance),
            money(balance.netReceivable)
          ])}
        />
        <DataTable
          title="Residents in credit"
          description="Advance payments available to offset the next subscription bill."
          headers={["Resident", "Unit", "Paid", "Expected", "Credit"]}
          rows={creditResidents.map(({ resident, balance }) => [
            resident.name,
            residentUnitLabel(accountingState, resident),
            money(balance.paidAmount),
            money(balance.expectedAmount),
            money(balance.availableCredit)
          ])}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Payment channels"
          description="Confirmed revenue by processor and payment route."
          headers={["Channel", "Amount"]}
          rows={Object.entries(channelTotals).map(([channel, amount]) => [
            channel,
            money(amount)
          ])}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Bill categories"
          headers={["Category", "Expected amount"]}
          rows={Object.entries(categoryTotals).map(([category, amount]) => [
            category,
            money(amount)
          ])}
        />
        <DataTable
          title="Payment statuses"
          headers={["Status", "Count", "Amount"]}
          rows={Object.entries(paymentStatusTotals).map(([status, summary]) => [
            status,
            String(summary.count),
            money(summary.amount)
          ])}
        />
      </div>
      <div className="mt-6">
        <DataTable
          title="Audit trail"
          headers={["Time", "Actor", "Action", "Entity"]}
          rows={accountingState.auditLogs.slice(0, 8).map((log) => [
            formatAuditTime(log.createdAt),
            log.actor,
            log.action,
            `${log.entityType}: ${log.entityId}`
          ])}
        />
      </div>
      <PropertyGroupBreakdown profiles={financialProfiles} loading={sectionLoading.propertyGroups} />
      <RateBreakdown profiles={financialProfiles} expectedRevenue={expectedRevenue} outstanding={outstandingBalance} loading={sectionLoading.rateBreakdown} />
      <MonthlyTrendChart dataset={reportDataset} profiles={financialProfiles} loading={sectionLoading.monthlyTrend} />
      <DebtorsAging
        profiles={financialProfiles}
        forcedBucket={forcedAgingBucket}
        onClearForcedBucket={() => setForcedAgingBucket(null)}
        loading={sectionLoading.debtorsAging}
      />
    </>
  );
}

function CollectionRateCard({ rate, onClick }: { rate: number; onClick: () => void }) {
  const tone = rate >= 80 ? "text-smart" : rate >= 60 ? "text-warn" : "text-danger";
  const stroke = rate >= 80 ? "#c0ff6b" : rate >= 60 ? "#f59e0b" : "#ff3b30";
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (Math.min(100, Math.max(0, rate)) / 100) * circumference;

  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="h-full p-4 transition hover:border-smart/50 hover:bg-white/[0.12]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-300">Collection Rate</p>
            <p className={`mt-1 text-2xl font-semibold ${tone}`}>{rate.toFixed(1)}%</p>
          </div>
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
            <circle
              cx="36"
              cy="36"
              r="28"
              fill="none"
              stroke={stroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 36 36)"
            />
            <text x="36" y="40" textAnchor="middle" className="fill-white text-[13px] font-semibold">{Math.round(rate)}%</text>
          </svg>
        </div>
        <p className="mt-4 text-xs text-slate-400">{rate.toFixed(1)}% of expected revenue collected</p>
      </Card>
    </button>
  );
}

function ClickableReportCard({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-lg transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-smart/60"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
}

function useProgressiveReportSections(refreshing: boolean) {
  const [ready, setReady] = useState({
    propertyGroups: false,
    rateBreakdown: false,
    monthlyTrend: false,
    debtorsAging: false
  });

  useEffect(() => {
    if (!refreshing) {
      setReady({
        propertyGroups: true,
        rateBreakdown: true,
        monthlyTrend: true,
        debtorsAging: true
      });
      return undefined;
    }

    setReady({
      propertyGroups: false,
      rateBreakdown: false,
      monthlyTrend: false,
      debtorsAging: false
    });
    const timers = [
      window.setTimeout(() => setReady((current) => ({ ...current, propertyGroups: true })), 120),
      window.setTimeout(() => setReady((current) => ({ ...current, rateBreakdown: true })), 240),
      window.setTimeout(() => setReady((current) => ({ ...current, monthlyTrend: true })), 360),
      window.setTimeout(() => setReady((current) => ({ ...current, debtorsAging: true })), 480)
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [refreshing]);

  return {
    propertyGroups: refreshing && !ready.propertyGroups,
    rateBreakdown: refreshing && !ready.rateBreakdown,
    monthlyTrend: refreshing && !ready.monthlyTrend,
    debtorsAging: refreshing && !ready.debtorsAging
  };
}

function lastUpdatedLabel(value: number | null) {
  if (!value) {
    return "not yet";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
  if (minutes < 1) return "just now";
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

export function SettingsPage() {
  const [message, setMessage] = useState("");

  return (
    <>
      <PageHeader title="Settings" description="Control role permissions, gate settings, service categories, integrations, and notification preferences." />
      <Card>
        <CardHeader title="Platform controls" description="Role-based access, payment processors, gate settings, and notification preferences." />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Default resident status">
            <Select defaultValue="active"><option>active</option><option>inactive</option></Select>
          </Field>
          <Field label="Visitor code expiry behavior">
            <Select defaultValue="expire after visit date"><option>expire after visit date</option><option>expire after checkout</option></Select>
          </Field>
          <Field label="Payment gateway planned">
            <Select defaultValue="Paystack">
              <option>Paystack</option>
              <option>Flutterwave</option>
              <option>Monnify</option>
              <option>GTBank Squad</option>
            </Select>
          </Field>
          <Field label="Notification providers planned">
            <Input defaultValue="Email, SMS, Push notifications" />
          </Field>
        </div>
        {message ? <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
        <Button className="mt-5" type="button" onClick={() => setMessage("Settings saved for this session.")}>
          Save settings
        </Button>
      </Card>
    </>
  );
}

export function SuperAdminDashboard() {
  const { state } = useLocalEstateStore();
  const { visitorViews, loadingVisitors } = useLiveVisitorViews(readAppwriteAdminVisitors);

  return (
    <>
      <PageHeader title="Super Admin" description="Control the Corso estate platform, onboard estates, and monitor aggregate activity." >
        <Link href="/super-admin/estates#create-estate">
          <Button><Building2 className="h-4 w-4" />Create estate</Button>
        </Link>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Managed estates" value={String(state.estates.length)} helper="Platform communities" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Platform residents" value={String(state.residents.length)} helper="Seed resident records" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Visitor events" value={loadingVisitors ? "..." : String(visitorViews.length)} helper="Across estates today" icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard label="Open tickets" value={String(state.complaints.filter((item) => item.status !== "resolved").length)} helper="Needs estate admin action" icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="mt-6">
        <EstateDirectoryPage compact />
      </div>
    </>
  );
}

export function EstateDirectoryPage({ compact = false }: { compact?: boolean }) {
  const { state, addEstate } = useLocalEstateStore();

  return (
    <>
      {!compact ? <PageHeader title="Estates" description="Create and manage gated estates on the Corso platform. Click an estate name to open its full profile." /> : null}
      {!compact ? <EstateComposer onCreateEstate={addEstate} /> : null}
      <DataTable
        title="Estate directory"
        description="A simple directory for scanning estates quickly."
        headers={["Estate name", "Location"]}
        rows={state.estates.map((estate) => [
          <Link key={estate.id} href={`/super-admin/estates/${encodeURIComponent(estate.id)}`} className="font-medium text-white hover:text-smart">
            {estate.name}
          </Link>,
          estate.address
        ])}
      />
    </>
  );
}

export function EstateDetailPage({ estateId }: { estateId: string }) {
  const { state, updateResident } = useLocalEstateStore();
  const { visitorViews, loadingVisitors, visitorError } = useLiveVisitorViews(readAppwriteAdminVisitors);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [savingResident, setSavingResident] = useState(false);
  const [residentMessage, setResidentMessage] = useState("");
  const estate = state.estates.find((item) => item.id === estateId);

  async function saveEstateResident(resident: Resident, input: ResidentEditInput) {
    setSavingResident(true);
    setResidentMessage("");

    try {
      const updatedResident = await updateResident(resident.id, input);
      setEditingResident(null);
      setResidentMessage(`${updatedResident.name}'s resident record has been updated.`);
    } catch (error) {
      setResidentMessage(error instanceof Error ? error.message : "Resident details could not be updated.");
    } finally {
      setSavingResident(false);
    }
  }

  if (!estate) {
    return (
      <>
        <PageHeader title="Estate not found" description="This estate may have been removed or is not available in the current workspace.">
          <Link href="/super-admin/estates">
            <Button variant="secondary"><ArrowLeft className="h-4 w-4" />Estate directory</Button>
          </Link>
        </PageHeader>
        <Card>
          <CardHeader title="No estate record" description="Return to the estate directory and select an active estate." />
        </Card>
      </>
    );
  }

  const estateResidents = state.residents.filter((resident) => resident.estateId === estate.id);
  const estateResidentIds = new Set(estateResidents.map((resident) => resident.id));
  const estateVisitors = visitorViews.filter(({ visitor }) => visitor.estateId === estate.id);
  const estateBills = state.bills.filter((bill) => bill.estateId === estate.id);
  const estateComplaints = state.complaints.filter((complaint) => estateResidentIds.has(complaint.residentId));
  const paidBills = estateBills.filter((bill) => bill.status === "paid").length;

  return (
    <>
      <PageHeader title={estate.name} description={estate.address}>
        <Link href="/super-admin/estates">
          <Button variant="secondary"><ArrowLeft className="h-4 w-4" />Estate directory</Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Residents" value={String(estateResidents.length)} helper="Registered records" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Visitors" value={loadingVisitors ? "..." : String(estateVisitors.length)} helper="Invitation records" icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard label="Bills paid" value={`${paidBills}/${estateBills.length}`} helper="Estate bill status" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Open complaints" value={String(estateComplaints.filter((item) => item.status !== "resolved").length)} helper="Needs attention" icon={<ClipboardList className="h-5 w-5" />} />
      </div>

      {residentMessage ? <p className="mt-6 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{residentMessage}</p> : null}
      {editingResident ? (
        <div className="mt-6">
          <ResidentEditCard
            resident={editingResident}
            state={state}
            saving={savingResident}
            onSave={saveEstateResident}
            onCancel={() => setEditingResident(null)}
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Estate information" description="Administrative and gate details for this estate." />
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Estate name</dt>
              <dd className="mt-1 font-medium text-white">{estate.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Location</dt>
              <dd className="mt-1 font-medium text-white">{estate.address}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Security gate</dt>
              <dd className="mt-1 font-medium text-white">{estate.gateName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Contact phone</dt>
              <dd className="mt-1 font-medium text-white">{estate.contactPhone}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Contact email</dt>
              <dd className="mt-1 font-medium text-white">{estate.contactEmail}</dd>
            </div>
          </dl>
        </Card>

        <DataTable
          title="Resident directory"
          description="Super Admin can correct resident details inside this estate."
          headers={["Resident", "Property / Unit", "Type", "Status", "Action"]}
          rows={estateResidents.map((resident) => {
            const unit = getResidentUnit(state, resident);

            return [
            <div key={resident.id}>
              <p className="font-medium text-white">{resident.name}</p>
              <p className="text-xs text-slate-500">{resident.email}</p>
            </div>,
            <div key={`${resident.id}-unit`}>
              <p className="font-mono text-smart">{residentUnitLabel(state, resident)}</p>
              <p className="text-xs text-slate-500">{unit?.apartmentType ?? "Unit pending"}</p>
            </div>,
            resident.type,
            <StatusBadge key={resident.status} status={resident.status} />,
            <Button key={`${resident.id}-edit`} variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => setEditingResident(resident)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          ];
          })}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <LiveVisitorCards
          title="Recent visitors"
          visitorViews={estateVisitors.slice(0, 6)}
          loading={loadingVisitors}
          error={visitorError}
          showResident
        />
        <DataTable
          title="Billing snapshot"
          headers={["Bill", "Amount", "Due", "Status"]}
          rows={estateBills.slice(0, 6).map((bill) => [
            bill.title,
            money(bill.amount),
            bill.dueDate,
            <StatusBadge key={bill.status} status={bill.status} />
          ])}
        />
      </div>
    </>
  );
}

type ManagedAppUser = {
  id: string;
  authUserId: string | null;
  estateId: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  estate: string;
  houseNumber: string;
  active: boolean;
  createdAt: string;
};

type TemporaryCredential = {
  fullName: string;
  role: UserRole;
  loginIdentifier: string;
  password: string;
};

export function UserManagementPage({ scope }: { scope: "admin" | "super-admin" }) {
  const { state, approveAccessRequest, rejectAccessRequest, refreshEstateState } = useLocalEstateStore();
  const [users, setUsers] = useState<ManagedAppUser[]>([]);
  const [role, setRole] = useState<UserRole>(scope === "super-admin" ? "estate_admin" : "resident");
  const [message, setMessage] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");
  const [temporaryCredential, setTemporaryCredential] = useState<TemporaryCredential | null>(null);
  const [setupLink, setSetupLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedAppUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("resident");
  const [emailInvite, setEmailInvite] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const allowedRoles = useMemo<UserRole[]>(
    () => scope === "super-admin"
      ? ["super_admin", "estate_admin", "cso", "security_guard", "resident", "vendor"]
      : ["cso", "security_guard", "resident", "vendor"],
    [scope]
  );
  const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id));
  const allUsersSelected = users.length > 0 && users.every((user) => selectedUserIds.includes(user.id));
  const pendingRequests = state.accessRequests.filter((request) => request.status === "pending");

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    setSelectedUserIds((current) => current.filter((id) => users.some((user) => user.id === id)));
  }, [users]);

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function toggleAllUsers() {
    setSelectedUserIds(allUsersSelected ? [] : users.map((user) => user.id));
  }

  async function patchManagedUser(payload: Record<string, unknown>) {
    const response = await fetch("/api/appwrite/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to update Appwrite user.");
    }

    return data;
  }

  async function deleteManagedUser(profileId: string) {
    const response = await fetch(`/api/appwrite/admin/users?profileId=${encodeURIComponent(profileId)}`, {
      method: "DELETE"
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to delete Appwrite user.");
    }

    return data;
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setMessage("");

    try {
      const response = await fetch("/api/appwrite/admin/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load Appwrite users.");
      }

      setUsers(data.users ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setLoadingUsers(false);
    }
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setLoading(true);
    setMessage("");
    setCreatedPassword("");
    setTemporaryCredential(null);
    setSetupLink("");

    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/appwrite/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          role,
          estateId: String(form.get("estateId") ?? state.estates[0]?.id ?? ""),
          houseNumber: String(form.get("houseNumber") ?? ""),
          password: String(form.get("password") ?? "")
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create Appwrite user.");
      }

      setMessage(data.message);
      setCreatedPassword(data.temporaryPassword);
      setTemporaryCredential({
        fullName: data.user.fullName,
        role,
        loginIdentifier: data.loginIdentifier,
        password: data.temporaryPassword
      });
      formElement.reset();
      setEmailInvite(false);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create user.");
    } finally {
      setLoading(false);
    }
  }

  function beginEdit(user: ManagedAppUser) {
    setEditingUser(user);
    setEditRole(user.role);
    setMessage("");
    setCreatedPassword("");
    setTemporaryCredential(null);
    setSetupLink("");
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) {
      return;
    }

    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    await updateUser({
      profileId: editingUser.id,
      action: "update",
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      role: editRole,
      estateId: String(form.get("estateId") ?? ""),
      houseNumber: String(form.get("houseNumber") ?? ""),
      active: editingUser.active
    });
    setLoading(false);
  }

  async function updateUser(payload: Record<string, unknown>) {
    try {
      const data = await patchManagedUser(payload);

      setMessage(data.message ?? "User updated.");
      setSetupLink(data.setupLink ?? "");
      setCreatedPassword(data.temporaryPassword ?? "");
      setTemporaryCredential(data.temporaryPassword ? {
        fullName: data.user?.fullName ?? "",
        role: data.user?.role ?? "resident",
        loginIdentifier: data.loginIdentifier ?? "",
        password: data.temporaryPassword
      } : null);
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user.");
    }
  }

  async function changeUserStatus(user: ManagedAppUser, action: "suspend" | "reactivate") {
    setMessage("");
    await updateUser({ profileId: user.id, action });
  }

  async function sendSetupEmail(user: ManagedAppUser) {
    setMessage("");
    await updateUser({ profileId: user.id, action: "send_setup_email" });
  }

  async function resetUserPassword(user: ManagedAppUser) {
    const confirmed = window.confirm(`Reset password for ${user.fullName}? A new temporary password will be shown once.`);
    if (!confirmed) {
      return;
    }

    setMessage("");
    await updateUser({ profileId: user.id, action: "reset_password" });
  }

  async function deleteUser(user: ManagedAppUser) {
    const confirmed = window.confirm(`Delete ${user.fullName}? Use this only for test/demo users or mistakes. Real users should usually be suspended.`);
    if (!confirmed) {
      return;
    }

    try {
      const data = await deleteManagedUser(user.id);

      setMessage(data.message ?? "User deleted.");
      setSetupLink("");
      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete user.");
    }
  }

  async function runSelectedPatch(action: "send_setup_email" | "suspend" | "reactivate") {
    if (!selectedUsers.length) {
      return;
    }

    setLoading(true);
    setMessage("");
    setSetupLink("");

    try {
      const results = [];
      for (const user of selectedUsers) {
        results.push(await patchManagedUser({ profileId: user.id, action }));
      }

      setMessage(`${selectedUsers.length} user${selectedUsers.length === 1 ? "" : "s"} updated.`);
      setSetupLink(results.length === 1 ? results[0].setupLink ?? "" : "");
      setEditingUser(null);
      setSelectedUserIds([]);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update selected users.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedUsers() {
    if (!selectedUsers.length) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedUsers.length} selected user${selectedUsers.length === 1 ? "" : "s"}? Real users should usually be suspended.`);
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      for (const user of selectedUsers) {
        await deleteManagedUser(user.id);
      }

      setMessage(`${selectedUsers.length} selected user${selectedUsers.length === 1 ? " has" : "s have"} been deleted.`);
      setSetupLink("");
      setEditingUser(null);
      setSelectedUserIds([]);
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete selected users.");
    } finally {
      setLoading(false);
    }
  }

  async function approvePendingRequest(requestId: string) {
    await approveAccessRequest(requestId);
    await refreshEstateState();
    await loadUsers();
  }

  async function rejectPendingRequest(requestId: string) {
    await rejectAccessRequest(requestId);
    await refreshEstateState();
  }

  async function refreshRequestsAndUsers() {
    await refreshEstateState();
    await loadUsers();
  }

  return (
    <>
      <PageHeader
        title="Users and roles"
        description={scope === "super-admin"
          ? "Create platform, estate admin, CSO, security, resident, and vendor users from Corso."
          : "Create CSO, security, resident, and vendor users for your assigned estate."}
      />
      <AccessRequestsPanel
        requests={pendingRequests}
        onApprove={approvePendingRequest}
        onReject={rejectPendingRequest}
        onRefresh={() => void refreshRequestsAndUsers()}
      />
      <Card className="mb-6">
        <CardHeader title="Create user" description="Estate admins can create CSO, security, resident, and vendor users for their assigned estate, then share the login details privately." />
        <form className="grid gap-4" onSubmit={submitUser}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name"><Input name="fullName" placeholder="Full name" required /></Field>
            <Field label="Phone"><Input name="phone" placeholder="+234 801 000 0000" required /></Field>
            <Field label="Email"><Input name="email" type="email" placeholder="Optional login email, e.g. guard@lbsview.test" /></Field>
            <Field label="Role">
              <Select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                {allowedRoles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </Select>
            </Field>
            {role !== "super_admin" ? (
              <Field label="Estate">
                <Select name="estateId" required>
                  {state.estates.map((estate) => (
                    <option key={estate.id} value={estate.id}>
                      {estate.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {role === "resident" ? (
              <Field label="Property / unit ID">
                <Input name="houseNumber" placeholder="LDI-01-B" required />
              </Field>
            ) : null}
            <Field label="Set login password">
              <Input name="password" placeholder="Type a password or leave blank to auto-generate" minLength={8} />
            </Field>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-line bg-ink/50 p-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={emailInvite}
              onChange={(event) => setEmailInvite(event.target.checked)}
              className="mt-1 h-4 w-4 accent-smart"
            />
            <span>
              Send setup email to this user
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Optional. For test emails like @lbsview.test, keep this off and give the temporary password privately.
              </span>
            </span>
          </label>
          {role === "security_guard" ? (
            <div className="rounded-lg border border-sky/30 bg-sky/10 px-3 py-2 text-sm text-sky">
              Security guards will use the login email or phone and the password you set. If you leave password blank, Corso will generate one.
            </div>
          ) : null}
          {message ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
          {temporaryCredential ? <TemporaryCredentialBox credential={temporaryCredential} /> : createdPassword ? (
            <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              Password: <span className="font-mono font-semibold">{createdPassword}</span>
            </div>
          ) : null}
          {setupLink ? <SetupLinkBox setupLink={setupLink} /> : null}
          <Button disabled={loading} className="w-fit">
            <Users className="h-4 w-4" />
            {loading ? "Creating user" : "Create user"}
          </Button>
        </form>
      </Card>
      {editingUser ? (
        <Card className="mb-6">
          <CardHeader title={`Edit ${editingUser.fullName}`} description="Update profile details, role, estate assignment, or resident house number." />
          <form className="grid gap-4" onSubmit={submitEdit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name"><Input name="fullName" defaultValue={editingUser.fullName} required /></Field>
              <Field label="Login contact"><Input value={contactLabel(editingUser.email, editingUser.phone)} disabled readOnly /></Field>
              <Field label="Phone"><Input name="phone" defaultValue={editingUser.phone} /></Field>
              <Field label="Role">
                <Select value={editRole} onChange={(event) => setEditRole(event.target.value as UserRole)}>
                  {allowedRoles.map((item) => (
                    <option key={item} value={item}>
                      {roleLabels[item]}
                    </option>
                  ))}
                </Select>
              </Field>
              {editRole !== "super_admin" ? (
                <Field label="Estate">
                  <Select name="estateId" defaultValue={editingUser.estateId ?? state.estates[0]?.id} required>
                    {state.estates.map((estate) => (
                      <option key={estate.id} value={estate.id}>
                        {estate.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {editRole === "resident" ? (
                <Field label="Property / unit ID">
                  <Input name="houseNumber" defaultValue={editingUser.houseNumber || "Pending assignment"} required />
                </Field>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button disabled={loading}>{loading ? "Saving" : "Save changes"}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {selectedUsers.length ? (
        <div className="sticky top-20 z-20 mb-4 flex flex-col gap-3 rounded-lg border border-smart/30 bg-panel/95 p-3 shadow-glow backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-white">
            {selectedUsers.length} selected
            <span className="ml-2 text-xs font-normal text-slate-400">Use one action for the selected users.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.length === 1 ? (
              <>
                <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => beginEdit(selectedUsers[0])}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={loading} onClick={() => resetUserPassword(selectedUsers[0])}>
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset password
                </Button>
              </>
            ) : null}
            <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={loading} onClick={() => runSelectedPatch("send_setup_email")}>
              <Mail className="h-3.5 w-3.5" />
              Email setup
            </Button>
            <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={loading} onClick={() => runSelectedPatch("suspend")}>
              <UserX className="h-3.5 w-3.5" />
              Suspend
            </Button>
            <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" disabled={loading} onClick={() => runSelectedPatch("reactivate")}>
              <UserCheck className="h-3.5 w-3.5" />
              Reactivate
            </Button>
            <Button variant="danger" className="min-h-9 px-3 py-1 text-xs" disabled={loading} onClick={deleteSelectedUsers}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button type="button" variant="ghost" className="min-h-9 px-3 py-1 text-xs" onClick={() => setSelectedUserIds([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}
      <DataTable
        title={loadingUsers ? "Loading users" : "Managed users"}
        description="Select one or more users to edit, reset password, suspend, reactivate, or delete test accounts."
        headers={[
          "",
          "Name",
          "Contact",
          "Role",
          "Estate",
          "Status"
        ]}
        rows={users.map((user) => [
          <input
            key={`${user.id}-select`}
            aria-label={`Select ${user.fullName}`}
            type="checkbox"
            checked={selectedUserIds.includes(user.id)}
            onChange={() => toggleUserSelection(user.id)}
            className="h-4 w-4 accent-smart"
          />,
          user.fullName,
          contactLabel(user.email, user.phone),
          roleLabels[user.role],
          user.estate,
          <StatusBadge key={user.id} status={user.active ? "active" : "inactive"} />
        ])}
        action={
          users.length ? (
            <label className="inline-flex items-center gap-2 rounded-lg border border-line bg-ink/60 px-3 py-2 text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={allUsersSelected}
                onChange={toggleAllUsers}
                className="h-4 w-4 accent-smart"
              />
              Select all
            </label>
          ) : null
        }
      />
    </>
  );
}

function localManagedUsersFromState(state: LocalEstateState, allowedRoles: UserRole[]): ManagedAppUser[] {
  return state.approvedUsers
    .filter((user) => allowedRoles.includes(user.role))
    .map((user) => {
      const estate = state.estates.find((item) => item.name === user.estate);
      const resident = user.residentId
        ? state.residents.find((item) => item.id === user.residentId)
        : state.residents.find((item) => item.email.toLowerCase() === user.email.toLowerCase());

      return {
        id: user.id,
        authUserId: null,
        estateId: resident?.estateId ?? estate?.id ?? null,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        estate: user.role === "super_admin" ? "All estates" : user.estate,
        houseNumber: resident?.houseNumber ?? "",
        active: true,
        createdAt: user.approvedAt
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function SetupLinkBox({ setupLink }: { setupLink: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await copyTextToClipboard(setupLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-sky/30 bg-sky/10 p-3 text-sm text-sky">
      <p className="font-medium">Manual setup link</p>
      <p className="mt-1 text-xs leading-5 text-slate-300">
        Use this if the email does not arrive. Send it privately to the user.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={setupLink} readOnly className="font-mono text-xs" />
        <Button type="button" variant="secondary" onClick={copyLink}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}

function TemporaryCredentialBox({ credential }: { credential: TemporaryCredential }) {
  const [copied, setCopied] = useState(false);
  const [appUrl, setAppUrl] = useState("/login");
  const message = [
    "Corso login details",
    `Name: ${credential.fullName}`,
    `Role: ${roleLabels[credential.role]}`,
    `Login: ${credential.loginIdentifier}`,
    `Password: ${credential.password}`,
    `Sign in: ${appUrl}`
  ].join("\n");
  const encodedMessage = encodeURIComponent(message);

  useEffect(() => {
    setAppUrl(`${window.location.origin}/login`);
  }, []);

  async function copyDetails() {
    await copyTextToClipboard(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-gold">
      <p className="font-semibold text-white">Login details</p>
      <div className="mt-2 grid gap-2 text-slate-200 sm:grid-cols-2">
        <p>
          <span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Login username</span>
          <span className="font-mono font-semibold text-gold">{credential.loginIdentifier}</span>
        </p>
        <p>
          <span className="block text-xs uppercase tracking-[0.14em] text-slate-500">Password</span>
          <span className="font-mono font-semibold text-gold">{credential.password}</span>
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={copyDetails}>
          {copied ? "Copied" : "Copy details"}
        </Button>
        <a href={`https://wa.me/?text=${encodedMessage}`} target="_blank" rel="noreferrer">
          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </Button>
        </a>
        <a href={`sms:?&body=${encodedMessage}`}>
          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs">
            SMS
          </Button>
        </a>
      </div>
    </div>
  );
}

export function ResidentDashboard() {
  const { state } = useLocalEstateStore();
  const { residentState, accounting, accountingError, loadingAccounting, refreshAccounting } = useResidentAccountingState(state);
  const { visitorViews, loadingVisitors, visitorError } = useLiveVisitorViews(readAppwriteResidentVisitors);
  const [onlinePaymentLoading, setOnlinePaymentLoading] = useState(false);
  const [onlinePaymentMessage, setOnlinePaymentMessage] = useState("");
  const resident = useCurrentResidentProfile(residentState);
  const summary = accounting?.summary ?? null;
  const liveBills = accounting?.bills ?? [];
  const livePayments = accounting?.payments ?? [];
  const expectedVisitorCount = visitorViews.filter(({ visitor }) => isExpectedResidentVisitor(visitor)).length;
  const showSkeleton = loadingAccounting && !summary && !accountingError;
  const firstName = resident.name.split(" ")[0] || "Resident";
  const mobileStatusText = summary?.outstandingBalance
    ? `${money(summary.outstandingBalance)} Owed`
    : "Paid ✓";

  async function startOutstandingPayment() {
    setOnlinePaymentLoading(true);
    setOnlinePaymentMessage("");

    try {
      await redirectToMonnifyCheckout({});
    } catch (error) {
      setOnlinePaymentMessage(error instanceof Error ? error.message : "Unable to initiate payment. Please try again or contact admin.");
      setOnlinePaymentLoading(false);
    }
  }

  return (
    <>
      <div className="sticky top-16 z-20 -mx-4 mb-4 border-b border-line bg-ink/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-white">Hi {firstName}</p>
            <p className="mt-1 inline-flex max-w-full rounded-full border border-smart/25 bg-smart/10 px-2 py-0.5 text-[11px] font-semibold text-smart">
              {resident.houseNumber}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/resident/sos"
              className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg bg-danger px-3 py-1 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(255,59,48,0.18)]"
            >
              <Siren className="h-3.5 w-3.5" />
              SOS
            </Link>
            {summary ? (
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${summary.outstandingBalance > 0 ? "border-danger/30 bg-danger/10 text-danger" : "border-smart/30 bg-smart/10 text-smart"}`}>
                {mobileStatusText}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
        <PageHeader title={`Welcome, ${resident.name}`} description="Invite visitors, check bills, submit complaints, read announcements, and keep your digital ID ready." >
          <div className="flex flex-wrap gap-2">
            <Link href="/resident/sos">
              <Button variant="danger">
                <Siren className="h-4 w-4" />
                SOS
              </Button>
            </Link>
            <Button type="button" variant="secondary" onClick={() => void refreshAccounting({ bypassCache: true })}>
              <RefreshCw className="h-4 w-4" />
              {loadingAccounting ? "Refreshing" : "Refresh account"}
            </Button>
            <Link href="/resident/invite-visitor">
              <Button><QrCode className="h-4 w-4" />Invite visitor</Button>
            </Link>
          </div>
        </PageHeader>
      </div>
      {showSkeleton ? <ResidentFinancialSkeleton /> : null}
      {!showSkeleton && accountingError ? <ResidentAccountError /> : null}
      {!showSkeleton && !accountingError && summary ? (
        <>
          <ResidentStatusBanner summary={summary} onPayNow={startOutstandingPayment} paying={onlinePaymentLoading} />
          {onlinePaymentMessage ? (
            <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{onlinePaymentMessage}</p>
          ) : null}
          <ResidentSummaryCards summary={summary} />
          <ResidentMobileQuickActions summary={summary} onPayNow={startOutstandingPayment} paying={onlinePaymentLoading} />
        </>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4">
        <StatCard label="Expected visitors" value={loadingVisitors ? "..." : String(expectedVisitorCount)} helper="Pending or verified access codes" icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard label="My complaints" value={String(residentState.complaints.filter((complaint) => complaint.residentId === resident.id).length)} helper="Open and resolved tickets" icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="mt-6">
        <LiveVisitorCards
          title="My visitor invitations"
          visitorViews={visitorViews}
          loading={loadingVisitors}
          error={visitorError}
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {!showSkeleton && !accountingError && summary ? (
          <>
            <ResidentHomeBillsSection bills={liveBills} />
            <ResidentHomePaymentsSection bills={liveBills} payments={livePayments} />
          </>
        ) : null}
        <Card>
          <CardHeader title="Resident actions" description="The core mobile-first resident flow." />
          <div className="grid gap-3">
            <ActionRow icon={<QrCode className="h-5 w-5" />} title="Invite visitor" helper="Create a code and share it manually by WhatsApp or SMS." />
            <ActionRow icon={<WalletCards className="h-5 w-5" />} title="Pay bills online" helper="Use Paystack, Flutterwave, Monnify, or Squad when connected." />
            <ActionRow icon={<ClipboardList className="h-5 w-5" />} title="Submit complaint" helper="Report security, power, water, waste, road, or facility issues." />
          </div>
        </Card>
        <ResidentAnnouncementsPage compact />
      </div>
      {summary ? summary.outstandingBalance > 0 ? (
        <button
          type="button"
          className="fixed bottom-[5.25rem] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#1a7c4a] text-white shadow-[0_12px_30px_rgba(26,124,74,0.35)] disabled:opacity-70 sm:hidden"
          aria-label="Pay now"
          onClick={startOutstandingPayment}
          disabled={onlinePaymentLoading}
        >
          <CreditCard className="h-6 w-6" />
        </button>
      ) : (
        <Link
          href="/resident/invite-visitor"
          className="fixed bottom-[5.25rem] right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#1a7c4a] text-white shadow-[0_12px_30px_rgba(26,124,74,0.35)] sm:hidden"
          aria-label="Invite visitor"
        >
          <QrCode className="h-6 w-6" />
        </Link>
      ) : null}
    </>
  );
}

function PausedSosFeaturePage({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <>
      <PageHeader
        title="Panic / SOS paused"
        description="The emergency alarm module is temporarily hidden while the security response flow is being refined. Visitor access, resident management, billing, complaints, announcements, and digital ID features remain active."
      >
        <Link href={backHref}>
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        </Link>
      </PageHeader>
      <Card>
        <CardHeader
          title="Feature parked for now"
          description="We will bring this module back after the alarm dashboard, acknowledgement flow, and device notification behavior are stable across browsers and phones."
        />
        <div className="rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm leading-6 text-gold">
          Continue using visitor invitations, gate verification, billing, complaints, residents, and digital IDs while SOS is paused.
        </div>
      </Card>
    </>
  );
}

export function ResidentSosPage() {
  return <ResidentSosFlow />;
}

function ResidentSosFlow() {
  const { state } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const estate = state.estates.find((item) => item.id === resident.estateId) ?? state.estates[0];
  const [selectedType, setSelectedType] = useState<SosCreateInput["alertType"]>("panic");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [details, setDetails] = useState("");
  const [activeIncident, setActiveIncident] = useState<SecurityIncident | null>(null);
  const [history, setHistory] = useState<SecurityIncident[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);
  const selectedOption = sosAlertOptions.find((option) => option.type === selectedType) ?? sosAlertOptions[0];
  const locationLabel = `${residentUnitLabel(state, resident)}, ${estate?.address ?? "LBS View Estate"}`;
  const cooldownRemaining = Math.max(0, Math.ceil((SOS_RESUBMIT_COOLDOWN_MS - (Date.now() - lastSubmitAt)) / 1000));
  const activeHistoryIncident = history.find((incident) => isActiveSosStatus(incident.status));
  const activeTrackedIncident = activeIncident ?? activeHistoryIncident ?? null;
  const sendLocked = Boolean(activeTrackedIncident) || cooldownRemaining > 0 || sending;

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const incidents = await readAppwriteResidentSosHistory();
        if (!active) return;
        setHistory(incidents);
        const openIncident = incidents.find((incident) => isActiveSosStatus(incident.status));
        if (openIncident) {
          setActiveIncident(openIncident);
          setStatusMessage(residentSosStatusMessage(openIncident.status));
        }
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "SOS history could not be loaded.");
      } finally {
        if (active) {
          setLoadingHistory(false);
        }
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeTrackedIncident || activeTrackedIncident.status === "resolved" || activeTrackedIncident.status === "false_alarm" || activeTrackedIncident.status === "closed") {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const incident = await readAppwriteResidentSosIncident(activeTrackedIncident.id);
        setActiveIncident(incident);
        setHistory((current) => prependUniqueById(current, incident));
        setStatusMessage(residentSosStatusMessage(incident.status));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "SOS status could not be refreshed.");
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [activeTrackedIncident?.id, activeTrackedIncident?.status]);

  function beginConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendLocked) {
      setMessage(activeTrackedIncident
        ? "You already have an open SOS alert. Security and management can see it now."
        : `Please wait ${cooldownRemaining} seconds before sending another SOS alert.`);
      return;
    }

    setMessage("");
    setConfirming(true);
  }

  async function sendConfirmedSos() {
    setSending(true);
    setMessage("Sending alert...");
    setStatusMessage("");

    try {
      const incident = await createAppwriteResidentSos({
        alertType: selectedType,
        locationLabel,
        details
      });
      setActiveIncident(incident);
      setHistory((current) => prependUniqueById(current, incident));
      setLastSubmitAt(Date.now());
      setConfirming(false);
      setDetails("");
      setMessage(`Alert sent. Help is on the way. Your alert ID is ${incident.id}. Keep this page open to track response.`);
      setStatusMessage(residentSosStatusMessage(incident.status));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SOS alert could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Panic / SOS"
        description="Send an urgent estate safety alert to gate security with your house location and incident type."
      >
        <Link href="/resident">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.75fr]">
        <Card className="border-danger/30 bg-[radial-gradient(circle_at_top_left,rgba(255,59,48,0.18),rgba(255,255,255,0.08)_40%,rgba(255,255,255,0.06))]">
          <CardHeader
            title="Emergency type"
            description="Choose one alert type first. Nothing is sent until you confirm on the next step."
          />
          {activeTrackedIncident ? (
            <div className="mb-5 rounded-lg border border-danger/40 bg-danger/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100">Open SOS alert</p>
                  <p className="mt-1 font-semibold text-white">{activeTrackedIncident.summary}</p>
                  <p className="mt-1 text-sm text-slate-300">{statusMessage || residentSosStatusMessage(activeTrackedIncident.status)}</p>
                  <p className="mt-2 font-mono text-xs text-slate-200">Incident ID: {activeTrackedIncident.id}</p>
                </div>
                <StatusBadge status={formatEmergencyStatus(activeTrackedIncident.status)} tone={emergencyStatusTone(activeTrackedIncident.status)} />
              </div>
            </div>
          ) : null}
          <form className="grid gap-5" onSubmit={beginConfirmation}>
            <div className="grid gap-3 md:grid-cols-2">
              {sosAlertOptions.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setSelectedType(option.type)}
                  className={`rounded-lg border p-4 text-left transition ${
                    selectedType === option.type
                      ? `${option.tone} shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]`
                      : "border-white/15 bg-white/[0.08] text-slate-200 hover:bg-white/[0.12]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-black/25">{option.icon}</span>
                    <span>
                      <span className="block font-semibold text-white">{option.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-300">{option.helper}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
              <Field label="Optional note">
                <Textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Example: I need help at my apartment gate." />
              </Field>
              <div className="grid gap-3">
                <div className="rounded-lg border border-white/15 bg-black/25 p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 text-smart" />
                    <div>
                      <p className="text-sm font-semibold text-white">Shared location</p>
                      <p className="mt-1 text-sm text-slate-300">{locationLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">Resident: {resident.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {confirming ? (
              <div className="rounded-lg border border-danger/40 bg-danger/10 p-4">
                <p className="text-base font-semibold text-white">You are about to send a {selectedOption.title} alert.</p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Security and management will be notified immediately. Only use this in a real emergency.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Button type="button" variant="danger" className="min-h-12 w-full" onClick={() => void sendConfirmedSos()} disabled={sending}>
                    <Siren className="h-5 w-5" />
                    {sending ? "Sending alert..." : "Send SOS now"}
                  </Button>
                  <Button type="button" variant="secondary" className="min-h-12 w-full" onClick={() => setConfirming(false)} disabled={sending}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className={`rounded-lg border p-4 text-sm ${activeTrackedIncident ? "border-smart/30 bg-smart/10 text-smart" : "border-gold/30 bg-gold/10 text-gold"}`}>
                <p className="font-semibold text-white">{activeTrackedIncident ? "SOS status" : "SOS message"}</p>
                <p className="mt-1">{message}</p>
              </div>
            ) : null}

            <Button type="submit" variant="danger" className="min-h-14 text-base" disabled={sendLocked || confirming}>
              <Siren className="h-5 w-5" />
              {activeTrackedIncident ? "SOS already active" : cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : `Continue with ${selectedOption.title}`}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Recent SOS history" description="Every submitted SOS is logged for estate response and follow-up." />
          <div className="grid gap-3">
            {loadingHistory ? (
              visitorLoadingRows(3).map((row, index) => (
                <div key={index} className="h-20 animate-pulse rounded-lg border border-white/10 bg-white/[0.08]" />
              ))
            ) : history.length ? (
              history.slice(0, 3).map((incident) => (
                <SosIncidentSummaryCard key={incident.id} incident={incident} />
              ))
            ) : (
              <div className="rounded-lg border border-white/15 bg-white/[0.08] p-4 text-sm text-slate-300">
                No SOS alerts have been sent from this resident profile yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

export function InviteVisitorPage() {
  const { state } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const estate = state.estates.find((item) => item.id === resident.estateId) ?? state.estates[0];
  const today = dateInputValue();
  const [code, setCode] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [sharePhone, setSharePhone] = useState("");
  const [shareDate, setShareDate] = useState(today);
  const [shareTime, setShareTime] = useState(timeInputValue());
  const [status, setStatus] = useState("Generate a code to save it online for security verification.");
  const [visitorQrValue, setVisitorQrValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const phone = String(form.get("phone") ?? "");
    const visitDate = String(form.get("visitDate") ?? "");
    const arrivalTime = String(form.get("arrivalTime") ?? "");
    const input = {
      visitorName,
      phone,
      visitDate,
      arrivalTime,
      purpose: String(form.get("purpose") ?? ""),
      count: Math.min(20, Math.max(1, Number(form.get("count") ?? 1))),
      code: makeClientVisitorCode()
    };

    setSaving(true);
    setCode(input.code);
    setStatus("Saving visitor invitation online...");

    try {
      const savedVisitor = await createAppwriteResidentVisitor(input);

      setCode(savedVisitor.code);
      setVisitorQrValue(visitorQrValueFor(savedVisitor));
      setSharePhone(phone);
      setShareDate(visitDate);
      setShareTime(arrivalTime);
      setStatus("Visitor invitation saved online. Security can now verify this code.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Visitor invitation could not be saved online.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Invite visitor" description="Resident creates a visitor invitation, receives a unique access code/QR, then shares it manually." />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader title="Visitor details" description="Simple resident flow: fill form, generate code, share with visitor." />
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Visitor name"><Input value={visitorName} onChange={(event) => setVisitorName(event.target.value)} required /></Field>
              <Field label="Phone number"><Input name="phone" defaultValue={sharePhone} /></Field>
              <Field label="Visit date"><Input name="visitDate" type="date" defaultValue={today} /></Field>
              <Field label="Expected arrival time"><Input name="arrivalTime" type="time" defaultValue={shareTime} /></Field>
              <Field label="Number of visitors">
                <Select
                  name="count"
                  defaultValue="1"
                  className="border-smart/70 bg-smart/15 font-semibold text-white shadow-[0_0_0_1px_rgba(29,207,159,0.18)] focus:border-smart focus:ring-smart/40"
                  required
                >
                  {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count} className="bg-panel text-white">
                      {count}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Purpose of visit"><Textarea name="purpose" defaultValue="Family visit" /></Field>
            <Button type="submit" disabled={saving}>
              <QrCode className="h-4 w-4" />
              {saving ? "Saving code..." : "Generate visitor code"}
            </Button>
          </form>
        </Card>
        <VisitorCodeCard
          code={code}
          qrValue={visitorQrValue}
          visitorName={visitorName || "Visitor"}
          status={status}
          phone={sharePhone}
          residentAddress={`${residentUnitLabel(state, resident)}, ${estate?.address ?? "LBS View Estate"}`}
          visitDate={shareDate}
          arrivalTime={shareTime}
        />
      </div>
    </>
  );
}

function makeClientVisitorCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function MyVisitorsPage() {
  const { visitorViews, loadingVisitors, visitorError, refreshVisitors } = useLiveVisitorViews(readAppwriteResidentVisitors);

  return (
    <>
      <PageHeader title="My visitors" description="Track expected visitors, checked-in guests, expired codes, and cancelled invitations.">
        <Button type="button" variant="secondary" onClick={() => void refreshVisitors()} disabled={loadingVisitors}>
          <RefreshCw className="h-4 w-4" />
          {loadingVisitors ? "Loading" : "Refresh"}
        </Button>
      </PageHeader>
      {visitorError ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{visitorError}</p> : null}
      <LiveVisitorCards
        title={loadingVisitors ? "Loading visitor invitations" : "Visitor invitations"}
        visitorViews={visitorViews}
        loading={loadingVisitors}
        error={visitorError}
      />
    </>
  );
}

function ResidentFinancialSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${cards === 4 ? "lg:grid-cols-4" : "md:grid-cols-3"}`}>
      {Array.from({ length: cards }, (_, index) => (
        <Card key={index} className="p-4">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-200/70" />
          <div className="mt-5 h-4 w-28 animate-pulse rounded bg-slate-200/70" />
          <div className="mt-3 h-7 w-36 animate-pulse rounded bg-slate-200/80" />
          <div className="mt-3 h-3 w-32 animate-pulse rounded bg-slate-200/60" />
        </Card>
      ))}
    </div>
  );
}

function ResidentAccountError() {
  return (
    <Card>
      <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
        Unable to load your account information. Please refresh the page.
      </div>
    </Card>
  );
}

function ResidentStatusBanner({
  summary,
  onPayNow,
  paying = false
}: {
  summary: ResidentAccountingSummary;
  onPayNow?: () => void;
  paying?: boolean;
}) {
  const toneClass = summary.accountStatus === "fully_paid" || summary.accountStatus === "in_credit"
    ? "border-smart/30 bg-smart/10 text-emerald-700"
    : summary.accountStatus === "partially_paid"
      ? "border-warn/40 bg-warn/10 text-amber-700"
      : "border-danger/30 bg-danger/10 text-danger";

  return (
    <div className={`mb-4 rounded-lg border px-3 py-3 text-sm font-medium sm:text-sm ${toneClass}`}>
      <p className="text-base leading-6 sm:text-sm sm:leading-5">{summary.statusBannerText}</p>
      {summary.outstandingBalance > 0 ? (
        onPayNow ? (
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[#1a7c4a] px-4 text-sm font-semibold text-white disabled:opacity-70 sm:hidden"
            onClick={onPayNow}
            disabled={paying}
          >
            {paying ? "Starting payment..." : `Pay now - ${money(summary.outstandingBalance)}`}
          </button>
        ) : (
          <Link href="/resident/payments" className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-[#1a7c4a] px-4 text-sm font-semibold text-white sm:hidden">
            Pay now - {money(summary.outstandingBalance)}
          </Link>
        )
      ) : null}
    </div>
  );
}

function ResidentSummaryCards({ summary }: { summary: ResidentAccountingSummary }) {
  const creditHelper = summary.advanceCredit > 0
    ? `${summary.monthsCreditCovers} months ahead`
    : "No advance credit";
  const nextDueHelper = summary.outstandingBalance > 0
    ? "Overdue - pay now"
    : `${money(summary.monthlyRate)} subscription`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Net amount due" value={money(summary.outstandingBalance)} helper="Outstanding after credit" icon={<ReceiptText className="h-5 w-5" />} />
      <StatCard label="Total confirmed paid" value={money(summary.totalPaid)} helper="Lifetime recorded payments" icon={<WalletCards className="h-5 w-5" />} />
      <StatCard label="Credit / advance balance" value={money(summary.advanceCredit)} helper={creditHelper} icon={<BadgeCheck className="h-5 w-5" />} />
      <Card className={`p-4 ${summary.outstandingBalance > 0 ? "border-danger/40" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-lg border border-smart/20 bg-smart/15 p-3 text-smart shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]">
            <CalendarClock className="h-5 w-5" />
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm text-slate-300">Next billing due</p>
        <p className="mt-1 text-2xl font-semibold text-white">{formatResidentDate(summary.nextDueDate)}</p>
        <p className={`mt-2 text-xs ${summary.outstandingBalance > 0 ? "text-danger" : "text-slate-400"}`}>{nextDueHelper}</p>
      </Card>
    </div>
  );
}

function ResidentMobileQuickActions({
  summary,
  onPayNow,
  paying = false
}: {
  summary: ResidentAccountingSummary;
  onPayNow?: () => void;
  paying?: boolean;
}) {
  const primaryHref = summary.outstandingBalance > 0 ? "/resident/payments" : "/resident/invite-visitor";
  const primaryLabel = summary.outstandingBalance > 0 ? "Pay now" : "Invite visitor";

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:hidden">
      {summary.outstandingBalance > 0 && onPayNow ? (
        <button
          type="button"
          className="flex min-h-16 items-center gap-3 rounded-lg border border-line bg-white/80 px-3 text-left text-sm font-semibold text-white shadow-sm disabled:opacity-70"
          onClick={onPayNow}
          disabled={paying}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1a7c4a]/10 text-[#1a7c4a]"><CreditCard className="h-5 w-5" /></span>
          {paying ? "Starting..." : primaryLabel}
        </button>
      ) : (
        <Link href={primaryHref} className="flex min-h-16 items-center gap-3 rounded-lg border border-line bg-white/80 px-3 text-sm font-semibold text-white shadow-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1a7c4a]/10 text-[#1a7c4a]">
            {summary.outstandingBalance > 0 ? <CreditCard className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
          </span>
          {primaryLabel}
        </Link>
      )}
      {[
        { href: "/resident/payments", label: "Pay ahead", icon: <WalletCards className="h-5 w-5" /> },
        { href: "/resident/bills", label: "Statement", icon: <ReceiptText className="h-5 w-5" /> },
        { href: "/resident/invite-visitor", label: "Invite visitor", icon: <Users className="h-5 w-5" /> }
      ].map((item) => (
        <Link key={item.label} href={item.href} className="flex min-h-16 items-center gap-3 rounded-lg border border-line bg-white/80 px-3 text-sm font-semibold text-white shadow-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1a7c4a]/10 text-[#1a7c4a]">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function ResidentHomeBillsSection({ bills }: { bills: Bill[] }) {
  const recentBills = [...bills]
    .sort((left, right) => residentDateSortValue(right.dueDate) - residentDateSortValue(left.dueDate))
    .slice(0, 6);

  return (
    <Card>
      <CardHeader
        title="My bills"
        description="Latest subscription and opening balance records."
        action={<Link className="text-sm font-semibold text-smart" href="/resident/bills">View all bills -&gt;</Link>}
      />
      <div className="grid gap-3">
        {recentBills.length ? recentBills.map((bill, index) => (
          <ResidentBillListItem key={bill.id} bill={bill} className={index > 2 ? "hidden sm:block" : ""} />
        )) : (
          <p className="rounded-lg border border-line bg-white/60 p-4 text-sm text-slate-500">No bills have been recorded for your account yet.</p>
        )}
      </div>
    </Card>
  );
}

function ResidentHomePaymentsSection({ payments, bills }: { payments: Payment[]; bills: Bill[] }) {
  const billById = new Map(bills.map((bill) => [bill.id, bill.title]));
  const recentPayments = [...payments]
    .sort((left, right) => residentDateSortValue(right.date) - residentDateSortValue(left.date))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader title="My payments" description="Latest confirmed resident payment records." />
      <div className="grid gap-3">
        {recentPayments.length ? recentPayments.map((payment) => (
          <div key={payment.id} className="rounded-lg border border-line/70 bg-white/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{money(payment.amount)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatResidentDate(payment.date)} - {paymentChannelLabel(payment)}</p>
              </div>
              <StatusBadge status={payment.status} />
            </div>
            <p className="mt-3 text-xs text-slate-500">Reference: <span className="font-mono text-slate-200">{payment.reference}</span></p>
            <p className="mt-1 text-xs text-slate-500">Applied to: {billById.get(payment.billId) ?? "Resident account"}</p>
          </div>
        )) : (
          <p className="rounded-lg border border-line bg-white/60 p-4 text-sm text-slate-500">No payments recorded yet.</p>
        )}
      </div>
    </Card>
  );
}

function ResidentBillListItem({ bill, className = "" }: { bill: Bill; className?: string }) {
  const paid = numberValue(bill.paidAmount);
  const outstanding = Math.max(0, bill.amount - paid);

  return (
    <div className={`rounded-lg border border-line/70 bg-white/70 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{residentBillTitle(bill)}</p>
          <p className="mt-1 text-xs text-slate-500">{residentBillPeriod(bill)}</p>
        </div>
        <StatusBadge status={residentBillStatusLabel(bill)} tone={residentBillStatusTone(bill)} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <p><span className="block text-slate-500">Expected</span><span className="font-semibold text-slate-100">{money(bill.amount)}</span></p>
        <p><span className="block text-slate-500">Paid</span><span className="font-semibold text-slate-100">{money(paid)}</span></p>
        <p><span className="block text-slate-500">Outstanding</span><span className="font-semibold text-slate-100">{money(outstanding)}</span></p>
      </div>
    </div>
  );
}

function ResidentBillsLiveTable({
  bills,
  onPayBill,
  payingBillId = ""
}: {
  bills: Bill[];
  onPayBill?: (bill: Bill) => void;
  payingBillId?: string;
}) {
  const [mobileLimit, setMobileLimit] = useState(6);
  const orderedBills = [...bills].sort((left, right) => residentDateSortValue(right.dueDate) - residentDateSortValue(left.dueDate));
  const mobileBills = orderedBills.slice(0, mobileLimit);

  return (
    <Card>
      <CardHeader title="Resident billing" description="All live bills connected to this resident account." />
      <div className="grid gap-3 md:hidden">
        {mobileBills.length ? mobileBills.map((bill) => {
          const paid = numberValue(bill.paidAmount);
          const outstanding = Math.max(0, bill.amount - paid);

          return (
            <article key={bill.id} className="rounded-lg border border-line/70 bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white">{residentBillTitle(bill)}</p>
                  {bill.category === "opening_balance" ? (
                    <p className="mt-1 text-xs text-slate-500">Account history before system migration</p>
                  ) : null}
                </div>
                <StatusBadge status={residentBillStatusLabel(bill)} tone={residentBillStatusTone(bill)} />
              </div>
              <p className="mt-3 text-sm text-slate-300">{residentBillPeriod(bill)}</p>
              <p className="mt-3 text-sm text-slate-300">Expected amount: <span className="font-semibold text-white">{money(bill.amount)}</span></p>
              <p className="mt-2 text-sm text-slate-300">Paid: <span className="font-semibold text-white">{money(paid)}</span> - Outstanding: <span className="font-semibold text-white">{money(outstanding)}</span></p>
              {outstanding > 0 && onPayBill ? (
                <Button type="button" className="mt-4 min-h-11 w-full" onClick={() => onPayBill(bill)} disabled={payingBillId === bill.id}>
                  <CreditCard className="h-4 w-4" />
                  {payingBillId === bill.id ? "Starting payment..." : "Pay online"}
                </Button>
              ) : null}
            </article>
          );
        }) : (
          <p className="rounded-lg border border-line bg-white/60 p-4 text-sm text-slate-500">No bills have been recorded for your account yet.</p>
        )}
        {orderedBills.length > mobileLimit ? (
          <Button type="button" variant="secondary" className="min-h-11" onClick={() => setMobileLimit((current) => current + 6)}>
            Load more bills
          </Button>
        ) : null}
      </div>
      <div className="hidden max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-line/70 bg-white/40 md:block">
        <table className="w-full table-auto border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {["Bill", "Period / Due date", "Expected", "Paid", "Outstanding", "Status", "Action"].map((header) => (
                <th key={header} className="border-b border-line/70 px-3 py-3 font-semibold text-slate-400">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedBills.map((bill) => {
              const paid = numberValue(bill.paidAmount);
              const outstanding = Math.max(0, bill.amount - paid);

              return (
                <tr key={bill.id}>
                  <td className="border-b border-line/50 px-3 py-4 align-top">
                    <p className="font-semibold text-white">{residentBillTitle(bill)}</p>
                    {bill.category === "opening_balance" ? <p className="mt-1 text-xs text-slate-500">Account history before system migration</p> : null}
                  </td>
                  <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200">{residentBillPeriod(bill)}</td>
                  <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200">{money(bill.amount)}</td>
                  <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200">{money(paid)}</td>
                  <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200">{money(outstanding)}</td>
                  <td className="border-b border-line/50 px-3 py-4 align-top"><StatusBadge status={residentBillStatusLabel(bill)} tone={residentBillStatusTone(bill)} /></td>
                  <td className="border-b border-line/50 px-3 py-4 align-top">
                    {outstanding > 0 && onPayBill ? (
                      <Button type="button" className="min-h-9 px-3 py-1 text-xs" onClick={() => onPayBill(bill)} disabled={payingBillId === bill.id}>
                        <CreditCard className="h-3.5 w-3.5" />
                        {payingBillId === bill.id ? "Starting" : "Pay online"}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">No payment due</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ResidentPaymentsLiveTable({ payments, bills }: { payments: Payment[]; bills: Bill[] }) {
  const billById = new Map(bills.map((bill) => [bill.id, residentBillTitle(bill)]));
  const orderedPayments = [...payments].sort((left, right) => residentDateSortValue(right.date) - residentDateSortValue(left.date));

  return (
    <Card>
      <CardHeader title="Payment history" description="All confirmed payments and credit applications connected to your account." />
      {orderedPayments.length ? (
        <>
          <div className="grid gap-3 md:hidden">
            {orderedPayments.map((payment) => (
              <article key={payment.id} className="rounded-lg border border-line/70 bg-white/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{money(payment.amount)}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatResidentDate(payment.date)}</p>
                  </div>
                  <StatusBadge status={payment.status} />
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  <ResidentFact label="Channel" value={paymentChannelLabel(payment)} />
                  <ResidentFact label="Reference" value={payment.reference} mono />
                  <ResidentFact label="Applied to" value={billById.get(payment.billId) ?? "Resident account"} />
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-line/70 bg-white/40 md:block">
            <table className="w-full table-auto border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr>
                  {["Date", "Amount", "Channel", "Reference", "Status", "Applied to"].map((header) => (
                    <th key={header} className="border-b border-line/70 px-3 py-3 font-semibold text-slate-400">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200">{formatResidentDate(payment.date)}</td>
                    <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200">{money(payment.amount)}</td>
                    <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200 capitalize">{paymentChannelLabel(payment)}</td>
                    <td className="border-b border-line/50 px-3 py-4 align-top font-mono text-smart">{payment.reference}</td>
                    <td className="border-b border-line/50 px-3 py-4 align-top"><StatusBadge status={payment.status} /></td>
                    <td className="border-b border-line/50 px-3 py-4 align-top text-slate-200">{billById.get(payment.billId) ?? "Resident account"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-line bg-white/60 p-4 text-sm text-slate-500">No payments recorded yet.</p>
      )}
    </Card>
  );
}

function ResidentFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`min-w-0 break-words text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function residentBillTitle(bill: Bill) {
  return bill.category === "opening_balance" ? "Opening Balance (Legacy)" : bill.title;
}

function residentBillPeriod(bill: Bill) {
  if (bill.billingMonth) {
    return `${formatResidentMonth(bill.billingMonth)} - Due ${formatResidentDate(bill.dueDate)}`;
  }

  return `Due ${formatResidentDate(bill.dueDate)}`;
}

function residentBillStatusLabel(bill: Bill) {
  const paid = numberValue(bill.paidAmount);
  if (paid > bill.amount) return "Credit";
  if (bill.status === "paid") return "Paid";
  if (bill.status === "partially paid") return "Partial";
  if (bill.status === "overdue") return "Overdue";
  return "Unpaid";
}

function residentBillStatusTone(bill: Bill): StatusTone {
  const label = residentBillStatusLabel(bill);
  if (label === "Credit") return "blue";
  if (label === "Paid") return "green";
  if (label === "Partial") return "yellow";
  return "red";
}

function numberValue(value?: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function residentDateSortValue(value?: string) {
  if (!value) return 0;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatResidentDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "Not recorded";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: LAGOS_TIME_ZONE
  }).format(date);
}

function formatResidentMonth(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: LAGOS_TIME_ZONE
  }).format(date);
}

function ResidentSubscriptionPaymentPanel({
  summary,
  selectedMonths,
  paying,
  onSelectMonths,
  onPay
}: {
  summary: ResidentAccountingSummary;
  selectedMonths: number;
  paying: boolean;
  onSelectMonths: (months: number) => void;
  onPay: () => void;
}) {
  const totalAmount = selectedMonths * summary.monthlyRate;

  return (
    <Card className="mb-6">
      <CardHeader
        title="Pay subscription"
        description="Choose how many months to pay ahead. Confirmed payments update your resident account automatically."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 3, 6, 12].map((months) => (
              <button
                key={months}
                type="button"
                className={`min-h-12 rounded-lg border px-3 text-sm font-semibold transition ${
                  selectedMonths === months
                    ? "border-[#1a7c4a] bg-[#1a7c4a] text-white"
                    : "border-line bg-white/80 text-slate-800 hover:border-[#1a7c4a]/60"
                }`}
                onClick={() => onSelectMonths(months)}
              >
                {months} {months === 1 ? "month" : "months"}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Pay {selectedMonths} {selectedMonths === 1 ? "month" : "months"} = <span className="font-semibold text-white">{money(totalAmount)}</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Covers {subscriptionCoverageLabel(summary.nextDueDate, selectedMonths)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white/70 p-4">
          <p className="text-sm text-slate-500">Monthly subscription</p>
          <p className="mt-1 text-2xl font-semibold text-white">{money(summary.monthlyRate)}</p>
          <Button type="button" className="mt-4 w-full" onClick={onPay} disabled={paying || totalAmount <= 0}>
            <CreditCard className="h-4 w-4" />
            {paying ? "Starting payment..." : "Pay online now"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ResidentPaymentReturnBanner({
  tone,
  message
}: {
  tone: "success" | "error";
  message: string;
}) {
  const className = tone === "success"
    ? "border-smart/30 bg-smart/10 text-emerald-700"
    : "border-danger/30 bg-danger/10 text-danger";

  return (
    <div className={`mb-4 rounded-lg border px-3 py-3 text-sm font-medium ${className}`}>
      {message}
    </div>
  );
}

function ResidentVirtualAccountCard({ account }: { account: ResidentVirtualAccountDetails }) {
  const [copied, setCopied] = useState(false);

  async function copyAccountNumber() {
    await navigator.clipboard.writeText(account.accountNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title="Your dedicated payment account"
        description="Transfer any amount to this account and your subscription will be confirmed automatically within seconds."
      />
      <div className="grid gap-3 rounded-lg border border-smart/30 bg-smart/10 p-4 text-sm">
        <ResidentDetailLine label="Account Number" value={account.accountNumber} />
        <ResidentDetailLine label="Bank" value={account.bankName || "Monnify bank account"} />
        <ResidentDetailLine label="Account Name" value={account.accountName || "LBS View Estate"} />
      </div>
      <Button type="button" variant="secondary" className="mt-4" onClick={() => void copyAccountNumber()}>
        <Download className="h-4 w-4" />
        {copied ? "Copied!" : "Copy account number"}
      </Button>
    </Card>
  );
}

function useResidentVirtualAccount() {
  const [account, setAccount] = useState<ResidentVirtualAccountDetails | null>(null);

  useEffect(() => {
    let active = true;

    async function loadVirtualAccount() {
      const response = await fetch("/api/monnify/virtual-accounts", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        account?: ResidentVirtualAccountDetails | null;
      } | null;

      if (active && response.ok && payload?.account) {
        setAccount(payload.account);
      }
    }

    void loadVirtualAccount().catch(() => null);

    return () => {
      active = false;
    };
  }, []);

  return account;
}

function subscriptionCoverageLabel(nextDueDate: string, months: number) {
  const start = new Date(`${nextDueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return `${months} ${months === 1 ? "month" : "months"}`;
  }

  const end = new Date(start);
  end.setMonth(end.getMonth() + Math.max(1, months) - 1);

  return `${formatResidentMonth(start.toISOString().slice(0, 10))} to ${formatResidentMonth(end.toISOString().slice(0, 10))}`;
}

export function MyBillsPage() {
  const { state } = useLocalEstateStore();
  const { accounting, accountingError, loadingAccounting, refreshAccounting } = useResidentAccountingState(state);
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [payingBillId, setPayingBillId] = useState("");
  const [payingSubscription, setPayingSubscription] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const summary = accounting?.summary ?? null;
  const liveBills = accounting?.bills ?? [];
  const showSkeleton = loadingAccounting && !summary && !accountingError;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "failed") {
      setPaymentMessage("Payment was not completed. Your account has not been charged. Please try again.");
    }
  }, []);

  async function payBillOnline(bill: Bill) {
    setPayingBillId(bill.id);
    setPaymentMessage("");

    try {
      await redirectToMonnifyCheckout({ billId: bill.id });
    } catch {
      setPaymentMessage("Unable to initiate payment. Please try again or contact admin.");
      setPayingBillId("");
    }
  }

  async function paySubscriptionOnline() {
    setPayingSubscription(true);
    setPaymentMessage("");

    try {
      await redirectToMonnifyCheckout({ months: selectedMonths });
    } catch {
      setPaymentMessage("Unable to initiate payment. Please try again or contact admin.");
      setPayingSubscription(false);
    }
  }

  return (
    <>
      <PageHeader title="My bills" description="View outstanding estate bills, due dates, and payment status.">
        <Button type="button" variant="secondary" onClick={() => void refreshAccounting({ bypassCache: true })}>
          <RefreshCw className="h-4 w-4" />
          {loadingAccounting ? "Refreshing" : "Refresh account"}
        </Button>
      </PageHeader>
      {paymentMessage ? <ResidentPaymentReturnBanner tone="error" message={paymentMessage} /> : null}
      {showSkeleton ? <ResidentFinancialSkeleton /> : null}
      {!showSkeleton && accountingError ? <ResidentAccountError /> : null}
      {!showSkeleton && !accountingError && summary ? (
        <>
          <div className="mb-6">
            <ResidentSummaryCards summary={summary} />
          </div>
          <ResidentSubscriptionPaymentPanel
            summary={summary}
            selectedMonths={selectedMonths}
            paying={payingSubscription}
            onSelectMonths={setSelectedMonths}
            onPay={paySubscriptionOnline}
          />
          <ResidentBillsLiveTable bills={liveBills} onPayBill={payBillOnline} payingBillId={payingBillId} />
        </>
      ) : null}
    </>
  );
}

export function PaymentHistoryPage() {
  const { state } = useLocalEstateStore();
  const { accounting, accountingError, loadingAccounting, refreshAccounting } = useResidentAccountingState(state);
  const [returnBanner, setReturnBanner] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const virtualAccount = useResidentVirtualAccount();
  const summary = accounting?.summary ?? null;
  const liveBills = accounting?.bills ?? [];
  const livePayments = accounting?.payments ?? [];
  const showSkeleton = loadingAccounting && !summary && !accountingError;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "true") {
      setReturnBanner({
        tone: "success",
        message: "Payment confirmed successfully! Your account has been updated."
      });
      const timer = window.setTimeout(() => setReturnBanner(null), 5000);
      return () => window.clearTimeout(timer);
    }

    if (params.get("payment") === "failed") {
      setReturnBanner({
        tone: "error",
        message: "Payment was not completed. Your account has not been charged. Please try again."
      });
    }

    return undefined;
  }, []);

  return (
    <>
      <PageHeader title="Payment history" description="Pay bills online first. Manual bank transfer, POS, cash, or WhatsApp receipts remain available when online payment is not possible.">
        <Button type="button" variant="secondary" onClick={() => void refreshAccounting({ bypassCache: true })}>
          <RefreshCw className="h-4 w-4" />
          {loadingAccounting ? "Refreshing" : "Refresh account"}
        </Button>
      </PageHeader>
      {returnBanner ? <ResidentPaymentReturnBanner tone={returnBanner.tone} message={returnBanner.message} /> : null}
      {showSkeleton ? <ResidentFinancialSkeleton /> : null}
      {!showSkeleton && accountingError ? <ResidentAccountError /> : null}
      {!showSkeleton && !accountingError && summary ? (
        <>
          <div className="mb-6">
            <ResidentSummaryCards summary={summary} />
          </div>
          {virtualAccount ? <ResidentVirtualAccountCard account={virtualAccount} /> : null}
          {summary.outstandingBalance === 0 ? (
            <Card className="mb-6">
              <CardHeader
                title="No outstanding bills"
                description="All assigned bills are fully paid or covered by recorded credit."
              />
            </Card>
          ) : (
            <Card className="mb-6">
              <CardHeader
                title="Payment required"
                description={`${money(summary.outstandingBalance)} remains outstanding on your resident account.`}
              />
            </Card>
          )}
          <ResidentPaymentsLiveTable bills={liveBills} payments={livePayments} />
        </>
      ) : null}
    </>
  );
}

export function MyComplaintsPage() {
  const {
    complaints,
    loadingComplaints,
    complaintError
  } = useResidentComplaints();
  const [selectedComplaint, setSelectedComplaint] = useState<AppwriteComplaint | null>(null);

  return (
    <>
      <PageHeader title="My complaints" description="Track submitted maintenance requests, priority, assignment, and status updates." >
        <Link href="/resident/new-complaint">
          <Button><ClipboardList className="h-4 w-4" />New complaint</Button>
        </Link>
      </PageHeader>
      {loadingComplaints ? <Card className="mb-6"><p className="text-sm text-slate-400">Loading complaints...</p></Card> : null}
      {complaintError ? <Card className="mb-6"><p className="text-sm text-danger">Unable to load complaints. Please refresh the page.</p></Card> : null}
      {!loadingComplaints && !complaintError && !complaints.length ? <Card className="mb-6"><p className="text-sm text-slate-400">You have not submitted any complaints yet.</p></Card> : null}
      <DataTable
        title="Complaint history"
        headers={["Title", "Category", "Priority", "Assigned", "Status", "Reply"]}
        rows={complaints.map((complaint) => [
          <button key={complaint.id} type="button" className="text-left font-medium text-white" onClick={() => setSelectedComplaint(complaint)}>
            {complaint.subject}
          </button>,
          complaint.category,
          <StatusBadge key={complaint.priority} status={complaint.priority} />,
          complaint.assignedToName ?? complaint.assignedTo ?? "Unassigned",
          <StatusBadge key={complaint.status} status={complaintStatusLabel(complaint.status)} />,
          complaint.adminResponse ? <StatusBadge key={`${complaint.id}-reply`} status="Admin replied" tone="blue" /> : "No reply yet"
        ])}
      />
      {selectedComplaint ? (
        <Card className="mt-6">
          <CardHeader title={selectedComplaint.subject} description={`${selectedComplaint.category} - ${formatComplaintDate(selectedComplaint.createdAt)}`} />
          <div className="grid gap-4 text-sm text-slate-300">
            <p>{selectedComplaint.description}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={selectedComplaint.priority} />
              <StatusBadge status={complaintStatusLabel(selectedComplaint.status)} />
              {selectedComplaint.adminResponse ? <StatusBadge status="Admin replied" tone="blue" /> : null}
            </div>
            {selectedComplaint.adminResponse ? (
              <div className="rounded-lg border border-line bg-ink/50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Admin response</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedComplaint.adminResponse}</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}

export function SubmitComplaintPage() {
  const router = useRouter();
  const [complaintMessage, setComplaintMessage] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  async function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingComplaint(true);
    setComplaintMessage("Complaint captured. Syncing with admin dashboard...");
    const form = new FormData(event.currentTarget);
    const requestBody = {
      category: String(form.get("category") ?? "other"),
      subject: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      priority: String(form.get("priority") ?? "medium")
    };

    try {
      const response = await fetch("/api/appwrite/resident/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const payload = await response.json().catch(() => null) as ComplaintApiResponse | null;
      if (!response.ok || !payload?.complaint) {
        throw new Error(payload?.error ?? "Failed to submit complaint. Please try again.");
      }

      setComplaintMessage("Your complaint has been submitted successfully.");
      event.currentTarget.reset();
      window.setTimeout(() => router.push("/resident/complaints"), 700);
    } catch {
      setComplaintMessage("Failed to submit complaint. Please try again.");
    } finally {
      setSubmittingComplaint(false);
    }
  }

  return (
    <>
      <PageHeader title="Submit complaint" description="Residents can submit maintenance or community issues with priority and image placeholder." />
      <Card>
        <CardHeader title="New complaint" description="Admin can later assign and update SLA status." />
        <form className="grid gap-4" onSubmit={submitComplaint}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Category">
              <Select name="category" defaultValue="security">
                <option>security</option><option>power</option><option>water</option><option>waste</option><option>noise</option><option>road</option><option>facility</option><option>other</option>
              </Select>
            </Field>
            <Field label="Priority"><Select name="priority" defaultValue="medium"><option>low</option><option>medium</option><option>high</option></Select></Field>
            <Field label="Image upload"><Input type="file" /></Field>
          </div>
          <Field label="Title"><Input name="title" placeholder="Brief issue title" required /></Field>
          <Field label="Description"><Textarea name="description" placeholder="Describe the issue, location, and any urgency." required /></Field>
          {complaintMessage ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{complaintMessage}</p> : null}
          <Button className="w-fit" disabled={submittingComplaint}>{submittingComplaint ? "Submitting..." : "Submit complaint"}</Button>
        </form>
      </Card>
    </>
  );
}

export function ResidentAnnouncementsPage({ compact = false }: { compact?: boolean }) {
  const {
    announcements,
    loadingAnnouncements,
    announcementError
  } = useLiveAnnouncements("resident");
  const visibleAnnouncements = compact ? announcements.slice(0, 3) : announcements;

  return (
    <>
      {!compact ? <PageHeader title="Announcements" description="Estate communication targeted to residents, owners, tenants, security, and vendors." /> : null}
      <Card>
        <CardHeader title="Latest announcements" description="Prepared for push notification delivery." />
        <div className="grid gap-4">
          {loadingAnnouncements ? (
            <div className="rounded-lg border border-line bg-ink/50 p-4">
              <p className="text-sm text-slate-400">Loading announcements...</p>
            </div>
          ) : null}
          {announcementError ? (
            <div className="rounded-lg border border-line bg-ink/50 p-4">
              <p className="text-sm text-danger">Unable to load announcements. Please refresh the page.</p>
            </div>
          ) : null}
          {!loadingAnnouncements && !announcementError && !visibleAnnouncements.length ? (
            <div className="rounded-lg border border-line bg-ink/50 p-4">
              <p className="text-sm text-slate-400">{compact ? "No announcements" : "No announcements are available right now."}</p>
            </div>
          ) : null}
          {visibleAnnouncements.map((announcement) => (
            <div key={announcement.id} className={announcementCardClassName(announcement)}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-white">{announcement.title}</h2>
                  {announcement.isPinned ? <StatusBadge status="pinned" tone="blue" /> : null}
                </div>
                <StatusBadge status={announcement.priority} tone={announcementPriorityTone(announcement.priority)} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{announcement.message}</p>
              <p className="mt-3 text-xs text-slate-500">
                {formatAnnouncementDate(announcement.publishedAt ?? announcement.createdAt)} - {announcementTargetLabel(announcement.targetRole)}
                {announcementExpiryLabel(announcement.expiresAt) ? ` - ${announcementExpiryLabel(announcement.expiresAt)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

export function ResidentDigitalIdPage() {
  const { state } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const idNumber = makeDigitalIdNumber(resident);

  return (
    <>
      <PageHeader title="My digital ID" description="Use your digital ID for status checks at the gate and estate service points." />
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1fr]">
        <DigitalIdCard name={resident.name} role={`Resident ${resident.type}`} estate="LBS View Estate" house={residentUnitLabel(state, resident)} idNumber={idNumber} status={resident.status} />
        <Card>
          <CardHeader title="ID verification details" description="Security can scan the QR or search the ID number." />
          <div className="grid gap-4 text-sm text-slate-300">
            <ActionRow icon={<ShieldCheck className="h-5 w-5" />} title="Status" helper="Active resident with valid estate access." />
            <ActionRow icon={<HomeIcon />} title="Property / unit" helper={`${residentUnitLabel(state, resident)} resident profile.`} />
            <ActionRow icon={<Landmark className="h-5 w-5" />} title="Estate" helper="LBS View Estate - Main Gate A." />
          </div>
        </Card>
      </div>
    </>
  );
}

export function HouseholdPage() {
  const { members, loadingMembers, memberError, refreshMembers } = useHouseholdMembers();
  const [householdMessage, setHouseholdMessage] = useState("");
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  const [householdForm, setHouseholdForm] = useState(emptyHouseholdForm());

  async function submitHouseholdMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHouseholdMessage("");
    const endpoint = editingMember
      ? `/api/appwrite/resident/household/${encodeURIComponent(editingMember.id)}`
      : "/api/appwrite/resident/household";
    const method = editingMember ? "PATCH" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(householdForm)
      });
      const payload = await response.json().catch(() => null) as HouseholdApiResponse | null;
      if (!response.ok || !payload?.member) {
        throw new Error(payload?.error ?? "Unable to save household member.");
      }

      setHouseholdMessage(editingMember ? "Household member updated." : "Household member added.");
      setEditingMember(null);
      setHouseholdForm(emptyHouseholdForm());
      await refreshMembers();
    } catch (error) {
      setHouseholdMessage(error instanceof Error ? error.message : "Unable to save household member.");
    }
  }

  function editHouseholdMember(member: HouseholdMember) {
    setEditingMember(member);
    setHouseholdForm({
      fullName: member.fullName,
      relationship: member.relationship,
      phone: member.phone ?? "",
      idType: member.idType ?? "none",
      idNumber: member.idNumber ?? "",
      hasEstateAccess: member.hasEstateAccess,
      accessNote: member.accessNote ?? ""
    });
  }

  async function removeHouseholdMember(member: HouseholdMember) {
    setHouseholdMessage("");

    try {
      const response = await fetch(`/api/appwrite/resident/household/${encodeURIComponent(member.id)}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => null) as HouseholdApiResponse | null;
      if (!response.ok || !payload?.member) {
        throw new Error(payload?.error ?? "Unable to remove household member.");
      }

      setHouseholdMessage("Household member removed.");
      await refreshMembers();
    } catch (error) {
      setHouseholdMessage(error instanceof Error ? error.message : "Unable to remove household member.");
    }
  }

  return (
    <>
      <PageHeader title="Household and domestic staff" description="Residents manage household members, domestic staff, vendors, and other people linked to their unit." />
      <Card className="mb-6">
        <CardHeader title={editingMember ? "Edit household member" : "Add household member"} description="Manage household members, domestic staff, vendors, and estate access." />
        <form className="grid gap-4" onSubmit={submitHouseholdMember}>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Full name">
              <Input
                value={householdForm.fullName}
                onChange={(event) => setHouseholdForm((current) => ({ ...current, fullName: event.target.value }))}
                required
              />
            </Field>
            <Field label="Relationship">
              <Select
                value={householdForm.relationship}
                onChange={(event) => setHouseholdForm((current) => ({
                  ...current,
                  relationship: event.target.value as HouseholdMember["relationship"]
                }))}
              >
                <option value="spouse">spouse</option>
                <option value="child">child</option>
                <option value="parent">parent</option>
                <option value="sibling">sibling</option>
                <option value="relative">relative</option>
                <option value="domestic_staff">domestic staff</option>
                <option value="driver">driver</option>
                <option value="guard">guard</option>
                <option value="vendor">vendor</option>
                <option value="other">other</option>
              </Select>
            </Field>
            <Field label="Phone">
              <Input
                value={householdForm.phone}
                onChange={(event) => setHouseholdForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="ID type">
              <Select
                value={householdForm.idType}
                onChange={(event) => setHouseholdForm((current) => ({
                  ...current,
                  idType: event.target.value as NonNullable<HouseholdMember["idType"]>
                }))}
              >
                <option value="none">none</option>
                <option value="nin">nin</option>
                <option value="bvn">bvn</option>
                <option value="passport">passport</option>
                <option value="drivers_license">drivers license</option>
                <option value="other">other</option>
              </Select>
            </Field>
            <Field label="ID number">
              <Input
                value={householdForm.idNumber}
                onChange={(event) => setHouseholdForm((current) => ({ ...current, idNumber: event.target.value }))}
              />
            </Field>
            <Field label="Estate access">
              <Select
                value={householdForm.hasEstateAccess ? "true" : "false"}
                onChange={(event) => setHouseholdForm((current) => ({ ...current, hasEstateAccess: event.target.value === "true" }))}
              >
                <option value="true">Estate Access</option>
                <option value="false">No Access</option>
              </Select>
            </Field>
          </div>
          <Field label="Access note">
            <Input
              value={householdForm.accessNote}
              onChange={(event) => setHouseholdForm((current) => ({ ...current, accessNote: event.target.value }))}
            />
          </Field>
          {householdMessage ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{householdMessage}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button className="w-fit">{editingMember ? "Update member" : "Add member"}</Button>
            {editingMember ? (
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                onClick={() => {
                  setEditingMember(null);
                  setHouseholdForm(emptyHouseholdForm());
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      {loadingMembers ? <Card className="mb-6"><p className="text-sm text-slate-400">Loading household members...</p></Card> : null}
      {memberError ? <Card className="mb-6"><p className="text-sm text-danger">Unable to load household members. Please refresh the page.</p></Card> : null}
      {!loadingMembers && !memberError && !members.length ? (
        <Card className="mb-6"><p className="text-sm text-slate-400">No household members added yet. Add your first member below.</p></Card>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Household members"
          headers={["Name", "Type", "Phone", "Access", "Action"]}
          rows={members.filter((member) => member.relationship !== "domestic_staff").map((member) => [
            member.fullName,
            relationshipLabel(member.relationship),
            member.phone ?? "Not recorded",
            <StatusBadge key={`${member.id}-access`} status={member.hasEstateAccess ? "Estate Access" : "No Access"} tone={member.hasEstateAccess ? "green" : "slate"} />,
            <div key={`${member.id}-actions`} className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => editHouseholdMember(member)}>Edit</Button>
              <Button type="button" variant="danger" className="min-h-9 px-3 py-1 text-xs" onClick={() => void removeHouseholdMember(member)}>Remove</Button>
            </div>
          ])}
        />
        <DataTable
          title="Domestic staff"
          headers={["Name", "Type", "ID", "Access", "Action"]}
          rows={members.filter((member) => member.relationship === "domestic_staff").map((member) => [
            member.fullName,
            relationshipLabel(member.relationship),
            member.idNumber ?? "Not recorded",
            <StatusBadge key={`${member.id}-access`} status={member.hasEstateAccess ? "Estate Access" : "No Access"} tone={member.hasEstateAccess ? "green" : "slate"} />,
            <div key={`${member.id}-actions`} className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => editHouseholdMember(member)}>Edit</Button>
              <Button type="button" variant="danger" className="min-h-9 px-3 py-1 text-xs" onClick={() => void removeHouseholdMember(member)}>Remove</Button>
            </div>
          ])}
        />
      </div>
    </>
  );
}

export function SecurityDashboard() {
  const { visitorViews, loadingVisitors, visitorError } = useLiveVisitorViews(readAppwriteExpectedVisitors, { refreshIntervalMs: 60_000 });
  const [sosAlerts, setSosAlerts] = useState<SecurityIncident[]>([]);
  const [sosMessage, setSosMessage] = useState("");
  const visitors = visitorViews.map((view) => view.visitor);
  const checkedInCount = visitors.filter((visitor) => visitor.status === "checked-in").length;
  const verifiedCount = visitors.filter((visitor) => visitor.status === "verified").length;
  const recentVisitors = visitors.slice(0, 4);
  const activeSosAlerts = sosAlerts.filter((incident) => isActiveSosStatus(incident.status));

  useEffect(() => {
    let active = true;

    async function loadSosAlerts() {
      try {
        const incidents = await readAppwriteAdminSosIncidents();
        if (!active) return;
        setSosAlerts(incidents);
        setSosMessage("");
      } catch (error) {
        if (!active) return;
        setSosMessage(error instanceof Error ? error.message : "SOS alerts could not be loaded.");
      }
    }

    void loadSosAlerts();
    const interval = window.setInterval(loadSosAlerts, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      <PageHeader title="Security dashboard" description="Verify access and record gate movement.">
        <Link href="/security/sos-alerts">
          <Button variant="danger">
            <Siren className="h-4 w-4" />
            SOS Alerts
          </Button>
        </Link>
      </PageHeader>
      {sosMessage ? <p className="mb-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">{sosMessage}</p> : null}
      {activeSosAlerts.length ? (
        <Link
          href="/security/sos-alerts"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-red-100 shadow-[0_18px_40px_rgba(255,59,48,0.12)]"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-danger text-white">
              <Siren className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-white">{activeSosAlerts.length} active SOS alert{activeSosAlerts.length === 1 ? "" : "s"}</span>
              <span className="mt-1 block text-xs text-red-100">Tap to acknowledge or mark responding.</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      ) : null}
      <div className="grid gap-3 sm:hidden">
        <Link href="/security/verify-visitor">
          <Button className="min-h-[72px] w-full justify-center text-base">
            <QrCode className="h-6 w-6" />
            Scan QR Code
          </Button>
        </Link>
        <Link href="/security/verify-visitor">
          <Button variant="secondary" className="min-h-[72px] w-full justify-center text-base">
            <Search className="h-6 w-6" />
            Enter Code Manually
          </Button>
        </Link>
        <Card>
          <CardHeader title="Recent gate activity" description="Latest visitor invitations and movements." />
          <div className="grid gap-3">
            {recentVisitors.length ? recentVisitors.map((visitor) => (
              <div key={visitor.id} className="rounded-lg border border-line/70 bg-white/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{visitor.visitorName}</p>
                    <p className="mt-1 text-xs text-slate-500">{visitor.code} - {formatClockTime(visitor.arrivalTime)}</p>
                  </div>
                  <StatusBadge status={visitor.status} />
                </div>
              </div>
            )) : (
              <p className="rounded-lg border border-line bg-white/60 p-3 text-sm text-slate-500">No recent visitor activity.</p>
            )}
          </div>
        </Card>
      </div>
      <div className="hidden sm:block">
        <VerifyVisitorPage compact />
      </div>
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-white">Today at the gate</h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatCard label="Expected today" value={loadingVisitors ? "..." : String(visitors.length)} helper="All gates" icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Checked in" value={loadingVisitors ? "..." : String(checkedInCount)} helper="Currently inside" icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard label="Verified codes" value={loadingVisitors ? "..." : String(verifiedCount)} helper="Awaiting check-in" icon={<BadgeCheck className="h-5 w-5" />} />
      </div>
      <div className="mt-6">
        <LiveVisitorCards
          title="Live expected visitors"
          visitorViews={visitorViews}
          loading={loadingVisitors}
          error={visitorError}
          showResident
        />
      </div>
    </>
  );
}

export function CsoDashboard() {
  const [patrols, setPatrols] = useState<GuardPatrolEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<GuardCheckpoint[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [reviews, setReviews] = useState<CsoReview[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<CsoSecurityAlert[]>([]);
  const [activeTab, setActiveTab] = useState<"feed" | "checkpoints">("feed");
  const [message, setMessage] = useState("Loading security operations...");
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);
  const [pinningLocation, setPinningLocation] = useState(false);
  const [checkpointName, setCheckpointName] = useState("");
  const [checkpointLatitude, setCheckpointLatitude] = useState("");
  const [checkpointLongitude, setCheckpointLongitude] = useState("");
  const [checkpointTokenSeed, setCheckpointTokenSeed] = useState(() => createCheckpointQrSuffix());
  const checkpointQrToken = useMemo(
    () => buildCheckpointQrToken(checkpointName, checkpointTokenSeed),
    [checkpointName, checkpointTokenSeed]
  );
  const todayKey = new Date().toISOString().slice(0, 10);
  const patrolsToday = patrols.filter((patrol) => patrol.scannedAt.startsWith(todayKey));
  const activeGuards = new Set(
    patrols
      .filter((patrol) => Date.now() - new Date(patrol.scannedAt).getTime() <= 24 * 60 * 60 * 1000)
      .map((patrol) => patrol.guardId || patrol.guardProfileId)
  );
  const gpsViolations = patrols.filter((patrol) => patrol.isGpsVerified === false || patrol.status === "gps_violation");
  const offlineLogs = patrols.filter((patrol) => patrol.isOfflineLog === true);
  const openIncidents = incidents.filter((incident) => isActiveSosStatus(incident.status));
  const pendingReviews = reviews.filter((review) => review.status === "open" || review.status === "pending");
  const canResolve = true;

  useEffect(() => {
    function syncTabFromHash() {
      setActiveTab(window.location.hash === "#checkpoints" ? "checkpoints" : "feed");
    }

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const [patrolResponse, checkpointResponse] = await Promise.all([
          fetch("/api/appwrite/security/patrols", { cache: "no-store" }),
          fetch("/api/appwrite/security/checkpoints", { cache: "no-store" })
        ]);
        const patrolPayload = await patrolResponse.json().catch(() => null) as {
          patrols?: GuardPatrolEvent[];
          incidents?: SecurityIncident[];
          reviews?: CsoReview[];
          error?: string;
        } | null;
        const checkpointPayload = await checkpointResponse.json().catch(() => null) as { checkpoints?: GuardCheckpoint[]; error?: string } | null;

        if (!patrolResponse.ok) {
          throw new Error(patrolPayload?.error ?? "Unable to load patrol events.");
        }

        if (!checkpointResponse.ok) {
          throw new Error(checkpointPayload?.error ?? "Unable to load checkpoints.");
        }

        if (!active) return;
        setPatrols(patrolPayload?.patrols ?? []);
        setIncidents(patrolPayload?.incidents ?? []);
        setReviews(patrolPayload?.reviews ?? []);
        setCheckpoints(checkpointPayload?.checkpoints ?? []);
        setMessage("Security operations are synced.");
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Unable to load security operations.");
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, 15000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCsoSecurityRealtime({
      onPatrolCreate: (patrol) => {
        setPatrols((current) => prependUniqueById(current, patrol));

        if (patrol.isGpsVerified === false) {
          setSecurityAlerts((current) => prependSecurityAlert(current, patrolAlertFromRealtime(patrol)));
        }
      },
      onIncidentCreate: (incident) => {
        setIncidents((current) => prependUniqueById(current, incident));
        setSecurityAlerts((current) => prependSecurityAlert(current, incidentAlertFromRealtime(incident)));
        if (incident.incidentType === "sos") {
          notifySosIncident(incident);
          flashSosBrowserTitle();
        }
      }
    });

    return unsubscribe;
  }, []);

  async function updateCsoIncidentStatus(incident: SecurityIncident, status: SosUpdateInput["status"], note = "") {
    try {
      const updated = await updateAppwriteSosIncident({
        incidentId: incident.id,
        status,
        note
      });
      setIncidents((current) => prependUniqueById(current, updated).sort(sortSecurityIncidentsNewestFirst));
      setSecurityAlerts((current) => prependSecurityAlert(current, incidentAlertFromRealtime(updated)));
      setMessage(`${updated.summary} marked as ${formatEmergencyStatus(updated.status)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SOS alert could not be updated.");
    }
  }

  async function saveCheckpoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingCheckpoint(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const trimmedCheckpointName = checkpointName.trim();
    const qrToken = checkpointQrToken;
    try {
      const response = await fetch("/api/appwrite/security/checkpoints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          checkpointCode: qrToken.replace(/^CP_/i, ""),
          checkpointName: trimmedCheckpointName,
          gateName: "",
          locationLabel: trimmedCheckpointName,
          qrToken,
          latitude: Number(checkpointLatitude),
          longitude: Number(checkpointLongitude),
          allowedRadius: Number(form.get("allowedRadius") || 25),
          status: "active"
        })
      });
      const payload = await response.json().catch(() => null) as { checkpoint?: GuardCheckpoint; error?: string } | null;
      if (!response.ok || !payload?.checkpoint) {
        throw new Error(payload?.error ?? "Checkpoint could not be saved.");
      }

      setCheckpoints((current) => [payload.checkpoint!, ...current.filter((item) => item.id !== payload.checkpoint!.id)]);
      setMessage(`${payload.checkpoint.checkpointName} checkpoint is ready. QR value: ${checkpointQrPayload(payload.checkpoint)}`);
      event.currentTarget.reset();
      setCheckpointName("");
      setCheckpointLatitude("");
      setCheckpointLongitude("");
      setCheckpointTokenSeed(createCheckpointQrSuffix());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkpoint could not be saved.");
    } finally {
      setSavingCheckpoint(false);
    }
  }

  function pinCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("This device does not support GPS location capture.");
      return;
    }

    setPinningLocation(true);
    setMessage("Capturing current GPS location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCheckpointLatitude(position.coords.latitude.toFixed(7));
        setCheckpointLongitude(position.coords.longitude.toFixed(7));
        setPinningLocation(false);
        setMessage("GPS location pinned for this checkpoint.");
      },
      () => {
        setPinningLocation(false);
        setMessage("GPS capture failed. Allow location access and try again.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  async function renameCheckpoint(checkpointId: string, checkpointName: string) {
    const response = await fetch("/api/appwrite/security/checkpoints", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ checkpointId, checkpointName })
    });
    const payload = await response.json().catch(() => null) as { checkpoint?: GuardCheckpoint; error?: string } | null;
    if (!response.ok || !payload?.checkpoint) {
      throw new Error(payload?.error ?? "Checkpoint could not be renamed.");
    }

    setCheckpoints((current) => current.map((item) => item.id === payload.checkpoint!.id ? payload.checkpoint! : item));
    setMessage(`${payload.checkpoint.checkpointName} checkpoint has been renamed.`);
    return payload.checkpoint;
  }

  return (
    <>
      <PageHeader
        title="CSO command"
        description="Monitor patrols, GPS exceptions, checkpoint coverage, and guard activity."
      >
        <Link href="/cso#alerts">
          <Button variant="danger">
            <Siren className="h-4 w-4" />
            SOS Alerts
          </Button>
        </Link>
      </PageHeader>

      {message ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Patrols today" value={String(patrolsToday.length)} helper="Checkpoint scans recorded" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Active guards" value={String(activeGuards.size)} helper="Seen in last 24 hours" icon={<Users className="h-5 w-5" />} />
        <StatCard label="GPS violations" value={String(gpsViolations.length)} helper="Needs CSO review" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Offline synced" value={String(offlineLogs.length)} helper="Saved during network gaps" icon={<RefreshCw className="h-5 w-5" />} />
        <StatCard label="Open incidents" value={String(openIncidents.length)} helper="From security_incidents" icon={<Siren className="h-5 w-5" />} />
        <StatCard label="CSO reviews" value={String(pendingReviews.length)} helper="Pending sign-off" icon={<BadgeCheck className="h-5 w-5" />} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
        <button
          className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === "feed" ? "bg-smart text-ink" : "text-slate-300"}`}
          onClick={() => setActiveTab("feed")}
          type="button"
        >
          Patrol feed
        </button>
        <button
          className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === "checkpoints" ? "bg-smart text-ink" : "text-slate-300"}`}
          onClick={() => setActiveTab("checkpoints")}
          type="button"
        >
          Checkpoints
        </button>
      </div>

      {activeTab === "feed" ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_22rem]">
          <Card id="patrol-feed">
            <CardHeader title="Live patrol feed" description="Latest checkpoint scans. GPS warnings stay visible for audit." />
            <div className="grid gap-3">
              {openIncidents.length ? (
                <div className="grid gap-3">
                  {openIncidents.slice(0, 5).map((incident) => (
                    incident.incidentType === "sos" ? (
                      <SosIncidentActionCard
                        key={incident.id}
                        incident={incident}
                        canResolve
                        onAcknowledge={() => void updateCsoIncidentStatus(incident, "acknowledged")}
                        onRespond={() => void updateCsoIncidentStatus(incident, "responding")}
                        onResolve={(note) => void updateCsoIncidentStatus(incident, "resolved", note)}
                        onFalseAlarm={(note) => void updateCsoIncidentStatus(incident, "false_alarm", note)}
                      />
                    ) : (
                      <SecurityIncidentCard key={incident.id} incident={incident} />
                    )
                  ))}
                </div>
              ) : null}
              {patrols.length ? patrols.map((patrol) => (
                <PatrolEventCard key={patrol.id} patrol={patrol} />
              )) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  No guard tour scans have been logged yet.
                </div>
              )}
              {reviews.length ? (
                <div className="grid gap-3">
                  {reviews.slice(0, 5).map((review) => (
                    <CsoReviewCard key={review.id} review={review} />
                  ))}
                </div>
              ) : null}
            </div>
          </Card>
          <Card id="alerts">
            <CardHeader title="Security alerts" description="Realtime GPS and incident warnings." />
            <div className="grid gap-3">
              {securityAlerts.length ? securityAlerts.map((alert) => (
                <SecurityAlertCapsule key={alert.id} alert={alert} />
              )) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  Realtime alerts will appear here.
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <div id="checkpoints" className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader title="Checkpoint Management & QR Form" description="Create patrol locations, pin GPS coordinates, and generate printable checkpoint QR codes." />
            <form className="grid gap-3" onSubmit={saveCheckpoint}>
              <Field label="Location name">
                <Input
                  name="checkpointName"
                  onChange={(event) => setCheckpointName(event.target.value)}
                  placeholder="Main Gate"
                  required
                  value={checkpointName}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Allowed radius"><Input name="allowedRadius" inputMode="numeric" defaultValue="25" /></Field>
                <div className="grid content-end">
                  <Button type="button" variant="secondary" onClick={pinCurrentLocation} disabled={pinningLocation}>
                    <MapPin className="h-4 w-4" />
                    {pinningLocation ? "Pinning" : "Pin Current Location"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Latitude"><Input name="latitude" value={checkpointLatitude} readOnly placeholder="Tap Pin Current Location" required /></Field>
                <Field label="Longitude"><Input name="longitude" value={checkpointLongitude} readOnly placeholder="Tap Pin Current Location" required /></Field>
              </div>
              <div className="grid gap-3 rounded-lg border border-smart/20 bg-smart/10 p-3 sm:grid-cols-[12rem_1fr]">
                <div className="rounded-lg border border-white/10 bg-white p-2">
                  <QRCodeImage value={checkpointQrToken} />
                </div>
                <div className="grid content-center gap-2">
                  <p className="text-sm font-semibold text-white">New checkpoint QR</p>
                  <p className="font-mono text-xs text-smart break-all">{checkpointQrToken}</p>
                  <p className="text-xs text-slate-400">This is the QR value that will be saved and printed for this patrol location.</p>
                </div>
              </div>
              <Button disabled={savingCheckpoint || !checkpointName.trim() || !checkpointLatitude || !checkpointLongitude}>
                <MapPin className="h-4 w-4" />
                {savingCheckpoint ? "Saving" : "Save checkpoint"}
              </Button>
            </form>
          </Card>
          <Card>
            <CardHeader title="Checkpoint list" description="Coordinates and QR tokens for guard tour points." />
            <div className="grid gap-3">
              {checkpoints.length ? checkpoints.map((checkpoint) => (
                <CheckpointCard key={checkpoint.id} checkpoint={checkpoint} onRename={renameCheckpoint} />
              )) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                  No checkpoints have been configured yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

type CsoSecurityAlert = {
  id: string;
  sourceId: string;
  kind: "gps" | "incident";
  title: string;
  detail: string;
  createdAt: string;
  severity: "warning" | "urgent";
};

function SecurityAlertCapsule({ alert }: { alert: CsoSecurityAlert }) {
  const urgent = alert.severity === "urgent";
  const fresh = Date.now() - new Date(alert.createdAt).getTime() < 15000;

  return (
    <article className={`security-state-card rounded-lg border p-3 transition ${fresh ? "animate-pulse ring-1 ring-smart/40" : ""} ${urgent ? "security-state-card--warning" : "security-state-card--attention"}`}>
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md ${urgent ? "security-alert-icon--warning" : "security-alert-icon--attention"}`}>
          {urgent ? <Siren className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="security-card-title text-sm font-semibold">{alert.title}</p>
          <p className="security-card-note mt-1 text-xs">{alert.detail}</p>
          <p className="security-card-meta mt-2 text-[11px]">{formatDateTime(alert.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}

function PatrolEventCard({ patrol }: { patrol: GuardPatrolEvent }) {
  const gpsWarning = patrol.isGpsVerified === false || patrol.status === "gps_violation";
  const warning = gpsWarning || patrol.isOfflineLog === true;
  return (
    <article className={`security-state-card rounded-lg border p-4 ${warning ? "security-state-card--warning" : "security-state-card--ok"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="security-card-title font-semibold">{patrol.checkpointName}</p>
          <p className="security-card-meta mt-1 text-xs">{patrol.guardName} - {formatDateTime(patrol.scannedAt)}</p>
        </div>
        <span className={`security-status-pill rounded-full px-3 py-1 text-xs font-semibold ${warning ? "security-status-pill--warning" : "security-status-pill--ok"}`}>
          {gpsWarning ? "GPS warning" : "GPS OK"}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <PatrolFact label="Distance" value={patrol.distanceMeters === undefined ? "Unknown" : `${patrol.distanceMeters}m`} />
        <PatrolFact label="Radius" value={patrol.allowedRadius === undefined ? "25m" : `${patrol.allowedRadius}m`} />
        <PatrolFact label="Status" value={patrol.status.replaceAll("_", " ")} />
        <PatrolFact label="Source" value={patrol.isOfflineLog === true ? "Offline sync" : "Live scan"} />
      </dl>
      {patrol.note ? <p className="security-card-note mt-3 text-sm">{patrol.note}</p> : null}
    </article>
  );
}

function SecurityIncidentCard({ incident }: { incident: SecurityIncident }) {
  const critical = incident.severity === "high" || incident.severity === "critical";
  return (
    <article className={`security-state-card rounded-lg border p-4 ${critical ? "security-state-card--warning" : "security-state-card--attention"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="security-card-title font-semibold">{incident.summary}</p>
          <p className="security-card-meta mt-1 text-xs">{incident.locationLabel ?? "Estate security"} - {formatDateTime(incident.openedAt)}</p>
        </div>
        <span className={`security-status-pill rounded-full px-3 py-1 text-xs font-semibold ${critical ? "security-status-pill--warning" : "security-status-pill--attention"}`}>
          {incident.severity}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <PatrolFact label="Source" value="security_incidents" />
        <PatrolFact label="Status" value={incident.status} />
        <PatrolFact label="Type" value={incident.incidentType} />
        <PatrolFact label="Reporter" value={incident.reportedByRole} />
      </dl>
      {incident.details ? <p className="security-card-note mt-3 text-sm">{incident.details}</p> : null}
    </article>
  );
}

function SosIncidentSummaryCard({ incident }: { incident: SecurityIncident }) {
  return (
    <article className={`rounded-lg border p-4 ${isActiveSosStatus(incident.status) ? "border-danger/40 bg-danger/10" : "border-white/15 bg-white/[0.08]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-white">{incident.summary}</p>
          <p className="mt-1 text-sm text-slate-300">{incident.locationLabel ?? incident.unitCode ?? "LBS View Estate"}</p>
          <p className="mt-2 text-xs text-slate-500">{formatDateTime(incident.openedAt)}</p>
        </div>
        <StatusBadge status={formatEmergencyStatus(incident.status)} tone={emergencyStatusTone(incident.status)} />
      </div>
    </article>
  );
}

function SosIncidentActionCard({
  incident,
  compact = false,
  canResolve = true,
  onAcknowledge,
  onRespond,
  onResolve,
  onFalseAlarm
}: {
  incident: SecurityIncident;
  compact?: boolean;
  canResolve?: boolean;
  onAcknowledge?: () => void;
  onRespond?: () => void;
  onResolve?: (note: string) => void;
  onFalseAlarm?: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const active = isActiveSosStatus(incident.status);
  const residentLabel = incident.residentName || "Resident";
  const unitLabel = incident.unitCode || incident.locationLabel || "Unit not recorded";

  function resolveWithNote() {
    onResolve?.(note);
    setNote("");
  }

  function falseAlarmWithNote() {
    if (window.confirm("Mark this SOS as a false alarm?")) {
      onFalseAlarm?.(note);
      setNote("");
    }
  }

  return (
    <article className={`rounded-lg border p-4 ${active ? "border-danger/40 bg-danger/10 shadow-[0_18px_40px_rgba(255,59,48,0.12)]" : "border-white/15 bg-white/[0.08]"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${active ? "bg-danger text-white" : "bg-smart/10 text-smart"}`}>
            <Siren className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">{residentLabel}</h3>
              <StatusBadge status={formatEmergencyStatus(incident.status)} tone={emergencyStatusTone(incident.status)} />
              <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-semibold text-red-100">
                {sosAlertTypeLabel(incident.alertType)}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold text-white">{unitLabel}</p>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="h-4 w-4 text-smart" />
              {incident.locationLabel ?? "Estate location"}
            </p>
            {!compact || incident.details ? <p className="mt-3 text-sm leading-6 text-slate-300">{incident.details || "No extra note provided."}</p> : null}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{timeAgo(incident.openedAt)}</span>
              <span>{formatDateTime(incident.openedAt)}</span>
              {incident.acknowledgedAt ? <span>Acknowledged {formatDateTime(incident.acknowledgedAt)}</span> : null}
              {incident.respondingAt ? <span>Responding {formatDateTime(incident.respondingAt)}</span> : null}
              {incident.resolvedAt ? <span>Closed {formatDateTime(incident.resolvedAt)}</span> : null}
            </div>
          </div>
        </div>

        {active ? (
          <div className="grid gap-2 lg:min-w-56">
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {incident.status === "open" ? (
                <Button type="button" className="min-h-9 px-3 py-1 text-xs" onClick={onAcknowledge}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Acknowledge
                </Button>
              ) : null}
              <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={onRespond}>
                Mark responding
              </Button>
            </div>
            {canResolve ? (
              <>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Resolution note" className="min-h-20 text-xs" />
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={resolveWithNote}>
                    Resolve
                  </Button>
                  <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={falseAlarmWithNote}>
                    False alarm
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CsoReviewCard({ review }: { review: CsoReview }) {
  return (
    <article className="security-state-card security-state-card--ok rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="security-card-title font-semibold">{review.decision}</p>
          <p className="security-card-meta mt-1 text-xs">Incident {review.incidentId || "pending"} - {formatDateTime(review.reviewedAt)}</p>
        </div>
        <span className="security-status-pill security-status-pill--ok rounded-full px-3 py-1 text-xs font-semibold">
          {review.status}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <PatrolFact label="Source" value="cso_reviews" />
        <PatrolFact label="CSO" value={review.csoProfileId || "Unassigned"} />
        <PatrolFact label="Follow-up" value={review.followUpDate ?? "None"} />
      </dl>
      {review.note ? <p className="security-card-note mt-3 text-sm">{review.note}</p> : null}
    </article>
  );
}

function checkpointQrPayload(checkpoint: GuardCheckpoint) {
  return checkpoint.qrToken.toUpperCase().startsWith("CP_") ? checkpoint.qrToken : `CP_${checkpoint.qrToken}`;
}

function createCheckpointQrSuffix() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

function subscribeToCsoSecurityRealtime({
  onPatrolCreate,
  onIncidentCreate
}: {
  onPatrolCreate: (patrol: GuardPatrolEvent) => void;
  onIncidentCreate: (incident: SecurityIncident) => void;
}) {
  const endpoint = normalizeRealtimeEndpoint(
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1"
  );
  const projectId = (process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "").trim();
  const databaseId = (process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? APPWRITE_ONBOARDING_DATABASE_ID).trim();

  if (!endpoint || !projectId || !databaseId || typeof WebSocket === "undefined") {
    return () => undefined;
  }

  const collectionChannels = [
    `databases.${databaseId}.collections.guard_patrol_events.documents`,
    `databases.${databaseId}.collections.security_incidents.documents`
  ];
  const tableChannels = [
    `databases.${databaseId}.tables.guard_patrol_events.rows`,
    `databases.${databaseId}.tables.security_incidents.rows`
  ];
  const params = new URLSearchParams({ project: projectId });
  [...collectionChannels, ...tableChannels].forEach((channel) => params.append("channels[]", channel));
  const socket = new WebSocket(`${endpoint}/realtime?${params.toString()}`);

  socket.addEventListener("message", (event) => {
    const message = parseRealtimeMessage(event.data);
    if (!message) {
      return;
    }

    if (message.events.some(isGuardPatrolCreateEvent)) {
      onPatrolCreate(mapRealtimePatrolEvent(message.payload));
      return;
    }

    if (message.events.some(isSecurityIncidentCreateEvent)) {
      onIncidentCreate(mapRealtimeSecurityIncident(message.payload));
    }
  });

  return () => {
    socket.close();
  };
}

function normalizeRealtimeEndpoint(endpoint: string) {
  return endpoint
    .trim()
    .replace(/^https:/i, "wss:")
    .replace(/^http:/i, "ws:")
    .replace(/\/+$/g, "");
}

function parseRealtimeMessage(data: unknown) {
  if (typeof data !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as { events?: unknown; payload?: unknown };
    return {
      events: Array.isArray(parsed.events) ? parsed.events.filter((event): event is string => typeof event === "string") : [],
      payload: parsed.payload
    };
  } catch {
    return null;
  }
}

function isGuardPatrolCreateEvent(event: string) {
  return event.includes("guard_patrol_events")
    && (event.endsWith(".create") || event.includes(".documents.") && event.includes(".create") || event.includes(".rows.") && event.includes(".create"));
}

function isSecurityIncidentCreateEvent(event: string) {
  return event.includes("security_incidents")
    && (event.endsWith(".create") || event.includes(".documents.") && event.includes(".create") || event.includes(".rows.") && event.includes(".create"));
}

function mapRealtimePatrolEvent(payload: unknown): GuardPatrolEvent {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const id = textValue(row.$id) || textValue(row.id) || `patrol-${Date.now().toString(36)}`;
  const guardId = textValue(row.guardId) || textValue(row.guardProfileId);
  const scannedAt = normalizeRealtimeTimestamp(row.scannedAt);

  return {
    id,
    estateId: textValue(row.estateId) || "lbsview-estate",
    checkpointId: textValue(row.checkpointId),
    checkpointCode: textValue(row.checkpointCode),
    checkpointName: textValue(row.checkpointName) || textValue(row.checkpointCode) || "Checkpoint",
    qrToken: textValue(row.qrToken),
    guardId,
    guardProfileId: textValue(row.guardProfileId) || guardId,
    guardName: textValue(row.guardName) || "Security Guard",
    scanType: "checkpoint",
    scannedAt,
    status: patrolStatusValue(row.status),
    deviceLatitude: optionalNumber(row.deviceLatitude),
    deviceLongitude: optionalNumber(row.deviceLongitude),
    checkpointLatitude: optionalNumber(row.checkpointLatitude),
    checkpointLongitude: optionalNumber(row.checkpointLongitude),
    allowedRadius: optionalNumber(row.allowedRadius),
    distanceMeters: optionalNumber(row.distanceMeters),
    isGpsVerified: booleanValue(row.isGpsVerified),
    isOfflineLog: booleanValue(row.isOfflineLog),
    deviceLabel: textValue(row.deviceLabel),
    note: textValue(row.note)
  };
}

function mapRealtimeSecurityIncident(payload: unknown): SecurityIncident {
  const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const id = textValue(row.$id) || textValue(row.id) || `incident-${Date.now().toString(36)}`;
  const openedAt = normalizeRealtimeTimestamp(row.openedAt);

  return {
    id,
    estateId: textValue(row.estateId) || "lbsview-estate",
    incidentType: textValue(row.incidentType) || "security",
    alertType: sosRealtimeAlertType(row.alertType),
    severity: incidentSeverityValue(row.severity),
    status: incidentStatusValue(row.status),
    reportedByRole: textValue(row.reportedByRole) || "security_guard",
    reportedByProfileId: optionalTextValue(row.reportedByProfileId),
    assignedToProfileId: optionalTextValue(row.assignedToProfileId),
    residentName: optionalTextValue(row.residentName),
    unitCode: optionalTextValue(row.unitCode),
    locationLabel: optionalTextValue(row.locationLabel),
    summary: textValue(row.summary) || "Security incident",
    details: optionalTextValue(row.details),
    openedAt,
    acknowledgedAt: optionalTextValue(row.acknowledgedAt),
    acknowledgedBy: optionalTextValue(row.acknowledgedBy),
    respondingAt: optionalTextValue(row.respondingAt),
    resolvedAt: optionalTextValue(row.resolvedAt)
  };
}

function prependUniqueById<T extends { id: string }>(current: T[], incoming: T) {
  if (current.some((item) => item.id === incoming.id)) {
    return current.map((item) => item.id === incoming.id ? incoming : item);
  }

  return [incoming, ...current];
}

function prependSecurityAlert(current: CsoSecurityAlert[], incoming: CsoSecurityAlert) {
  const merged = current.some((item) => item.sourceId === incoming.sourceId)
    ? current.map((item) => item.sourceId === incoming.sourceId ? incoming : item)
    : [incoming, ...current];

  return merged
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 20);
}

function patrolAlertFromRealtime(patrol: GuardPatrolEvent): CsoSecurityAlert {
  return {
    id: `gps-${patrol.id}`,
    sourceId: patrol.id,
    kind: "gps",
    title: "GPS violation",
    detail: `${patrol.guardName || "Security guard"} breached ${patrol.checkpointName || patrol.checkpointCode || "a checkpoint"}.`,
    createdAt: normalizeRealtimeTimestamp(patrol.scannedAt),
    severity: "warning"
  };
}

function incidentAlertFromRealtime(incident: SecurityIncident): CsoSecurityAlert {
  const isSos = incident.incidentType === "sos";
  return {
    id: `incident-${incident.id}`,
    sourceId: incident.id,
    kind: "incident",
    title: incident.summary || (isSos ? "SOS alert" : "Security incident"),
    detail: `${incident.locationLabel ?? incident.unitCode ?? "Estate security"} - ${isSos ? sosAlertTypeLabel(incident.alertType) : `${incident.severity} priority`}.`,
    createdAt: normalizeRealtimeTimestamp(incident.openedAt),
    severity: "urgent"
  };
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalTextValue(value: unknown) {
  const text = textValue(value).trim();
  return text || undefined;
}

function optionalNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeRealtimeTimestamp(value: unknown) {
  const fallback = new Date().toISOString();
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp.toISOString();
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function patrolStatusValue(value: unknown): GuardPatrolEvent["status"] {
  if (value === "verified" || value === "gps_violation" || value === "offline_pending" || value === "checkpoint_missing") {
    return value;
  }

  return "gps_violation";
}

function incidentSeverityValue(value: unknown): SecurityIncident["severity"] {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }

  return "medium";
}

function incidentStatusValue(value: unknown): SecurityIncident["status"] {
  if (value === "open" || value === "acknowledged" || value === "responding" || value === "resolved" || value === "false_alarm" || value === "closed") {
    return value;
  }

  return "open";
}

function sosRealtimeAlertType(value: unknown): SecurityIncident["alertType"] {
  if (value === "panic" || value === "medical" || value === "fire" || value === "security" || value === "other") {
    return value;
  }

  return undefined;
}

function buildCheckpointQrToken(checkpointName: string, suffix = createCheckpointQrSuffix()) {
  const slug = checkpointName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 24) || "CHECKPOINT";

  return `CP_${slug}_${suffix}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function CheckpointCard({
  checkpoint,
  onRename
}: {
  checkpoint: GuardCheckpoint;
  onRename: (checkpointId: string, checkpointName: string) => Promise<GuardCheckpoint>;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(checkpoint.checkpointName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const qrPayload = checkpointQrPayload(checkpoint);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrPayload, {
      margin: 2,
      scale: 6,
      color: {
        dark: "#111827",
        light: "#ffffff"
      }
    })
      .then((value) => {
        if (active) {
          setQrDataUrl(value);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl("");
        }
      });

    return () => {
      active = false;
    };
  }, [qrPayload]);

  useEffect(() => {
    setName(checkpoint.checkpointName);
  }, [checkpoint.checkpointName]);

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const updated = await onRename(checkpoint.id, name);
      setName(updated.checkpointName);
      setEditing(false);
      setMessage("Renamed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rename failed.");
    } finally {
      setSaving(false);
    }
  }

  function printQrCode() {
    if (!qrDataUrl) {
      setMessage("QR is still loading.");
      return;
    }

    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) {
      setMessage("Allow popups to print this QR code.");
      return;
    }

    const safeName = escapeHtml(checkpoint.checkpointName);
    const safePayload = escapeHtml(qrPayload);
    printWindow.document.write(`
      <html>
        <head>
          <title>${safeName} QR</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; text-align: center; }
            img { width: 280px; height: 280px; }
            h1 { font-size: 22px; margin: 12px 0 6px; }
            p { font-size: 14px; margin: 6px 0; }
            .token { font-family: monospace; font-size: 18px; font-weight: 700; }
          </style>
        </head>
        <body>
          <img src="${qrDataUrl}" alt="Checkpoint QR" loading="lazy" />
          <h1>${safeName}</h1>
          <p class="token">${safePayload}</p>
          <p>LBS View Estate Guard Tour Checkpoint</p>
          <script>window.onload = () => { window.print(); window.close(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{checkpoint.checkpointName}</p>
          <p className="mt-1 font-mono text-xs text-smart">{qrPayload}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${checkpoint.status === "active" ? "bg-smart/15 text-smart" : "bg-white/10 text-slate-300"}`}>
            {checkpoint.status}
          </span>
          <Button type="button" variant="secondary" className="min-h-8 px-2.5 py-1 text-xs" onClick={() => setEditing((value) => !value)}>
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </Button>
          <Button type="button" variant="secondary" className="min-h-8 px-2.5 py-1 text-xs" onClick={printQrCode}>
            <Download className="h-3.5 w-3.5" />
            Print QR
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="rounded-lg border border-white/10 bg-white p-2">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`QR code for ${checkpoint.checkpointName}`} className="aspect-square w-full rounded-md object-contain" src={qrDataUrl} loading="lazy" decoding="async" />
          ) : (
            <div className="grid aspect-square place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-500">
              QR loading
            </div>
          )}
        </div>
        <div className="grid content-start gap-3">
          <p className="rounded-lg border border-smart/20 bg-smart/10 px-3 py-2 font-mono text-xs text-smart">
            QR payload: {qrPayload}
          </p>
          {editing ? (
            <form className="grid gap-2" onSubmit={submitRename}>
              <Field label="Checkpoint name">
                <Input value={name} onChange={(event) => setName(event.target.value)} required />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button disabled={saving} type="submit">
                  <Pencil className="h-4 w-4" />
                  {saving ? "Saving" : "Save name"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => {
                  setName(checkpoint.checkpointName);
                  setEditing(false);
                  setMessage("");
                }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          {message ? <p className="text-xs text-smart">{message}</p> : null}
        </div>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <PatrolFact label="Code" value={checkpoint.checkpointCode} />
        <PatrolFact label="Radius" value={`${checkpoint.allowedRadius}m`} />
        <PatrolFact label="Latitude" value={checkpoint.latitude?.toString() ?? "Unset"} />
        <PatrolFact label="Longitude" value={checkpoint.longitude?.toString() ?? "Unset"} />
      </dl>
      {checkpoint.locationLabel ? <p className="mt-3 text-sm text-slate-300">{checkpoint.locationLabel}</p> : null}
    </article>
  );
}

function PatrolFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3">
      <dt className="security-card-meta">{label}</dt>
      <dd className="security-card-value min-w-0 break-words">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Unknown time";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: LAGOS_TIME_ZONE
  }).format(date);
}

export function EmergencyAlertsPage({ audience = "security" }: { audience?: "security" | "admin" | "cso" }) {
  return <EmergencyAlertsFlow audience={audience} />;
}

function EmergencyAlertsFlow({ audience = "security" }: { audience?: "security" | "admin" | "cso" }) {
  const [alerts, setAlerts] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const activeAlerts = alerts.filter((alert) => isActiveSosStatus(alert.status));
  const resolvedToday = alerts.filter((alert) => isClosedSosStatus(alert.status) && isWithinLastHours(alert.resolvedAt ?? alert.openedAt, 24));
  const historyAlerts = alerts.filter((alert) => isClosedSosStatus(alert.status) && !isWithinLastHours(alert.resolvedAt ?? alert.openedAt, 24));
  const canResolve = audience !== "security";

  useEffect(() => {
    let active = true;

    async function loadAlerts() {
      try {
        const incidents = await readAppwriteAdminSosIncidents();
        if (!active) return;
        setAlerts(incidents);
        setMessage("SOS alerts are synced.");
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Unable to load SOS alerts.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAlerts();
    const interval = window.setInterval(loadAlerts, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToCsoSecurityRealtime({
      onPatrolCreate: () => undefined,
      onIncidentCreate: (incident) => {
        if (incident.incidentType !== "sos") {
          return;
        }

        setAlerts((current) => prependUniqueById(current, incident).sort(sortSecurityIncidentsNewestFirst));
        setMessage(`New SOS alert received: ${incident.summary}`);
        notifySosIncident(incident);
        flashSosBrowserTitle();
      }
    });

    return unsubscribe;
  }, []);

  async function changeAlertStatus(alert: SecurityIncident, status: SosUpdateInput["status"], note = "") {
    if (!canResolve && (status === "resolved" || status === "false_alarm")) {
      setMessage("Security guards can acknowledge and respond. Resolution requires CSO or admin.");
      return;
    }

    try {
      const updated = await updateAppwriteSosIncident({
        incidentId: alert.id,
        status,
        note
      });
      setAlerts((current) => prependUniqueById(current, updated).sort(sortSecurityIncidentsNewestFirst));
      setMessage(`${updated.summary} marked as ${formatEmergencyStatus(updated.status)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SOS alert could not be updated.");
    }
  }

  return (
    <>
      <PageHeader
        title={audience === "admin" ? "Estate SOS alerts" : "Security SOS console"}
        description="Monitor panic alerts, view resident house/location, acknowledge response, and close incidents after action."
      >
        <Link href={audience === "admin" ? "/admin" : audience === "cso" ? "/cso" : "/security"}>
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </PageHeader>

      <SosAlertSoundControl activeAlerts={activeAlerts} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatCard label="Active alerts" value={String(activeAlerts.length)} helper="Needs immediate response" icon={<Siren className="h-5 w-5" />} />
        <StatCard label="Responding" value={String(alerts.filter((alert) => alert.status === "responding").length)} helper="Security has started response" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Closed today" value={String(resolvedToday.length)} helper="Resolved or false alarm" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {loading ? (
        <div className="mt-6 grid gap-3">
          {visitorLoadingRows(3).map((row, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.08]" />
          ))}
        </div>
      ) : null}

      {activeAlerts.length ? (
        <Card className="mt-6 border-danger/40 bg-danger/10">
          <CardHeader
            title="Active response required"
            description="Gate/security should call or dispatch response to the listed house immediately."
          />
          <div className="grid gap-4">
            {activeAlerts.map((alert) => (
              <SosIncidentActionCard
                key={alert.id}
                incident={alert}
                canResolve={canResolve}
                onAcknowledge={() => void changeAlertStatus(alert, "acknowledged")}
                onRespond={() => void changeAlertStatus(alert, "responding")}
                onResolve={(note) => void changeAlertStatus(alert, "resolved", note)}
                onFalseAlarm={(note) => void changeAlertStatus(alert, "false_alarm", note)}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader
          title="Incident log"
          description="All SOS incidents remain logged for security reports and estate follow-up."
        />
        {message ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
        <div className="grid gap-3">
          {resolvedToday.length ? (
            resolvedToday.map((alert) => (
              <SosIncidentActionCard
                key={alert.id}
                incident={alert}
                compact
                canResolve={canResolve}
                onAcknowledge={() => void changeAlertStatus(alert, "acknowledged")}
                onRespond={() => void changeAlertStatus(alert, "responding")}
                onResolve={(note) => void changeAlertStatus(alert, "resolved", note)}
                onFalseAlarm={(note) => void changeAlertStatus(alert, "false_alarm", note)}
              />
            ))
          ) : (
            <div className="rounded-lg border border-white/15 bg-white/[0.08] p-4 text-sm text-slate-300">
              No resolved SOS incidents today.
            </div>
          )}
        </div>
      </Card>

      {historyAlerts.length ? (
        <details className="mt-6 rounded-lg border border-white/10 bg-white/[0.05] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-white">Older SOS history ({historyAlerts.length})</summary>
          <div className="mt-4 grid gap-3">
            {historyAlerts.map((alert) => (
              <SosIncidentSummaryCard key={alert.id} incident={alert} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

export function VerifyVisitorPage({ compact = false }: { compact?: boolean }) {
  const { state } = useLocalEstateStore();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [tourMessage, setTourMessage] = useState("");
  const [tourMessageTone, setTourMessageTone] = useState<"ok" | "warn" | "error">("ok");
  const [lookupResident, setLookupResident] = useState<Resident | null>(null);
  const [lookupVisitor, setLookupVisitor] = useState<Visitor | null>(null);
  const [searching, setSearching] = useState(false);
  const [savingTour, setSavingTour] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const autoVerifiedVisitors = useRef(new Set<string>());
  const lastAutoSearchCode = useRef("");
  const found = code.length === 6 ? findVisitorForCode(code) : undefined;
  const residentsDirectory = lookupResident
    ? [lookupResident, ...state.residents.filter((resident) => resident.id !== lookupResident.id)]
    : state.residents;

  function findVisitorForCode(targetCode: string) {
    return lookupVisitor?.code === targetCode ? lookupVisitor : undefined;
  }

  useEffect(() => {
    if (code.length < 6) {
      setLookupResident(null);
      setLookupVisitor(null);
      setMessage("");
      setHasSearched(false);
    }
  }, [code]);

  useEffect(() => {
    if (code.length !== 6 || !found || found.status !== "pending") {
      return;
    }

    void autoVerifyPendingVisitor(found);
  }, [code, found]);

  useEffect(() => installGuardTourSync(), []);

  function handleCodeChange(value: string) {
    const nextCode = value.replace(/\D/g, "").slice(0, 6);
    setCode(nextCode);

    if (nextCode.length < 6) {
      lastAutoSearchCode.current = "";
      return;
    }

    if (nextCode === lastAutoSearchCode.current) {
      return;
    }

    lastAutoSearchCode.current = nextCode;
    setSearching(true);
    setHasSearched(true);
    setMessage("Searching visitor records...");
    window.setTimeout(() => void verifyCode(nextCode), 0);
  }

  async function verifyCode(nextCode = code) {
    const targetCode = nextCode.replace(/\D/g, "").slice(0, 6);
    setCode(targetCode);
    setHasSearched(true);
    if (targetCode.length !== 6) {
      setMessage("Enter the full 6-digit visitor code.");
      return;
    }

    const matchedVisitor = findVisitorForCode(targetCode);
    if (matchedVisitor) {
      if (matchedVisitor.status === "pending") {
        void autoVerifyPendingVisitor(matchedVisitor);
        return;
      }

      setMessage(gateLookupMessage(matchedVisitor));
      if (shouldExpireVisitor(matchedVisitor)) {
        void persistVisitorStatus(matchedVisitor, "expired");
      }
      return;
    }

    setSearching(true);
    setMessage("Searching visitor records...");

    try {
      const result = await findAppwriteVisitorByCode(targetCode);
      loadVisitorLookup(result.visitor, result.resident);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No valid visitor invitation found for this code.");
    } finally {
      setSearching(false);
    }
  }

  async function handleVisitorQrScan(rawValue: string) {
    if (isGuardCheckpointQr(rawValue)) {
      setSavingTour(true);
      setTourMessage("Checkpoint scanned. Checking GPS and saving patrol log...");
      setTourMessageTone("ok");

      try {
        const result = await submitGuardCheckpointScan(rawValue);
        setTourMessage(result.message);
        setTourMessageTone(result.offline ? "warn" : result.ok ? "ok" : "error");
        void syncPendingTourLogs();
      } catch (error) {
        setTourMessage(error instanceof Error ? error.message : "Checkpoint scan could not be saved.");
        setTourMessageTone("error");
      } finally {
        setSavingTour(false);
      }

      return;
    }

    try {
      const payload = parseVisitorQrPayload(rawValue);
      if (payload) {
        loadVisitorLookup(payload.visitor, payload.resident);
        return;
      }
    } catch {
      setHasSearched(true);
      setMessage("Scanned QR invitation could not be read. Enter the 6-digit code or regenerate the visitor invitation.");
      return;
    }

    const scannedCode = extractVisitorCode(rawValue);
    if (!scannedCode) {
      setHasSearched(true);
      setMessage("Scanned QR does not contain a 6-digit visitor access code.");
      return;
    }

    void verifyCode(scannedCode);
  }

  function loadVisitorLookup(visitor: Visitor, resident: Resident | null) {
    let nextVisitor = visitor;
    const windowState = getVisitorWindowState(visitor);

    if (visitor.status === "pending") {
      if (!windowState.canVerifyOrCheckIn) {
        nextVisitor = windowState.status === "expired" ? { ...visitor, status: "expired" } : visitor;
        setMessage(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`);
      } else {
        nextVisitor = { ...visitor, status: "verified" };
        setMessage(`${visitor.visitorName} found and verified. Use Check in when entry is approved.`);
        void persistVisitorStatus(visitor, "verified").catch(() => {
          setLookupVisitor((current) => current?.id === visitor.id ? visitor : current);
          setMessage("Visitor was found, but verification could not be saved online. Try again.");
        });
      }
    } else {
      setMessage(gateLookupMessage(visitor));
    }

    setLookupVisitor(nextVisitor);
    setLookupResident(resident);
    setCode(nextVisitor.code);
    setHasSearched(true);
  }

  async function autoVerifyPendingVisitor(visitor: Visitor) {
    if (visitor.status !== "pending") {
      return;
    }

    const windowState = getVisitorWindowState(visitor);
    if (!windowState.canVerifyOrCheckIn) {
      if (windowState.status === "expired") {
        await persistVisitorStatus(visitor, "expired");
      }

      setHasSearched(true);
      setMessage(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`);
      return;
    }

    const key = `${visitor.id}:${visitor.code}`;
    if (autoVerifiedVisitors.current.has(key)) {
      return;
    }

    autoVerifiedVisitors.current.add(key);
    const optimistic = { ...visitor, status: "verified" as const };
    setLookupVisitor((current) => current?.id === visitor.id ? optimistic : current);
    setHasSearched(true);
    setMessage(`${visitor.visitorName} found and verified. Use Check in when entry is approved.`);

    try {
      const updated = await persistVisitorStatus(visitor, "verified");
      setLookupVisitor((current) => current?.id === visitor.id ? updated : current);
    } catch (error) {
      setLookupVisitor((current) => current?.id === visitor.id ? visitor : current);
      setHasSearched(true);
      setMessage(error instanceof Error ? error.message : "Visitor status could not be updated online.");
    }
  }

  async function changeStatus(visitor: Visitor, status: Visitor["status"]) {
    if ((status === "verified" || status === "checked-in") && !getVisitorWindowState(visitor).canVerifyOrCheckIn) {
      const windowState = getVisitorWindowState(visitor);
      if (windowState.status === "expired") {
        await persistVisitorStatus(visitor, "expired");
      }
      setMessage(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`);
      return;
    }

    const previousVisitor = visitor;
    const optimisticVisitor = {
      ...visitor,
      status,
      updatedAt: new Date().toISOString()
    };
    setLookupVisitor((current) => current?.id === visitor.id ? optimisticVisitor : current);
    setMessage(`${visitor.visitorName} is now ${status}.`);

    try {
      const updated = await persistVisitorStatus(visitor, status);
      setLookupVisitor((current) => current?.id === visitor.id ? updated : current);
      setMessage(`${visitor.visitorName} is now ${status}.`);
    } catch (error) {
      setLookupVisitor((current) => current?.id === visitor.id ? previousVisitor : current);
      setMessage(error instanceof Error ? error.message : "Visitor status could not be updated online.");
    }
  }

  async function persistVisitorStatus(visitor: Visitor, status: Visitor["status"]) {
    return saveAppwriteVisitorStatus(visitor, status);
  }

  return (
    <>
      {!compact ? <PageHeader title="Verify visitor code" description="Scan or enter the 6-digit code." /> : null}
      <Card>
        <CardHeader title="Code verification" description="Scan QR or enter code." />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Field label="Access code">
              <Input
                value={code}
                onChange={(event) => handleCodeChange(event.target.value)}
                className="font-mono"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]*"
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button className="w-full sm:w-auto" onClick={() => void verifyCode()} disabled={searching}>
              <Search className="h-4 w-4" />
              {searching ? "Searching..." : "Search code"}
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setScannerOpen(true)}>
              <Camera className="h-4 w-4" />
              Scan QR
            </Button>
          </div>
        </div>
        <QrScannerPanel
          active={scannerOpen}
          title="Scan QR"
          helper={savingTour ? "Saving checkpoint scan..." : "Camera ready. Scanning QR code."}
          onResult={(value) => void handleVisitorQrScan(value)}
          onClose={() => setScannerOpen(false)}
        />
        <div className="mt-5">
          {tourMessage ? <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${guardTourMessageClassName(tourMessageTone)}`}>{tourMessage}</p> : null}
          {message ? <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${visitorLookupMessageClassName(message)}`}>{message}</p> : null}
          {found ? (
          <VisitorVerificationCard
              visitor={found}
              residentsDirectory={residentsDirectory}
              onCheckIn={() => void changeStatus(found, "checked-in")}
              onCheckOut={() => void changeStatus(found, "checked-out")}
              onReject={() => void changeStatus(found, "cancelled")}
            />
          ) : hasSearched && !message ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">No valid visitor invitation found for this code.</div>
          ) : null}
        </div>
      </Card>
    </>
  );
}

function QrScannerPanel({
  active,
  title,
  helper,
  onResult,
  onClose
}: {
  active: boolean;
  title: string;
  helper: string;
  onResult: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [message, setMessage] = useState(helper);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage(helper);
        return;
      }

      try {
        const stream = await openQrCamera();

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
        setMessage(helper);

        const scanFrame = async () => {
          if (cancelled) {
            return;
          }

          const video = videoRef.current;
          if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const rawValue = await readQrValueFromVideo(video, canvasRef, detector);

            if (rawValue) {
              onResult(rawValue);
              onClose();
              return;
            }
          }

          frameRef.current = window.requestAnimationFrame(scanFrame);
        };

        frameRef.current = window.requestAnimationFrame(scanFrame);
      } catch {
        setMessage(helper);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      frameRef.current = null;
    };
  }, [active, helper, onClose, onResult]);

  if (!active) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black p-4 shadow-glow sm:static sm:mt-4 sm:rounded-lg sm:border sm:border-smart/30">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <Button type="button" variant="ghost" className="min-h-9 px-3" onClick={onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-white/15 bg-ink">
        <video ref={videoRef} className="h-[62vh] w-full object-cover sm:aspect-[4/3] sm:h-auto" muted playsInline />
      </div>
      {message ? <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">{message}</p> : null}
    </div>
  );
}

async function openQrCamera() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } }
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true
    });
  }
}

async function readQrValueFromVideo(
  video: HTMLVideoElement,
  canvasRef: { current: HTMLCanvasElement | null },
  detector: BarcodeDetectorInstance | null
) {
  if (detector) {
    try {
      const codes = await detector.detect(video);
      const rawValue = codes[0]?.rawValue?.trim();
      if (rawValue) {
        return rawValue;
      }
    } catch {
      // Fall back to canvas decoding if native detection fails on this browser.
    }
  }

  return readQrValueFromCanvas(video, canvasRef);
}

function readQrValueFromCanvas(video: HTMLVideoElement, canvasRef: { current: HTMLCanvasElement | null }) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    return "";
  }

  const canvas = canvasRef.current ?? document.createElement("canvas");
  canvasRef.current = canvas;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return "";
  }

  context.drawImage(video, 0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  return jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" })?.data.trim() ?? "";
}

function visitorQrValueFor(visitor: Visitor) {
  return visitor.code;
}

function parseVisitorQrPayload(value: string): VisitorQrPayload | null {
  const trimmed = value.trim();
  const encoded = trimmed.startsWith("corso-visitor:")
    ? trimmed.slice("corso-visitor:".length)
    : "";
  const rawPayload = encoded ? base64UrlDecode(encoded) : trimmed.startsWith("{") ? trimmed : "";

  if (!rawPayload) {
    return null;
  }

  const payload = JSON.parse(rawPayload) as Partial<VisitorQrPayload>;
  if (
    payload.type !== "corso.visitor.invitation" ||
    payload.version !== 1 ||
    !payload.visitor?.code ||
    !payload.resident?.id
  ) {
    return null;
  }

  return payload as VisitorQrPayload;
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function extractVisitorCode(value: string) {
  return value.match(/\b\d{6}\b/)?.[0] ?? "";
}

function visitorLookupMessageClassName(message: string) {
  const lowerMessage = message.toLowerCase();
  const isError = lowerMessage.includes("no valid")
    || lowerMessage.includes("could not")
    || lowerMessage.includes("expired")
    || lowerMessage.includes("cancelled")
    || lowerMessage.includes("enter the full")
    || lowerMessage.includes("does not contain");

  return isError
    ? "border border-danger/30 bg-danger/10 text-danger"
    : "border border-smart/30 bg-smart/10 text-smart";
}

function guardTourMessageClassName(tone: "ok" | "warn" | "error") {
  if (tone === "warn") {
    return "border border-warn/30 bg-warn/10 text-warn";
  }

  if (tone === "error") {
    return "border border-danger/30 bg-danger/10 text-danger";
  }

  return "border border-smart/30 bg-smart/10 text-smart";
}

function gateLookupMessage(visitor: Visitor) {
  if (visitor.status === "cancelled") {
    return "This visitor code has been cancelled.";
  }

  if (visitor.status === "expired") {
    return "This visitor code has expired.";
  }

  if (visitor.status === "checked-in") {
    return `${visitor.visitorName} is already checked in. Use Check out when the visitor leaves.`;
  }

  if (visitor.status === "checked-out") {
    return `${visitor.visitorName} has already checked out.`;
  }

  const windowState = getVisitorWindowState(visitor);
  if (visitor.status === "verified") {
    return `${visitor.visitorName} is verified. Use Check in when entry is approved. ${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`;
  }

  return `${visitor.visitorName} found. ${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`;
}

function shouldExpireVisitor(visitor: Visitor) {
  return !["checked-in", "checked-out", "cancelled", "expired"].includes(visitor.status)
    && getVisitorWindowState(visitor).status === "expired";
}

export function ExpectedVisitorsPage() {
  const { visitorViews, setVisitorViews, loadingVisitors, visitorError, refreshVisitors } = useLiveVisitorViews(readAppwriteExpectedVisitors);
  const [actionMessage, setActionMessage] = useState("");

  async function checkInVisitor(visitor: Visitor) {
    setActionMessage(`${visitor.visitorName} checked in. Syncing...`);
    const optimistic = { ...visitor, status: "checked-in" as const, updatedAt: new Date().toISOString() };
    setVisitorViews((current) => current.map((view) =>
      view.visitor.id === visitor.id ? { ...view, visitor: optimistic } : view
    ));

    try {
      const updated = await saveAppwriteVisitorStatus(visitor, "checked-in");
      setVisitorViews((current) => current.map((view) =>
        view.visitor.id === visitor.id ? { ...view, visitor: updated } : view
      ));
      setActionMessage(`${visitor.visitorName} checked in.`);
    } catch (error) {
      setVisitorViews((current) => current.map((view) =>
        view.visitor.id === visitor.id ? { ...view, visitor } : view
      ));
      setActionMessage(error instanceof Error ? error.message : "Check-in could not be saved online.");
    }
  }

  return (
    <>
      <PageHeader title="Today's expected visitors" description="Visitor list for security guards to prepare gate checks.">
        <Button type="button" variant="secondary" onClick={() => void refreshVisitors()} disabled={loadingVisitors}>
          <RefreshCw className="h-4 w-4" />
          {loadingVisitors ? "Loading" : "Refresh"}
        </Button>
      </PageHeader>
      {visitorError ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{visitorError}</p> : null}
      {actionMessage ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{actionMessage}</p> : null}
      <LiveVisitorCards
        title={loadingVisitors ? "Loading expected visitors" : "Expected visitors"}
        visitorViews={visitorViews}
        loading={loadingVisitors}
        error={visitorError}
        showResident
        actionFor={(visitor) => (
          <Button
            className="min-h-11 w-full px-3 py-2 text-xs sm:w-auto"
            disabled={visitor.status === "checked-in" || visitor.status === "checked-out" || visitor.status === "cancelled" || visitor.status === "expired"}
            onClick={() => void checkInVisitor(visitor)}
          >
            Check in
          </Button>
        )}
      />
    </>
  );
}

export function EntryLogsPage() {
  const { visitorViews, loadingVisitors, visitorError } = useLiveVisitorViews(readAppwriteSecurityVisitorHistory);
  const sortedVisitorViews = [...visitorViews].sort((left, right) => visitorSortTime(right.visitor) - visitorSortTime(left.visitor));
  const movementRows = loadingVisitors
    ? visitorLoadingRows(6)
    : sortedVisitorViews.length
      ? sortedVisitorViews.map(({ visitor, residentName, unitCode }) => [
        visitor.visitorName,
        <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
        `${visitor.visitDate} ${formatClockTime(visitor.arrivalTime)}`,
        residentName,
        unitCode,
        <StatusBadge key={visitor.status} status={visitor.status} />
      ])
      : [["No visitor records yet", "—", "—", "—", "—", "—"]];

  return (
    <>
      <PageHeader title="Check-in and check-out logs" description="Record entry and exit times, guard names, and visitor movement." />
      {visitorError ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{visitorError}</p> : null}
      <DataTable
        title={loadingVisitors ? "Loading gate movement logs" : "Gate movement logs"}
        description="Live visitor movement from Appwrite visitor records."
        headers={["Visitor", "Code", "Visit time", "Resident", "Unit", "Status"]}
        rows={movementRows}
      />
    </>
  );
}

export function VerifyDigitalIdPage() {
  const [idNumber, setIdNumber] = useState("LBS-LDI01B-0010");
  const [message, setMessage] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  function verifyId() {
    if (!idNumber.trim()) {
      setMessage("Enter a digital ID number to verify.");
      return;
    }

    setMessage(`${idNumber.toUpperCase()} is active. Confirm face and house number before allowing estate access.`);
  }

  function handleDigitalIdScan(rawValue: string) {
    const scannedId = rawValue.trim().toUpperCase();
    if (!scannedId) {
      setMessage("Scanned QR does not contain a digital ID number.");
      return;
    }

    setIdNumber(scannedId);
    setMessage(`${scannedId} scanned. Tap Verify ID to confirm status.`);
  }

  return (
    <>
      <PageHeader title="Verify digital ID" description="Security can search resident, staff, vendor, and domestic worker ID status." />
      <Card>
        <CardHeader title="ID status check" description="Limited access for gate security. Billing and complaints are hidden from this role." />
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <Field label="Digital ID number"><Input value={idNumber} onChange={(event) => setIdNumber(event.target.value)} className="font-mono uppercase" /></Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Button className="w-full sm:w-auto" onClick={verifyId}><IdCard className="h-4 w-4" />Verify ID</Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setScannerOpen(true)}><Camera className="h-4 w-4" />Scan QR</Button>
          </div>
        </div>
        <QrScannerPanel
          active={scannerOpen}
          title="Scan digital ID QR"
          helper="Point the camera at a resident, staff, vendor, or security ID QR code."
          onResult={handleDigitalIdScan}
          onClose={() => setScannerOpen(false)}
        />
        <div className="mt-5 grid gap-6 lg:grid-cols-[0.8fr_1fr]">
          <DigitalIdCard name="Resident User" role="Resident" estate="LBS View Estate" house="Pending assignment" idNumber={idNumber} status="active" />
          <div className="rounded-lg border border-smart/30 bg-smart/10 p-4 text-sm leading-6 text-smart">
            {message || "Enter an ID number and click Verify ID to check access status."}
          </div>
        </div>
      </Card>
    </>
  );
}

export function MarketplacePage() {
  const categories = ["Groceries", "Cleaning services", "Laundry", "Repairs", "Food vendors", "Estate-approved merchants"];
  return (
    <>
      <PageHeader title="Estate Marketplace" description="A version 2 marketplace placeholder for estate-approved services and merchants.">
        <Link href="/resident">
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Button>
        </Link>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <Card key={category}>
            <Store className="h-6 w-6 text-smart" />
            <h2 className="mt-5 text-lg font-semibold text-white">{category}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Coming soon. Admin approval, vendor onboarding, and resident ordering can be added later.</p>
            <StatusBadge status="coming soon" tone="blue" />
          </Card>
        ))}
      </div>
    </>
  );
}

function EstateComposer({ onCreateEstate }: { onCreateEstate: (input: Omit<Estate, "id">) => Estate }) {
  const [message, setMessage] = useState("");

  function submitEstate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const estate = onCreateEstate({
      name: String(form.get("name") ?? ""),
      address: String(form.get("address") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? ""),
      contactPhone: String(form.get("contactPhone") ?? ""),
      gateName: String(form.get("gateName") ?? "Main Gate")
    });

    setMessage(`${estate.name} has been created. You can now assign admins, residents, billing, and access rules to it.`);
    event.currentTarget.reset();
  }

  return (
    <Card id="create-estate" className="mb-6 scroll-mt-24">
      <CardHeader title="Create estate" description="Set up a new estate record. Super Admin controls all estates; Estate Admins are assigned per estate." />
      <form className="grid gap-4" onSubmit={submitEstate}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Estate name"><Input name="name" placeholder="Example: LBS View Estate Phase 2" required /></Field>
          <Field label="Security gate name"><Input name="gateName" placeholder="Main Gate A" required /></Field>
          <Field label="Contact email"><Input name="contactEmail" type="email" placeholder="admin@estate.com" required /></Field>
          <Field label="Contact phone"><Input name="contactPhone" placeholder="+234 801 000 0000" required /></Field>
        </div>
        <Field label="Address"><Textarea name="address" placeholder="Estate address" required /></Field>
        {message ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
        <Button className="w-fit"><Building2 className="h-4 w-4" />Create estate</Button>
      </form>
    </Card>
  );
}

function BillsTable({
  title,
  rows,
  state,
  residentsDirectory,
  admin = false,
  onMarkPaid
}: {
  title: string;
  rows: Bill[];
  state: LocalEstateState;
  residentsDirectory: Resident[];
  admin?: boolean;
  onMarkPaid?: (billId: string) => void;
}) {
  return (
    <DataTable
      title={title}
      headers={["Bill", "Unit", "Resident", "Expected", "Paid", "Outstanding", "Credit", "Status", "Action"]}
      rows={rows.map((bill) => {
        const resident = residentsDirectory.find((item) => item.id === bill.residentId);
        const paid = billPaidAmount(state, bill);
        const outstanding = billOutstandingAmount(state, bill);
        const credit = billCreditAmount(state, bill);
        const status = credit > 0 ? "Credit" : bill.status;

        return [
        <div key={`${bill.id}-title`}>
          <p className="font-medium text-white">{bill.title}</p>
          <p className="text-xs text-slate-500">{bill.category ?? "Service charge"} - Due {bill.dueDate}</p>
        </div>,
        resident ? residentUnitLabel(state, resident) : bill.unitId ?? "All units",
        resident?.name ?? "All residents",
        money(bill.amount),
        money(paid),
        money(outstanding),
        money(credit),
        <StatusBadge key={status} status={status} />,
        admin ? (
          <Button key="confirm" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => onMarkPaid?.(bill.id)}>
            Mark paid
          </Button>
        ) : (
          <Link key="proof" href="/resident/payments">
            <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs">Pay online</Button>
          </Link>
        )
      ];
      })}
    />
  );
}

function BillComposer({
  onCreated,
  state,
  residentsDirectory
}: {
  onCreated: () => void;
  state: LocalEstateState;
  residentsDirectory: Resident[];
}) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    const residentId = String(form.get("residentId") ?? residentsDirectory[0]?.id ?? "");
    const resident = residentsDirectory.find((item) => item.id === residentId);
    if (!resident) {
      setMessage("Load Appwrite residents before creating a bill.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/appwrite/admin/accounting", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "create_bill",
          residentId,
          title: String(form.get("title") ?? ""),
          category: String(form.get("category") ?? "Subscription"),
          amount: Number(form.get("amount") ?? 0),
          dueDate: String(form.get("dueDate") ?? "")
        })
      });
      const payload = await response.json().catch(() => null) as { bill?: Bill; error?: string } | null;
      if (!response.ok || !payload?.bill) {
        throw new Error(payload?.error ?? "Bill could not be created in Appwrite.");
      }

      setMessage(`${payload.bill.title} saved to Appwrite.`);
      formElement.reset();
      onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bill could not be created in Appwrite.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card id="create-bill" className="scroll-mt-24">
      <CardHeader title="Create bill" description="Assign a service charge, security levy, waste fee, power levy, maintenance fee, or custom charge." />
      <form onSubmit={submitBill}>
        <div className="grid gap-4 md:grid-cols-5">
          <Field label="Title"><Input name="title" defaultValue="Subscription" required /></Field>
          <Field label="Category">
            <Select name="category" defaultValue="Subscription">
              <option>Subscription</option>
              <option>Service charge</option>
              <option>Security levy</option>
              <option>Waste management</option>
              <option>Power/infrastructure levy</option>
              <option>Maintenance fee</option>
            </Select>
          </Field>
          <Field label="Amount"><Input name="amount" type="number" placeholder="4000" min={1} required /></Field>
          <Field label="Due date"><Input name="dueDate" type="date" defaultValue={dateInputValue()} required /></Field>
          <Field label="Resident / unit">
            <Select name="residentId" defaultValue={residentsDirectory[0]?.id ?? ""}>
              {residentsDirectory.length ? (
                residentsDirectory.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.name} - {residentUnitLabel(state, resident)}
                  </option>
                ))
              ) : (
                <option value="">No residents available</option>
              )}
            </Select>
          </Field>
        </div>
        {message ? <p className="mt-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
        <Button className="mt-5" disabled={saving || !residentsDirectory.length}>{saving ? "Creating bill" : "Create bill"}</Button>
      </form>
    </Card>
  );
}

function Progress({ label, value, max, tone = "bg-smart" }: { label: string; value: number; max: number; tone?: string }) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex justify-between gap-4 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">{money(value)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ActionRow({ icon, title, helper }: { icon: ReactNode; title: string; helper: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-line bg-ink/50 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-smart/10 text-smart">{icon}</div>
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-400">{helper}</p>
      </div>
    </div>
  );
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some browsers expose Clipboard API but still block it outside strict user gestures.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function SosAlertSoundControl({
  activeAlerts,
  compact = false
}: {
  activeAlerts: Array<{ id: string }>;
  compact?: boolean;
}) {
  const { enabled, message, enableSound, disableSound, testSound } = useSosAlertSound(activeAlerts);
  const hasActiveAlert = activeAlerts.length > 0;

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${
        hasActiveAlert
          ? "border-danger/40 bg-danger/10 shadow-[0_18px_40px_rgba(255,59,48,0.12)]"
          : "border-white/15 bg-white/[0.08]"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${enabled ? "bg-smart text-ink" : "bg-white/10 text-slate-200"}`}>
            <Volume2 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              SOS alert sound {enabled ? "enabled" : "off"}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {enabled
                ? hasActiveAlert
                  ? "This device will ring through its speaker while an active SOS is waiting."
                  : "This device is ready to ring when a new SOS alert comes in."
                : "Enable once on this security/admin device so active SOS alerts can ring through the speaker while the app is open."}
            </p>
            {!compact || message ? (
              <p className="mt-2 text-xs text-slate-400">
                {message || (enabled ? "Sound will keep ringing every few seconds while alerts remain active." : "Browser rules require one tap before sound can play.")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={disableSound}>
              Disable sound
            </Button>
          ) : (
            <Button type="button" className="min-h-9 px-3 py-1 text-xs" onClick={() => void enableSound()}>
              <BellRing className="h-3.5 w-3.5" />
              Enable alert sound
            </Button>
          )}
          <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => void testSound()}>
            Test sound
          </Button>
        </div>
      </div>
    </div>
  );
}

function useSosAlertSound(activeAlerts: Array<{ id: string }>) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const activeAlertKey = activeAlerts.map((alert) => alert.id).join("|");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setEnabled(window.localStorage.getItem(SOS_SOUND_STORAGE_KEY) === "enabled");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!enabled || !activeAlerts.length) {
      stopAlertInterval(intervalRef);
      return;
    }

    void playSosAlarmPulse(audioContextRef, setMessage).catch(() => {
      setMessage("Tap Test sound or Enable alert sound once on this device to allow speaker alerts.");
    });
    stopAlertInterval(intervalRef);
    intervalRef.current = window.setInterval(() => {
      void playSosAlarmPulse(audioContextRef, setMessage).catch(() => {
        setMessage("Tap Test sound or Enable alert sound once on this device to allow speaker alerts.");
      });
    }, 2200);

    return () => stopAlertInterval(intervalRef);
  }, [enabled, activeAlerts.length, activeAlertKey]);

  async function enableSound() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await playSosAlarmPulse(audioContextRef, setMessage);
      window.localStorage.setItem(SOS_SOUND_STORAGE_KEY, "enabled");
      setEnabled(true);
      setMessage("Alert sound enabled on this device.");
    } catch {
      setMessage("Sound could not start. Tap again and check that the device volume is on.");
    }
  }

  function disableSound() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SOS_SOUND_STORAGE_KEY);
    }

    stopAlertInterval(intervalRef);
    setEnabled(false);
    setMessage("Alert sound disabled on this device.");
  }

  async function testSound() {
    try {
      await playSosAlarmPulse(audioContextRef, setMessage);
      setMessage("Test sound played on this device.");
    } catch {
      setMessage("Test sound could not play. Tap Enable alert sound and check the device volume.");
    }
  }

  return { enabled, message, enableSound, disableSound, testSound };
}

function stopAlertInterval(intervalRef: { current: number | null }) {
  if (intervalRef.current !== null && typeof window !== "undefined") {
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
}

async function playSosAlarmPulse(
  audioContextRef: { current: AudioContext | null },
  setMessage: (message: string) => void
) {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) {
    setMessage("This browser does not support device speaker alerts.");
    return;
  }

  const context = audioContextRef.current ?? window.__corsoSosAudioContext ?? new AudioContextConstructor();
  audioContextRef.current = context;
  window.__corsoSosAudioContext = context;

  if (context.state === "suspended") {
    await context.resume();
  }

  const start = context.currentTime;
  const masterGain = context.createGain();
  const lowTone = context.createOscillator();
  const highTone = context.createOscillator();

  masterGain.gain.setValueAtTime(0.0001, start);
  masterGain.gain.linearRampToValueAtTime(0.55, start + 0.06);
  masterGain.gain.setValueAtTime(0.55, start + 1.75);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, start + 1.95);

  lowTone.type = "sawtooth";
  highTone.type = "square";

  [0, 0.45, 0.9, 1.35].forEach((offset) => {
    lowTone.frequency.setValueAtTime(620, start + offset);
    lowTone.frequency.linearRampToValueAtTime(1240, start + offset + 0.22);
    lowTone.frequency.linearRampToValueAtTime(620, start + offset + 0.44);
    highTone.frequency.setValueAtTime(930, start + offset);
    highTone.frequency.linearRampToValueAtTime(1560, start + offset + 0.22);
    highTone.frequency.linearRampToValueAtTime(930, start + offset + 0.44);
  });

  lowTone.connect(masterGain);
  highTone.connect(masterGain);
  masterGain.connect(context.destination);
  lowTone.start(start);
  highTone.start(start);
  lowTone.stop(start + 2);
  highTone.stop(start + 2);
}

function EmergencyAlertCard({
  alert,
  compact = false,
  onAcknowledge,
  onResolve,
  onFalseAlarm
}: {
  alert: EmergencyAlert;
  compact?: boolean;
  onAcknowledge?: () => void;
  onResolve?: () => void;
  onFalseAlarm?: () => void;
}) {
  const option = emergencyAlertOptions.find((item) => item.type === alert.type);
  const active = alert.status === "active";
  const acknowledged = alert.status === "acknowledged";

  return (
    <div className={`rounded-lg border p-4 ${active ? "border-danger/40 bg-danger/10" : "border-white/15 bg-white/[0.08]"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${active ? "bg-danger text-white" : "bg-smart/10 text-smart"}`}>
            {option?.icon ?? <Siren className="h-5 w-5" />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">{formatEmergencyType(alert.type)}</h3>
              <StatusBadge status={formatEmergencyStatus(alert.status)} tone={emergencyStatusTone(alert.status)} />
              {alert.siren ? <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-1 text-xs font-semibold text-red-100">Siren requested</span> : null}
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {alert.residentName} - {alert.houseNumber}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="h-4 w-4 text-smart" />
              {alert.locationLabel}
            </p>
            {!compact || alert.notes ? <p className="mt-3 text-sm leading-6 text-slate-300">{alert.notes || "No extra note provided."}</p> : null}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{formatAlertTime(alert.createdAt)}</span>
              {alert.acknowledgedAt ? <span>Acknowledged {formatAlertTime(alert.acknowledgedAt)}</span> : null}
              {alert.resolvedAt ? <span>Closed {formatAlertTime(alert.resolvedAt)}</span> : null}
            </div>
          </div>
        </div>

        {(active || acknowledged) && (onAcknowledge || onResolve || onFalseAlarm) ? (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {active ? (
              <Button type="button" className="min-h-9 px-3 py-1 text-xs" onClick={onAcknowledge}>
                <BadgeCheck className="h-3.5 w-3.5" />
                Acknowledge
              </Button>
            ) : null}
            <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={onResolve}>
              Mark resolved
            </Button>
            <Button type="button" variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={onFalseAlarm}>
              False alarm
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatEmergencyType(type: EmergencyAlertType) {
  return emergencyAlertOptions.find((option) => option.type === type)?.title ?? type.replaceAll("_", " ");
}

function formatEmergencyStatus(status: EmergencyAlertStatus | SecurityIncident["status"]) {
  return status.replaceAll("_", " ");
}

function emergencyStatusTone(status: EmergencyAlertStatus | SecurityIncident["status"]) {
  if (status === "active" || status === "open") return "red";
  if (status === "acknowledged") return "yellow";
  if (status === "responding") return "blue";
  if (status === "resolved" || status === "closed") return "green";
  if (status === "cancelled" || status === "false_alarm") return "red";
  return "slate";
}

function isActiveSosStatus(status: SecurityIncident["status"]) {
  return status === "open" || status === "acknowledged" || status === "responding";
}

function isClosedSosStatus(status: SecurityIncident["status"]) {
  return status === "resolved" || status === "false_alarm" || status === "closed";
}

function residentSosStatusMessage(status: SecurityIncident["status"]) {
  if (status === "acknowledged") {
    return "Security has acknowledged your alert and is responding.";
  }

  if (status === "responding") {
    return "Security response is in progress. Keep your phone nearby.";
  }

  if (status === "resolved") {
    return "Incident resolved. Stay safe.";
  }

  if (status === "false_alarm") {
    return "Incident closed as a false alarm.";
  }

  return "Alert sent. Help is on the way.";
}

function sosAlertTypeLabel(value?: SecurityIncident["alertType"]) {
  if (value === "panic") return "Panic / Intruder";
  if (value === "medical") return "Medical";
  if (value === "fire") return "Fire";
  if (value === "security") return "Security";
  return "Emergency";
}

function sortSecurityIncidentsNewestFirst(left: SecurityIncident, right: SecurityIncident) {
  return right.openedAt.localeCompare(left.openedAt);
}

function isWithinLastHours(value: string, hours: number) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= hours * 60 * 60 * 1000;
}

function timeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "Just now";
  }

  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

function notifySosIncident(incident: SecurityIncident) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  new Notification(`SOS Alert from ${incident.residentName ?? "Resident"}`, {
    body: incident.locationLabel ?? incident.unitCode ?? "LBS View Estate"
  });
}

function flashSosBrowserTitle() {
  if (typeof document === "undefined") {
    return;
  }

  const original = document.title;
  let count = 0;
  const interval = window.setInterval(() => {
    document.title = count % 2 === 0 ? "NEW SOS ALERT" : original;
    count += 1;
    if (count > 6) {
      window.clearInterval(interval);
      document.title = original;
    }
  }, 900);
}

function formatAlertTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: LAGOS_TIME_ZONE
  }).format(new Date(value));
}

function VisitorCodeCard({
  code,
  qrValue,
  visitorName,
  status,
  phone,
  residentAddress,
  visitDate,
  arrivalTime
}: {
  code: string;
  qrValue?: string;
  visitorName: string;
  status: string;
  phone: string;
  residentAddress: string;
  visitDate: string;
  arrivalTime: string;
}) {
  const canShare = Boolean(code);
  const shareMessage = visitorShareMessage({
    visitorName,
    code,
    residentAddress,
    visitDate,
    arrivalTime
  });

  return (
    <Card>
      <CardHeader title="Generated access" description={status} />
      <div className="rounded-lg border border-smart/30 bg-smart/10 p-4 text-center">
        <QRCodeImage value={qrValue || code || "Pending visitor code"} />
        <p className="mt-4 font-mono text-xl font-semibold text-white">{code || "No code yet"}</p>
        <p className="mt-2 text-sm text-slate-300">{visitorName} - 6-digit code expires {VISITOR_CODE_VALIDITY_HOURS} hours after generation</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {canShare ? (
          <a href={whatsappShareUrl(phone, shareMessage)} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full" type="button">Share by WhatsApp</Button>
          </a>
        ) : (
          <Button variant="secondary" className="w-full" type="button" disabled>Share by WhatsApp</Button>
        )}
        {canShare ? (
          <a href={smsShareUrl(phone, shareMessage)}>
            <Button variant="secondary" className="w-full" type="button">Share by SMS</Button>
          </a>
        ) : (
          <Button variant="secondary" className="w-full" type="button" disabled>Share by SMS</Button>
        )}
      </div>
      <div className="mt-4 rounded-lg border border-line bg-ink/50 p-3 text-xs leading-5 text-slate-400">
        <p className="font-medium text-slate-300">Message preview</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans">{shareMessage}</pre>
      </div>
    </Card>
  );
}

function visitorShareMessage({
  visitorName,
  code,
  residentAddress,
  visitDate,
  arrivalTime
}: {
  visitorName: string;
  code: string;
  residentAddress: string;
  visitDate: string;
  arrivalTime: string;
}) {
  return [
    `Hi ${visitorName}`,
    "Your one-time code is",
    code,
    `Address: ${residentAddress}`,
    visitorAccessWindowLabel(visitDate, arrivalTime),
    "Powered by www.corso.ng"
  ].join("\n");
}

function whatsappShareUrl(phone: string, message: string) {
  const digits = normalizePhone(phone);
  const text = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

function smsShareUrl(phone: string, message: string) {
  const digits = normalizePhone(phone);
  const body = encodeURIComponent(message);
  return digits ? `sms:${digits}?&body=${body}` : `sms:?&body=${body}`;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  return digits;
}

function visitorAccessWindowLabel(date: string, time: string) {
  if (!date && !time) {
    return "not specified";
  }

  if (!date) {
    return `from ${formatClockTime(time)}`;
  }

  const startTime = time || "00:00";
  const startsAt = new Date(`${date}T${startTime}:00+01:00`);
  const endsAt = new Date(startsAt.getTime() + VISITOR_CODE_VALIDITY_HOURS * 60 * 60 * 1000);

  const formattedDate = new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: LAGOS_TIME_ZONE
  }).format(startsAt);
  const formattedEndTime = new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: LAGOS_TIME_ZONE
  }).format(endsAt);

  return `on ${formattedDate} from ${formatClockTime(startTime)} to ${formattedEndTime}`;
}

function formatClockTime(value: string) {
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return value || "not specified";
  }

  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC"
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

function moneyInputToNumber(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function dateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: LAGOS_TIME_ZONE
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function currentMonthInputValue(date = new Date()) {
  return dateInputValue(date).slice(0, 7);
}

function formatBillingMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value || "Selected month";
  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function timeInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LAGOS_TIME_ZONE
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? String(date.getUTCHours()).padStart(2, "0");
  const minute = parts.find((part) => part.type === "minute")?.value ?? String(date.getUTCMinutes()).padStart(2, "0");

  return `${hour}:${minute}`;
}

function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    timeZone: LAGOS_TIME_ZONE
  }).format(new Date(value));
}

function VisitorVerificationCard({
  visitor,
  residentsDirectory,
  onCheckIn,
  onCheckOut,
  onReject
}: {
  visitor: Visitor;
  residentsDirectory: Resident[];
  onCheckIn: () => void;
  onCheckOut: () => void;
  onReject: () => void;
}) {
  const resident = residentsDirectory.find((item) => item.id === visitor.residentId);
  const expired = visitor.status === "expired" || visitor.status === "cancelled";
  const checkedOut = visitor.status === "checked-out";
  const checkedIn = visitor.status === "checked-in";
  const pending = visitor.status === "pending";
  const windowState = getVisitorWindowState(visitor);
  const windowLocked = !windowState.canVerifyOrCheckIn && !checkedIn && !checkedOut;
  const checkInDisabled = pending || expired || checkedIn || checkedOut || windowLocked;
  return (
    <div className="rounded-lg border border-line bg-ink/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Visitor</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{visitor.visitorName}</h2>
        </div>
        <StatusBadge status={visitor.status} />
      </div>
      <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <p><span className="text-slate-500">Resident:</span> {resident?.name} - {resident?.houseNumber}</p>
        <p><span className="text-slate-500">Purpose:</span> {visitor.purpose}</p>
        <p><span className="text-slate-500">Arrival:</span> {visitor.visitDate} {formatClockTime(visitor.arrivalTime)}</p>
        <p><span className="text-slate-500">Guests:</span> {visitor.count}</p>
      </div>
      {!checkedIn && !checkedOut ? (
        <div className={`mt-5 rounded-lg border px-3 py-2 text-sm ${windowLocked ? "border-gold/40 bg-gold/10 text-gold" : "border-smart/30 bg-smart/10 text-smart"}`}>
          {windowState.message} Visitor codes are valid for {VISITOR_CODE_VALIDITY_HOURS} hours after generation.
        </div>
      ) : null}
      <div className="mt-5 grid gap-3 sm:flex sm:flex-wrap">
        <Button className="min-h-16 sm:min-h-11" disabled={checkInDisabled} onClick={onCheckIn}><CheckCircle2 className="h-4 w-4" />Check in</Button>
        <Button className="min-h-16 sm:min-h-11" variant="secondary" disabled={expired || !checkedIn} onClick={onCheckOut}>Check out</Button>
        <Button className="min-h-16 sm:min-h-11" variant="danger" disabled={checkedIn || checkedOut} onClick={onReject}>Reject</Button>
      </div>
    </div>
  );
}

function DigitalIdCard({
  name,
  role,
  estate,
  house,
  idNumber,
  status
}: {
  name: string;
  role: string;
  estate: string;
  house: string;
  idNumber: string;
  status: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(192,255,107,0.18),transparent_35%),linear-gradient(135deg,#656565,#000000)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-smart/30 bg-smart/10 text-2xl font-semibold text-smart">
            {name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
          </div>
          <StatusBadge status={status} />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-white">{name}</h2>
        <p className="text-sm text-slate-400">{role}</p>
      </div>
      <div className="p-5">
        <div className="grid gap-2 text-sm text-slate-300">
          <p><span className="text-slate-500">Estate:</span> {estate}</p>
          <p><span className="text-slate-500">House:</span> {house}</p>
          <p><span className="text-slate-500">ID:</span> <span className="font-mono text-smart">{idNumber}</span></p>
        </div>
        <div className="mt-5 rounded-lg bg-white p-3">
          <QRCodeImage value={idNumber} />
        </div>
      </div>
    </Card>
  );
}

function QRCodeImage({ value }: { value: string }) {
  const qrValue = useMemo(() => value || "Pending QR code", [value]);
  const [src, setSrc] = useState(() => qrDataUrlCache.get(qrValue) ?? "");

  useEffect(() => {
    const cached = qrDataUrlCache.get(qrValue);
    if (cached) {
      setSrc(cached);
      return;
    }

    let active = true;
    setSrc("");

    QRCode.toDataURL(qrValue, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 200,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    }).then((nextSrc) => {
      qrDataUrlCache.set(qrValue, nextSrc);
      if (active) {
        setSrc(nextSrc);
      }
    }).catch(() => {
      if (active) {
        setSrc("");
      }
    });

    return () => {
      active = false;
    };
  }, [qrValue]);

  if (!src) {
    return <div className="mx-auto h-[200px] w-[200px] rounded-lg bg-white/80" />;
  }

  return <img src={src} alt={`QR code for ${qrValue}`} className="mx-auto h-[200px] w-[200px] rounded-lg" loading="lazy" decoding="async" />;
}

function HomeIcon() {
  return <Building2 className="h-5 w-5" />;
}

function roleLabel(role: UserRole) {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function paymentChannelLabel(payment: Payment) {
  if (payment.channel === "online") {
    return `${payment.processor ?? "online"} online`;
  }

  return (payment.channel ?? "manual").replaceAll("_", " ");
}

function isResidentOnlinePaymentChannel(channel?: Payment["channel"]) {
  return channel === "online" || channel === "monnify_card" || channel === "monnify_transfer" || channel === "monnify_virtual_account";
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
}

