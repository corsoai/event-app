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
import { roleLabels } from "@/lib/auth";
import {
  activityLogs,
  announcements,
  knowledgeBase,
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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createSupabaseResidentVisitor, findSupabaseVisitorByCode } from "@/lib/supabase/data";
import {
  installGuardTourSync,
  isGuardCheckpointQr,
  submitGuardCheckpointScan,
  syncPendingTourLogs
} from "@/lib/guard-tour";
import { APPWRITE_ONBOARDING_DATABASE_ID } from "@/lib/appwrite/schema";
import type { Bill, CsoReview, EmergencyAlert, EmergencyAlertStatus, EmergencyAlertType, Estate, GuardCheckpoint, GuardPatrolEvent, Payment, Property, Resident, SecurityIncident, Unit, UserRole, Visitor } from "@/lib/types";
import { contactLabel, makeDigitalIdNumber, money } from "@/lib/utils";
import { getVisitorWindowState, VISITOR_CODE_VALIDITY_HOURS } from "@/lib/visitor-window";

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
  total: AppwriteResidentDirectory["total"] & {
    bills: number;
    payments: number;
  };
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
  if (!accounting?.bills.length && !accounting?.payments.length) {
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

function useAdminAccountingState(state: LocalEstateState) {
  const [accounting, setAccounting] = useState<AppwriteAccountingDirectory | null>(null);
  const [summary, setSummary] = useState<AppwriteAccountingSummary | null>(null);
  const [loadingAccounting, setLoadingAccounting] = useState(false);
  const [loadingAccountingDetails, setLoadingAccountingDetails] = useState(false);
  const [accountingStatus, setAccountingStatus] = useState("Loading accounting summary...");

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
    void refreshAccounting();
  }, []);

  return {
    accountingState: mergeAccountingState(state, accounting),
    accounting,
    summary,
    accountingStatus,
    loadingAccounting,
    loadingAccountingDetails,
    refreshAccounting
  };
}

function filenameFromContentDisposition(value: string | null) {
  const match = value?.match(/filename="?([^"]+)"?/i);
  return match?.[1];
}

export function AdminDashboard() {
  const { state } = useLocalEstateStore();
  const { accountingState, summary } = useAdminAccountingState(state);
  const confirmedPayments = accountingState.payments.filter((payment) => payment.status === "confirmed");
  const paid = summary?.paidAmount ?? confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const expected = summary?.expectedRevenue ?? accountingState.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const outstanding = summary?.outstandingBalance ?? accountingState.bills.reduce((sum, bill) => sum + billOutstandingAmount(accountingState, bill), 0);
  const credit = summary?.creditBalance ?? accountingState.bills.reduce((sum, bill) => sum + billCreditAmount(accountingState, bill), 0);
  const onlinePayments = confirmedPayments.filter((payment) => payment.channel === "online").reduce((sum, payment) => sum + payment.amount, 0);
  const manualPayments = confirmedPayments.filter((payment) => payment.channel !== "online").reduce((sum, payment) => sum + payment.amount, 0);
  const pendingPayments = summary?.pendingReviewAmount ?? accountingState.payments.filter((payment) => payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <>
      <PageHeader
        title="Estate command center"
        description="Manage LBS View Estate operations across residents, access control, billing, complaints, announcements, and reports."
      >
        <Link href="/admin/bills">
          <Button>
            <FilePlus2 className="h-4 w-4" />
            Create bill
          </Button>
        </Link>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total residents" value={String(state.residents.length)} helper="Across active demo estates" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Visitors today" value={String(state.visitors.length)} helper="Expected and checked in" icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Open complaints" value={String(state.complaints.filter((item) => item.status !== "resolved").length)} helper="Needs admin action" icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <DataTable
          title="Visitor access log"
          description="Live visitor access visibility for estate administrators."
          headers={["Visitor", "Resident", "Date", "Code", "Status"]}
          rows={state.visitors.map((visitor) => [
            visitor.visitorName,
            state.residents.find((resident) => resident.id === visitor.residentId)?.name ?? "Unknown",
            `${visitor.visitDate} ${formatClockTime(visitor.arrivalTime)}`,
            <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
            <StatusBadge key={visitor.status} status={visitor.status} />
          ])}
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
    updateResident,
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
  const [residentLoginCredential, setResidentLoginCredential] = useState<TemporaryCredential | null>(null);
  const directoryState = appwriteDirectory?.residents.length
    ? {
        ...state,
        properties: mergeRecordsById(state.properties, appwriteDirectory.properties),
        units: mergeRecordsById(state.units, appwriteDirectory.units),
        residents: appwriteDirectory.residents
      }
    : state;
  const directoryResidents = directoryState.residents.length ? directoryState.residents : [];

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
      const isLocalResident = state.residents.some((item) => item.id === resident.id);
      const updatedResident = isLocalResident
        ? await updateResident(resident.id, input)
        : await updateAppwriteResidentFromDirectory(resident.id, input);

      if (!isLocalResident) {
        setAppwriteDirectory((current) => current
          ? {
              ...current,
              residents: current.residents.map((item) => item.id === updatedResident.id ? updatedResident : item)
            }
          : current
        );
      }

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
        localResidents={state.residents}
        selectedResidentId={selectedResidentId}
        description={appwriteDirectoryStatus}
        loading={loadingAppwriteDirectory}
        onRefresh={() => void refreshAppwriteResidentDirectory()}
        onSelect={setSelectedResidentId}
        onEdit={(resident) => setEditingResident(resident)}
        onCreateLogin={(resident) => void createResidentLogin(resident)}
        creatingLoginId={creatingResidentLoginId}
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
      <div className="mt-6">
        <DataTable
          title="Approved local login accounts"
          description="Accounts approved during the local demo. These can log in from the login page."
          headers={["Name", "Phone", "Role", "Estate", "Approved"]}
          rows={state.approvedUsers.map((user) => [
            <span key={user.id} className="font-medium text-white">{user.fullName}</span>,
            <span key={user.email} className="font-mono text-smart">{contactLabel(user.email, user.phone)}</span>,
            roleLabel(user.role),
            user.estate,
            user.approvedAt
          ])}
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
  creatingLoginId
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
  creatingLogin
}: {
  resident: Resident;
  state: LocalEstateState;
  source: string;
  onClose: () => void;
  onEdit: () => void;
  onCreateLogin: () => void;
  creatingLogin: boolean;
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
  creatingLogin = false
}: {
  resident?: Resident;
  state: LocalEstateState;
  source: string;
  onEdit?: () => void;
  onCreateLogin?: () => void;
  creatingLogin?: boolean;
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
      <div className="grid gap-4 md:grid-cols-3">
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
      const result = await sendBillingImportRequest(rows, false);
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

  async function sendBillingImportRequest(previewRows: LbsviewOnboardingPreviewRow[], dryRun: boolean) {
    const response = await fetch("/api/appwrite/onboarding/billing-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun, rows: previewRows })
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
  const { state } = useLocalEstateStore();

  return (
    <>
      <PageHeader title="Visitor logs" description="Review access codes, entry status, guard notes, entry times, and exit times." />
      <DataTable
        title="Access control logs"
        headers={["Code", "Visitor", "Resident", "Purpose", "Gate", "Status"]}
        rows={state.visitors.map((visitor) => [
          <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
          visitor.visitorName,
          state.residents.find((resident) => resident.id === visitor.residentId)?.name ?? "Unknown",
          visitor.purpose,
          state.estates.find((estate) => estate.id === visitor.estateId)?.gateName ?? "Main Gate",
          <StatusBadge key={visitor.status} status={visitor.status} />
        ])}
      />
    </>
  );
}

export function BillsAdminPage() {
  const { state, addBill, markBillPaid } = useLocalEstateStore();

  return (
    <>
      <PageHeader title="Bills" description="Create estate bills, assign them to residents or houses, and track due dates and payment status.">
        <Button type="button" onClick={() => scrollToSection("create-bill")}><ReceiptText className="h-4 w-4" />New bill</Button>
      </PageHeader>
      <BillComposer onCreateBill={addBill} state={state} residentsDirectory={state.residents} />
      <div className="mt-6">
        <BillsTable title="Current billing register" rows={state.bills} state={state} admin onMarkPaid={markBillPaid} residentsDirectory={state.residents} />
      </div>
    </>
  );
}

export function PaymentsAdminPage() {
  const { state, addPayment, confirmPayment } = useLocalEstateStore();
  const { accountingState, accounting, summary, accountingStatus, loadingAccounting, loadingAccountingDetails, refreshAccounting } = useAdminAccountingState(state);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const expected = summary?.expectedRevenue ?? accountingState.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const confirmed = summary?.paidAmount ?? accountingState.payments.filter((payment) => payment.status === "confirmed").reduce((sum, payment) => sum + payment.amount, 0);
  const pendingReview = summary?.pendingReviewAmount ?? accountingState.payments.filter((payment) => payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = summary?.outstandingBalance ?? accountingState.bills.reduce((sum, bill) => sum + billOutstandingAmount(accountingState, bill), 0);
  const credit = summary?.creditBalance ?? accountingState.bills.reduce((sum, bill) => sum + billCreditAmount(accountingState, bill), 0);
  const netReceivable = summary?.netReceivable ?? Math.max(0, outstanding - credit);
  const debtors = summary?.debtorsCount ?? accountingState.residents.filter((resident) => residentBillingBalance(accountingState, resident.id).netReceivable > 0).length;
  const payableBills = accountingState.bills.filter((bill) => billOutstandingAmount(accountingState, bill) > 0);

  async function submitAdminPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPayment(true);
    setPaymentMessage("");

    const form = new FormData(event.currentTarget);
    const billId = String(form.get("billId") ?? "");
    const bill = accountingState.bills.find((item) => item.id === billId);
    const amount = Number(form.get("amount") ?? 0);
    const reference = String(form.get("reference") || `ADMIN-${Date.now()}`);
    const channel = String(form.get("channel") ?? "bank_transfer") as Payment["channel"];
    const date = String(form.get("date") || dateInputValue());

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
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to record Appwrite payment.");
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
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              <Select name="billId" defaultValue={payableBills[0]?.id ?? ""} required>
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
            <Field label="Amount"><Input name="amount" type="number" min="1" step="0.01" placeholder="50000" required /></Field>
            <Field label="Reference"><Input name="reference" placeholder={`ADMIN-${Date.now()}`} required /></Field>
            <Field label="Channel">
              <Select name="channel" defaultValue="bank_transfer">
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
  const { state } = useLocalEstateStore();

  return (
    <>
      <PageHeader title="Complaints" description="Assign maintenance requests, update status, track priority, and keep resident history in one place." />
      <DataTable
        title="Maintenance and complaint queue"
        headers={["Ticket", "Category", "Priority", "Assigned to", "Created", "Status"]}
        rows={state.complaints.map((complaint) => [
          <div key={complaint.id}><p className="font-medium text-white">{complaint.title}</p><p className="text-xs text-slate-500">{complaint.id.toUpperCase()}</p></div>,
          complaint.category,
          <StatusBadge key={complaint.priority} status={complaint.priority} />,
          complaint.assignedTo,
          complaint.createdAt,
          <StatusBadge key={complaint.status} status={complaint.status} />
        ])}
      />
    </>
  );
}

export function AnnouncementsAdminPage() {
  const [message, setMessage] = useState("");

  function publishAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Announcement saved for this session. Email, SMS, and push delivery can be connected next.");
    event.currentTarget.reset();
  }

  return (
    <>
      <PageHeader title="Announcements" description="Publish estate-wide or targeted communication for residents, owners, tenants, security, and vendors.">
        <Button type="button" onClick={() => scrollToSection("publish-announcement")}><Megaphone className="h-4 w-4" />Create announcement</Button>
      </PageHeader>
      <Card id="publish-announcement" className="scroll-mt-24">
        <CardHeader title="Publish update" description="Prepared for future email, SMS, and push notification delivery." />
        <form className="grid gap-4" onSubmit={publishAnnouncement}>
          <Field label="Title"><Input name="title" placeholder="Power maintenance window" required /></Field>
          <Field label="Message"><Textarea name="message" placeholder="Write announcement message" required /></Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Target audience">
              <Select name="target" defaultValue="all residents">
                <option>all residents</option>
                <option>owners</option>
                <option>tenants</option>
                <option>security</option>
                <option>vendors</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select name="priority" defaultValue="normal"><option>normal</option><option>urgent</option></Select>
            </Field>
            <Field label="Publish date"><Input name="publishDate" type="date" defaultValue="2026-05-15" /></Field>
          </div>
          {message ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
          <Button className="w-fit">Publish announcement</Button>
        </form>
      </Card>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {announcements.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <Megaphone className="h-5 w-5 text-smart" />
              <StatusBadge status={item.priority} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{item.message}</p>
            <p className="mt-4 text-xs text-slate-500">{item.target} - {item.publishDate}</p>
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
  const [message, setMessage] = useState("");

  function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Knowledge base article saved for this session.");
    event.currentTarget.reset();
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
              <Field label="Title"><Input name="title" placeholder="Estate access rules" required /></Field>
              <Field label="Category"><Input name="category" placeholder="Security" required /></Field>
            </div>
            <Field label="Summary"><Textarea name="summary" placeholder="Write the article summary or instruction." required /></Field>
            {message ? <p className="rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}
            <Button className="w-fit">Save article</Button>
          </form>
        </Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {knowledgeBase.map((article) => (
          <Card key={article.id}>
            <BookOpen className="h-5 w-5 text-smart" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{article.category}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{article.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">{article.summary}</p>
            <p className="mt-4 text-xs text-slate-500">Updated {article.updatedAt}</p>
          </Card>
        ))}
      </div>
    </>
  );
}

export function ReportsPage() {
  const { state } = useLocalEstateStore();
  const { accountingState, summary, accountingStatus, loadingAccounting, loadingAccountingDetails, refreshAccounting } = useAdminAccountingState(state);
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
    const method = payment.channel === "online" ? "online" : "manual";
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
      <PageHeader title="Reports" description="Accounting and operations analytics for expected revenue, confirmed payments, outstanding balances, credit balances, debtors, channels, categories, and audit trail.">
        <Button type="button" variant="secondary" onClick={() => void refreshAccounting({ bypassCache: true })} disabled={loadingAccounting || loadingAccountingDetails}>
          <RefreshCw className="h-4 w-4" />
          {loadingAccounting || loadingAccountingDetails ? "Refreshing" : "Refresh reports"}
        </Button>
      </PageHeader>
      <p className="mb-4 rounded-lg border border-line bg-ink/50 px-3 py-2 text-sm text-slate-300">{accountingStatus}</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Expected revenue" value={money(expectedRevenue)} helper="All bills issued" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Paid amount" value={money(paidAmount)} helper="Confirmed payments" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Outstanding" value={money(outstandingBalance)} helper="Open balance" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Credit balance" value={money(creditBalance)} helper="Advance payments" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Net receivable" value={money(netReceivable)} helper="Outstanding after credits" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="In credit" value={String(summary?.residentsInCredit ?? creditResidents.length)} helper="Advance payment residents" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Debtors" value={String(summary?.debtorsCount ?? debtorResidents.length)} helper="Residents with net balance" icon={<Users className="h-5 w-5" />} />
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
    </>
  );
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
        <StatCard label="Visitor events" value={String(state.visitors.length)} helper="Across estates today" icon={<DoorOpen className="h-5 w-5" />} />
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
  const estateVisitors = state.visitors.filter((visitor) => visitor.estateId === estate.id);
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
        <StatCard label="Visitors" value={String(estateVisitors.length)} helper="Invitation records" icon={<DoorOpen className="h-5 w-5" />} />
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
        <DataTable
          title="Recent visitors"
          headers={["Code", "Visitor", "Arrival", "Status"]}
          rows={estateVisitors.slice(0, 6).map((visitor) => [
            <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
            visitor.visitorName,
            `${visitor.visitDate} ${formatClockTime(visitor.arrivalTime)}`,
            <StatusBadge key={visitor.status} status={visitor.status} />
          ])}
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

  async function getAccessToken() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      throw new Error("Supabase is not configured.");
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Your login session has expired. Sign in again.");
    }

    return session.access_token;
  }

  function toggleUserSelection(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function toggleAllUsers() {
    setSelectedUserIds(allUsersSelected ? [] : users.map((user) => user.id));
  }

  async function patchUserWithToken(token: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to update user.");
    }

    return data;
  }

  async function patchManagedUser(payload: Record<string, unknown>) {
    if (!getSupabaseBrowserClient()) {
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

    const token = await getAccessToken();
    return patchUserWithToken(token, payload);
  }

  async function deleteUserWithToken(token: string, profileId: string) {
    const response = await fetch(`/api/admin/users?profileId=${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Unable to delete user.");
    }

    return data;
  }

  async function deleteManagedUser(profileId: string) {
    if (!getSupabaseBrowserClient()) {
      const response = await fetch(`/api/appwrite/admin/users?profileId=${encodeURIComponent(profileId)}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to delete Appwrite user.");
      }

      return data;
    }

    const token = await getAccessToken();
    return deleteUserWithToken(token, profileId);
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setMessage("");

    try {
      if (!getSupabaseBrowserClient()) {
        const response = await fetch("/api/appwrite/admin/users", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load Appwrite users.");
        }

        setUsers(data.users ?? []);
        return;
      }

      const token = await getAccessToken();
      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load users.");
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
      if (!getSupabaseBrowserClient()) {
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
        return;
      }

      const token = await getAccessToken();
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          role,
          estateId: String(form.get("estateId") ?? ""),
          houseNumber: String(form.get("houseNumber") ?? ""),
          password: String(form.get("password") ?? ""),
          emailInvite
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to create user.");
      }

      setMessage(data.message ?? "User created.");
      setCreatedPassword(data.temporaryPassword ?? "");
      setTemporaryCredential(data.temporaryPassword ? {
        fullName: data.user?.fullName ?? String(form.get("fullName") ?? ""),
        role,
        loginIdentifier: data.loginIdentifier ?? String(form.get("phone") ?? ""),
        password: data.temporaryPassword
      } : null);
      setSetupLink(data.setupLink ?? "");
      formElement.reset();
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
  const resident = useCurrentResidentProfile(state);
  const balance = residentBillingBalance(state, resident.id);
  return (
    <>
      <PageHeader title={`Welcome, ${resident.name}`} description="Invite visitors, check bills, submit complaints, read announcements, and keep your digital ID ready." >
        <div className="flex flex-wrap gap-2">
          <Link href="/resident/invite-visitor">
            <Button><QrCode className="h-4 w-4" />Invite visitor</Button>
          </Link>
        </div>
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Subscription balance" value={money(balance.netReceivable)} helper="Outstanding after credit" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Credit available" value={money(balance.availableCredit)} helper="Advance payment balance" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Expected visitors" value={String(state.visitors.filter((visitor) => visitor.residentId === resident.id).length)} helper="Pending access codes" icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard label="My complaints" value={String(state.complaints.filter((complaint) => complaint.residentId === resident.id).length)} helper="Open and resolved tickets" icon={<ClipboardList className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
  return <PausedSosFeaturePage backHref="/resident" backLabel="Dashboard" />;
}

function ResidentSosFlow() {
  const { state, createEmergencyAlert, updateEmergencyAlertStatus } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const estate = state.estates.find((item) => item.id === resident.estateId) ?? state.estates[0];
  const [selectedType, setSelectedType] = useState<EmergencyAlertType>("security");
  const [siren, setSiren] = useState(true);
  const [message, setMessage] = useState("");
  const [lastAlert, setLastAlert] = useState<EmergencyAlert | null>(null);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);
  const selectedOption = emergencyAlertOptions.find((option) => option.type === selectedType) ?? emergencyAlertOptions[1];
  const myAlerts = state.emergencyAlerts.filter((alert) => alert.residentId === resident.id);
  const openResidentAlert = myAlerts.find((alert) => alert.status === "active" || alert.status === "acknowledged");
  const locationLabel = `${residentUnitLabel(state, resident)}, ${estate?.address ?? "LBS View Estate"}`;
  const cooldownRemaining = Math.max(0, Math.ceil((SOS_RESUBMIT_COOLDOWN_MS - (Date.now() - lastSubmitAt)) / 1000));
  const sendLocked = Boolean(openResidentAlert) || cooldownRemaining > 0;

  function submitSos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (openResidentAlert) {
      setMessage(`You already have an open SOS alert for ${formatEmergencyType(openResidentAlert.type)}. Security can see it now.`);
      return;
    }

    if (cooldownRemaining > 0) {
      setMessage(`Please wait ${cooldownRemaining} seconds before sending another SOS alert.`);
      return;
    }

    const form = new FormData(event.currentTarget);
    const alert = createEmergencyAlert({
      type: selectedType,
      notes: String(form.get("notes") ?? ""),
      siren,
      locationLabel
    });

    setLastAlert(alert);
    setLastSubmitAt(Date.now());
    setMessage("SOS alert sent to estate security. Keep your phone nearby and stay in a safe place if possible.");
    event.currentTarget.reset();
  }

  function cancelOpenSos() {
    if (!openResidentAlert) {
      return;
    }

    updateEmergencyAlertStatus(openResidentAlert.id, "cancelled");
    setLastAlert(null);
    setMessage("Your SOS alert has been cancelled. Security will see it as cancelled in the incident log.");
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
            title="What is happening?"
            description="Choose one alert type, add a short note if you can, then send the alert."
          />
          {openResidentAlert ? (
            <div className="mb-5 rounded-lg border border-danger/40 bg-danger/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100">Open SOS already sent</p>
                  <p className="mt-1 font-semibold text-white">{formatEmergencyType(openResidentAlert.type)} - {formatEmergencyStatus(openResidentAlert.status)}</p>
                  <p className="mt-1 text-sm text-slate-300">{openResidentAlert.locationLabel}</p>
                </div>
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={cancelOpenSos}>
                  Cancel SOS
                </Button>
              </div>
            </div>
          ) : null}
          <form className="grid gap-5" onSubmit={submitSos}>
            <div className="grid gap-3 md:grid-cols-2">
              {emergencyAlertOptions.map((option) => (
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
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-black/25">{option.icon}</span>
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
                <Textarea name="notes" placeholder="Example: I need help at my apartment gate." />
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
                <label className="flex items-center justify-between gap-4 rounded-lg border border-white/15 bg-black/25 p-4 text-sm text-slate-200">
                  <span className="flex items-center gap-3">
                    <Volume2 className="h-5 w-5 text-danger" />
                    Request siren alert
                  </span>
                  <input
                    type="checkbox"
                    checked={siren}
                    onChange={(event) => setSiren(event.target.checked)}
                    className="h-5 w-5 accent-[#C0FF6B]"
                  />
                </label>
              </div>
            </div>

            {message ? (
              <div className="rounded-lg border border-smart/30 bg-smart/10 p-4 text-sm text-smart">
                <p className="font-semibold text-white">Alert sent</p>
                <p className="mt-1">{message}</p>
                {lastAlert ? <p className="mt-2 font-mono text-xs text-slate-200">Incident ID: {lastAlert.id.slice(0, 8).toUpperCase()}</p> : null}
              </div>
            ) : null}

            <Button type="submit" variant="danger" className="min-h-14 text-base" disabled={sendLocked}>
              <Siren className="h-5 w-5" />
              {openResidentAlert ? "SOS already active" : cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : `Send ${selectedOption.title}`}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Recent SOS history" description="Every submitted SOS is logged for estate response and follow-up." />
          <div className="grid gap-3">
            {myAlerts.length ? (
              myAlerts.slice(0, 5).map((alert) => (
                <EmergencyAlertCard key={alert.id} alert={alert} compact />
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
  const { state, addVisitor, addVisitorRecord } = useLocalEstateStore();
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
      count: Math.min(20, Math.max(1, Number(form.get("count") ?? 1)))
    };

    setSaving(true);
    setStatus("Saving visitor invitation online...");

    try {
      const supabase = getSupabaseBrowserClient();
      const savedVisitor = supabase
        ? addVisitorRecord(await createSupabaseResidentVisitor(input))
        : addVisitor(input);
      let demoRegistrySaved = false;

      if (!supabase) {
        demoRegistrySaved = await saveDemoVisitorInvitation(savedVisitor, resident);
      }

      setCode(savedVisitor.code);
      setVisitorQrValue(visitorQrValueFor(savedVisitor));
      setSharePhone(phone);
      setShareDate(visitDate);
      setShareTime(arrivalTime);
      setStatus(
        supabase
          ? "Visitor invitation saved online. Security can now verify this code."
          : demoRegistrySaved
            ? "Visitor invitation saved for demo security verification. Security can scan the QR or enter this code."
            : "Visitor invitation saved in this browser. Security can scan the QR, or use the same device to search the code."
      );
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

export function MyVisitorsPage() {
  const { state, addVisitorRecord } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const myVisitors = useMemo(
    () => state.visitors.filter((visitor) => visitor.residentId === resident.id),
    [resident.id, state.visitors]
  );
  const visitorSyncKey = myVisitors.map((visitor) => `${visitor.code}:${visitor.status}`).join(",");

  useEffect(() => {
    if (getSupabaseBrowserClient() || !myVisitors.length) {
      return;
    }

    const syncStatuses = () => {
      void syncDemoVisitorStatuses(myVisitors, addVisitorRecord);
    };
    syncStatuses();
    const interval = window.setInterval(syncStatuses, 5000);

    return () => window.clearInterval(interval);
  }, [addVisitorRecord, myVisitors, visitorSyncKey]);

  return (
    <>
      <PageHeader title="My visitors" description="Track expected visitors, checked-in guests, expired codes, and cancelled invitations." />
      <DataTable
        title="Visitor invitations"
        headers={["Visitor", "Date", "Purpose", "Code", "Status"]}
        rows={myVisitors.map((visitor) => [
          visitor.visitorName,
          `${visitor.visitDate} ${formatClockTime(visitor.arrivalTime)}`,
          visitor.purpose,
          <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
          <StatusBadge key={visitor.status} status={visitor.status} />
        ])}
      />
    </>
  );
}

export function MyBillsPage() {
  const { state } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const myBills = state.bills.filter((bill) => bill.residentId === resident.id);
  const balance = residentBillingBalance(state, resident.id);

  return (
    <>
      <PageHeader title="My bills" description="View outstanding estate bills, due dates, and payment status." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Net amount due" value={money(balance.netReceivable)} helper="Outstanding after credit" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Credit available" value={money(balance.availableCredit)} helper="Advance payment balance" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Confirmed paid" value={money(balance.paidAmount)} helper="Recorded payments" icon={<WalletCards className="h-5 w-5" />} />
      </div>
      <BillsTable title="Resident billing" rows={myBills} state={state} residentsDirectory={state.residents} />
    </>
  );
}

export function PaymentHistoryPage() {
  const { state, addPayment } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const myBills = state.bills.filter((bill) => bill.residentId === resident.id);
  const payableBills = myBills.filter((bill) => billOutstandingAmount(state, bill) > 0);
  const myPayments = state.payments.filter((payment) => payment.residentId === resident.id);
  const balance = residentBillingBalance(state, resident.id);
  const [paymentMessage, setPaymentMessage] = useState("");

  function submitOnlinePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const billId = String(form.get("billId") ?? payableBills[0]?.id);
    const bill = payableBills.find((item) => item.id === billId) ?? payableBills[0];
    const processor = String(form.get("processor") ?? "paystack") as Payment["processor"];
    if (!bill) {
      return;
    }

    const payment = addPayment({
      billId: bill.id,
      amount: billOutstandingAmount(state, bill),
      reference: `${processor?.toUpperCase() ?? "ONLINE"}-${Date.now()}`,
      channel: "online",
      processor,
      source: "webhook"
    });
    setPaymentMessage(`${payment.reference} confirmed automatically by ${processor} webhook.`);
    event.currentTarget.reset();
  }

  function submitManualPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payment = addPayment({
      billId: String(form.get("billId") ?? payableBills[0]?.id),
      amount: Number(form.get("amount") ?? 0),
      reference: String(form.get("reference") || `LOCAL-${Date.now()}`),
      channel: String(form.get("channel") ?? "bank_transfer") as Payment["channel"],
      processor: "manual",
      source: "resident"
    });
    setPaymentMessage(`Manual payment proof ${payment.reference} saved for admin confirmation.`);
    event.currentTarget.reset();
  }

  return (
    <>
      <PageHeader title="Payment history" description="Pay bills online first. Manual bank transfer, POS, cash, or WhatsApp receipts remain available when online payment is not possible." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Net amount due" value={money(balance.netReceivable)} helper="Outstanding after credit" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Credit available" value={money(balance.availableCredit)} helper="Applied to future subscription" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Confirmed paid" value={money(balance.paidAmount)} helper="Payment history total" icon={<WalletCards className="h-5 w-5" />} />
      </div>
      {payableBills.length ? (
        <Card className="mb-6">
          <CardHeader title="Pay online" description="Demo flow: the processor webhook confirms the payment, updates the bill, resident balance, reports, and audit trail automatically." />
          <form onSubmit={submitOnlinePayment}>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Bill">
                <Select name="billId" defaultValue={myBills[0]?.id}>
                  {payableBills.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {bill.title} - {money(billOutstandingAmount(state, bill))}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Processor">
                <Select name="processor" defaultValue="paystack">
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                  <option value="monnify">Monnify</option>
                  <option value="gtbank_squad">GTBank Squad</option>
                </Select>
              </Field>
              <Field label="Unit"><Input value={residentUnitLabel(state, resident)} readOnly /></Field>
              <div className="flex items-end">
                <Button className="w-full"><WalletCards className="h-4 w-4" />Pay online</Button>
              </div>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader
            title={balance.availableCredit > 0 ? "Advance payment available" : "No outstanding bills"}
            description={balance.availableCredit > 0
              ? "Your account is in credit. Future subscription bills can be deducted from this balance before new payment is requested."
              : "All assigned bills are fully paid or no bills have been assigned to this resident."}
          />
        </Card>
      )}
      {payableBills.length ? (
        <Card className="mb-6">
          <CardHeader title="Manual payment fallback" description="Use this only for bank transfers, cash, POS, or WhatsApp receipt payments that need admin confirmation." />
          <form onSubmit={submitManualPayment}>
            <div className="grid gap-4 md:grid-cols-5">
              <Field label="Bill">
                <Select name="billId" defaultValue={payableBills[0]?.id}>
                  {payableBills.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {bill.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment reference"><Input name="reference" placeholder="BANK-TRANSFER-REF" required /></Field>
              <Field label="Amount"><Input name="amount" type="number" placeholder="85000" min={1} required /></Field>
              <Field label="Channel">
                <Select name="channel" defaultValue="bank_transfer">
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="pos">POS</option>
                  <option value="whatsapp_receipt">WhatsApp receipt</option>
                </Select>
              </Field>
              <Field label="Proof upload"><Input type="file" /></Field>
            </div>
            <Button className="mt-5"><Upload className="h-4 w-4" />Submit manual proof</Button>
          </form>
        </Card>
      ) : null}
      {paymentMessage ? <p className="mb-6 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{paymentMessage}</p> : null}
      <DataTable
        title="Payment history"
        headers={["Reference", "Bill", "Amount", "Channel", "Date", "Status"]}
        rows={myPayments.map((payment) => [
          <span key={payment.reference} className="font-mono text-smart">{payment.reference}</span>,
          state.bills.find((bill) => bill.id === payment.billId)?.title ?? "Unknown bill",
          money(payment.amount),
          paymentChannelLabel(payment),
          payment.date,
          <StatusBadge key={payment.status} status={payment.status} />
        ])}
      />
    </>
  );
}

export function MyComplaintsPage() {
  const { state } = useLocalEstateStore();
  const resident = useCurrentResidentProfile(state);
  const myComplaints = state.complaints.filter((complaint) => complaint.residentId === resident.id);

  return (
    <>
      <PageHeader title="My complaints" description="Track submitted maintenance requests, priority, assignment, and status updates." >
        <Link href="/resident/new-complaint">
          <Button><ClipboardList className="h-4 w-4" />New complaint</Button>
        </Link>
      </PageHeader>
      <DataTable
        title="Complaint history"
        headers={["Title", "Category", "Priority", "Assigned", "Status"]}
        rows={myComplaints.map((complaint) => [
          complaint.title,
          complaint.category,
          <StatusBadge key={complaint.priority} status={complaint.priority} />,
          complaint.assignedTo,
          <StatusBadge key={complaint.status} status={complaint.status} />
        ])}
      />
    </>
  );
}

export function SubmitComplaintPage() {
  const { addComplaint } = useLocalEstateStore();
  const [complaintMessage, setComplaintMessage] = useState("");

  function submitComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const complaint = addComplaint({
      category: String(form.get("category") ?? "other") as Parameters<typeof addComplaint>[0]["category"],
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      priority: String(form.get("priority") ?? "medium") as Parameters<typeof addComplaint>[0]["priority"]
    });
    setComplaintMessage(`Complaint ${complaint.id.toUpperCase()} saved locally for admin review.`);
    event.currentTarget.reset();
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
          <Button className="w-fit">Submit complaint</Button>
        </form>
      </Card>
    </>
  );
}

export function ResidentAnnouncementsPage({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {!compact ? <PageHeader title="Announcements" description="Estate communication targeted to residents, owners, tenants, security, and vendors." /> : null}
      <Card>
        <CardHeader title="Latest announcements" description="Prepared for push notification delivery." />
        <div className="grid gap-4">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="rounded-lg border border-line bg-ink/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-white">{announcement.title}</h2>
                <StatusBadge status={announcement.priority} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">{announcement.message}</p>
              <p className="mt-3 text-xs text-slate-500">{announcement.publishDate} - {announcement.target}</p>
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
  return (
    <>
      <PageHeader title="Household and domestic staff" description="Residents manage household members, domestic staff, vendors, and other people linked to their unit." />
      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Household members"
          headers={["Name", "Type", "Phone", "Status"]}
          rows={[
            ["Daniel Okafor", "Family member", "+234 801 220 1021", <StatusBadge key="active" status="active" />],
            ["Sade Okafor", "Family member", "+234 809 481 2012", <StatusBadge key="active2" status="active" />]
          ]}
        />
        <DataTable
          title="Domestic staff"
          headers={["Name", "Type", "ID", "Status"]}
          rows={[
            ["Grace Monday", "Domestic staff", "LBS-STA-0204", <StatusBadge key="active" status="active" />],
            ["Bola Daniel", "Domestic staff", "LBS-STA-0317", <StatusBadge key="active2" status="active" />],
            ["Peace James", "Care assistant", "LBS-STA-0411", <StatusBadge key="active3" status="active" />]
          ]}
        />
      </div>
    </>
  );
}

export function SecurityDashboard() {
  const { state } = useLocalEstateStore();
  const checkedInCount = state.visitors.filter((visitor) => visitor.status === "checked-in").length;
  const verifiedCount = state.visitors.filter((visitor) => visitor.status === "verified").length;

  return (
    <>
      <PageHeader title="Security dashboard" description="Verify access and record gate movement." />
      <VerifyVisitorPage compact />
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-white">Today at the gate</h2>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <StatCard label="Expected today" value={String(state.visitors.length)} helper="All gates" icon={<CalendarClock className="h-5 w-5" />} />
        <StatCard label="Checked in" value={String(checkedInCount)} helper="Currently inside" icon={<DoorOpen className="h-5 w-5" />} />
        <StatCard label="Verified codes" value={String(verifiedCount)} helper="Awaiting check-in" icon={<BadgeCheck className="h-5 w-5" />} />
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
  const openIncidents = incidents.filter((incident) => incident.status === "open" || incident.status === "acknowledged");
  const pendingReviews = reviews.filter((review) => review.status === "open" || review.status === "pending");

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
      }
    });

    return unsubscribe;
  }, []);

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
      />

      {message ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
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
                    <SecurityIncidentCard key={incident.id} incident={incident} />
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
    severity: incidentSeverityValue(row.severity),
    status: incidentStatusValue(row.status),
    reportedByRole: textValue(row.reportedByRole) || "security_guard",
    reportedByProfileId: optionalTextValue(row.reportedByProfileId),
    assignedToProfileId: optionalTextValue(row.assignedToProfileId),
    locationLabel: optionalTextValue(row.locationLabel),
    summary: textValue(row.summary) || "Security incident",
    details: optionalTextValue(row.details),
    openedAt,
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
  return {
    id: `incident-${incident.id}`,
    sourceId: incident.id,
    kind: "incident",
    title: incident.summary || "Security incident",
    detail: `${incident.locationLabel ?? "Estate security"} - ${incident.severity} priority.`,
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
  if (value === "open" || value === "acknowledged" || value === "resolved" || value === "closed") {
    return value;
  }

  return "open";
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
          <img src="${qrDataUrl}" alt="Checkpoint QR" />
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
            <img alt={`QR code for ${checkpoint.checkpointName}`} className="aspect-square w-full rounded-md object-contain" src={qrDataUrl} />
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

export function EmergencyAlertsPage({ audience = "security" }: { audience?: "security" | "admin" }) {
  return (
    <PausedSosFeaturePage
      backHref={audience === "admin" ? "/admin" : "/security"}
      backLabel="Dashboard"
    />
  );
}

function EmergencyAlertsFlow({ audience = "security" }: { audience?: "security" | "admin" }) {
  const { state, updateEmergencyAlertStatus } = useLocalEstateStore();
  const [message, setMessage] = useState("");
  const activeAlerts = state.emergencyAlerts.filter((alert) => alert.status === "active");
  const acknowledgedAlerts = state.emergencyAlerts.filter((alert) => alert.status === "acknowledged");
  const closedAlerts = state.emergencyAlerts.filter((alert) => alert.status === "resolved" || alert.status === "false_alarm" || alert.status === "cancelled");
  const orderedAlerts = [...activeAlerts, ...acknowledgedAlerts, ...closedAlerts];

  function changeAlertStatus(alert: EmergencyAlert, status: EmergencyAlertStatus) {
    updateEmergencyAlertStatus(alert.id, status);
    setMessage(`${formatEmergencyType(alert.type)} for ${alert.houseNumber} marked as ${formatEmergencyStatus(status)}.`);
  }

  return (
    <>
      <PageHeader
        title={audience === "admin" ? "Estate SOS alerts" : "Security SOS console"}
        description="Monitor panic alerts, view resident house/location, acknowledge response, and close incidents after action."
      >
        <Link href={audience === "admin" ? "/admin" : "/security"}>
          <Button variant="secondary">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </PageHeader>

      <SosAlertSoundControl activeAlerts={activeAlerts} />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active alerts" value={String(activeAlerts.length)} helper="Needs immediate response" icon={<Siren className="h-5 w-5" />} />
        <StatCard label="Acknowledged" value={String(acknowledgedAlerts.length)} helper="Security has started response" icon={<BadgeCheck className="h-5 w-5" />} />
        <StatCard label="Closed incidents" value={String(closedAlerts.length)} helper="Resolved or false alarm" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {activeAlerts.length ? (
        <Card className="mt-6 border-danger/40 bg-danger/10">
          <CardHeader
            title="Live response required"
            description="Gate/security should call or dispatch response to the listed house immediately."
          />
          <div className="grid gap-4">
            {activeAlerts.map((alert) => (
              <EmergencyAlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={() => changeAlertStatus(alert, "acknowledged")}
                onResolve={() => changeAlertStatus(alert, "resolved")}
                onFalseAlarm={() => changeAlertStatus(alert, "false_alarm")}
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
          {orderedAlerts.length ? (
            orderedAlerts.map((alert) => (
              <EmergencyAlertCard
                key={alert.id}
                alert={alert}
                compact={alert.status !== "active"}
                onAcknowledge={() => changeAlertStatus(alert, "acknowledged")}
                onResolve={() => changeAlertStatus(alert, "resolved")}
                onFalseAlarm={() => changeAlertStatus(alert, "false_alarm")}
              />
            ))
          ) : (
            <div className="rounded-lg border border-white/15 bg-white/[0.08] p-4 text-sm text-slate-300">
              No SOS incidents have been logged yet.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export function VerifyVisitorPage({ compact = false }: { compact?: boolean }) {
  const { state, addVisitorRecord, updateVisitorStatus } = useLocalEstateStore();
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
  const found = code.length === 6 ? findVisitorForCode(code) : undefined;
  const residentsDirectory = lookupResident
    ? [lookupResident, ...state.residents.filter((resident) => resident.id !== lookupResident.id)]
    : state.residents;

  function findVisitorForCode(targetCode: string) {
    return lookupVisitor?.code === targetCode ? lookupVisitor : state.visitors.find((visitor) => visitor.code === targetCode);
  }

  useEffect(() => {
    setLookupResident(null);
    setLookupVisitor(null);
    setMessage("");
    setHasSearched(false);
  }, [code]);

  useEffect(() => {
    if (code.length !== 6 || !found || found.status !== "pending") {
      return;
    }

    autoVerifyPendingVisitor(found);
  }, [code, found]);

  useEffect(() => installGuardTourSync(), []);

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
        autoVerifyPendingVisitor(matchedVisitor);
        return;
      }

      setMessage(gateLookupMessage(matchedVisitor));
      if (shouldExpireVisitor(matchedVisitor)) {
        updateVisitorStatus(matchedVisitor.id, "expired");
      }
      return;
    }

    setSearching(true);
    setMessage("Searching visitor records...");

    try {
      if (!getSupabaseBrowserClient()) {
        const demoResult = await findDemoVisitorByCode(targetCode);
        if (demoResult?.visitor) {
          loadVisitorLookup(demoResult.visitor, demoResult.resident);
          return;
        }

        setMessage("No valid visitor invitation found for this code. In demo mode, scan the visitor QR or search on the same device that generated the invitation.");
        return;
      }

      const result = await findSupabaseVisitorByCode(targetCode);
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
      }
    } else {
      setMessage(gateLookupMessage(visitor));
    }

    if (nextVisitor.status !== visitor.status && !getSupabaseBrowserClient()) {
      void updateDemoVisitorRecordStatus(nextVisitor, nextVisitor.status);
    }

    addVisitorRecord(nextVisitor);
    setLookupVisitor(nextVisitor);
    setLookupResident(resident);
    setCode(nextVisitor.code);
    setHasSearched(true);
  }

  function autoVerifyPendingVisitor(visitor: Visitor) {
    if (visitor.status !== "pending") {
      return;
    }

    const windowState = getVisitorWindowState(visitor);
    if (!windowState.canVerifyOrCheckIn) {
      if (windowState.status === "expired") {
        updateVisitorStatus(visitor.id, "expired");
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
    updateVisitorStatus(visitor.id, "verified");
    setLookupVisitor((current) => current?.id === visitor.id ? { ...current, status: "verified" } : current);
    setHasSearched(true);
    setMessage(`${visitor.visitorName} found and verified. Use Check in when entry is approved.`);
  }

  function changeStatus(visitor: Visitor, status: Visitor["status"]) {
    if ((status === "verified" || status === "checked-in") && !getVisitorWindowState(visitor).canVerifyOrCheckIn) {
      const windowState = getVisitorWindowState(visitor);
      if (windowState.status === "expired") {
        updateVisitorStatus(visitor.id, "expired");
      }
      setMessage(`${windowState.message} Visitor codes are valid for ${VISITOR_CODE_VALIDITY_HOURS} hours after generation.`);
      return;
    }

    updateVisitorStatus(visitor.id, status);
    setLookupVisitor((current) => current?.id === visitor.id ? { ...current, status } : current);
    setMessage(`${visitor.visitorName} is now ${status}.`);
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
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
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
              onCheckIn={() => changeStatus(found, "checked-in")}
              onCheckOut={() => changeStatus(found, "checked-out")}
              onReject={() => changeStatus(found, "cancelled")}
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
    <div className="mt-4 rounded-lg border border-smart/30 bg-black p-4 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <Button type="button" variant="ghost" className="min-h-9 px-3" onClick={onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-white/15 bg-ink">
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
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

async function saveDemoVisitorInvitation(visitor: Visitor, resident: Resident) {
  try {
    const response = await fetch("/api/local/visitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ visitor, resident })
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function findDemoVisitorByCode(code: string) {
  const response = await fetch(`/api/local/visitors?code=${encodeURIComponent(code)}`, {
    cache: "no-store"
  }).catch(() => null);

  if (!response || response.status === 404) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.visitor) {
    return null;
  }

  return payload as { visitor: Visitor; resident: Resident | null };
}

async function updateDemoVisitorRecordStatus(visitor: Visitor, status: Visitor["status"]) {
  await fetch("/api/local/visitors", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      visitorId: visitor.id,
      code: visitor.code,
      status
    })
  }).catch(() => null);
}

async function syncDemoVisitorStatuses(visitorsList: Visitor[], onUpdate: (visitor: Visitor) => Visitor) {
  await Promise.all(
    visitorsList.map(async (visitor) => {
      const result = await findDemoVisitorByCode(visitor.code);
      if (result?.visitor && result.visitor.status !== visitor.status) {
        onUpdate(result.visitor);
      }
    })
  );
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
  const { state } = useLocalEstateStore();

  return (
    <>
      <PageHeader title="Today's expected visitors" description="Visitor list for security guards to prepare gate checks." />
      <DataTable
        title="Expected visitors"
        headers={["Code", "Visitor", "Resident", "Arrival", "Guests", "Status"]}
        rows={state.visitors.map((visitor) => [
          <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
          visitor.visitorName,
          state.residents.find((resident) => resident.id === visitor.residentId)?.name ?? "Unknown",
          formatClockTime(visitor.arrivalTime),
          visitor.count,
          <StatusBadge key={visitor.status} status={visitor.status} />
        ])}
      />
    </>
  );
}

export function EntryLogsPage() {
  const { state } = useLocalEstateStore();

  return (
    <>
      <PageHeader title="Check-in and check-out logs" description="Record entry and exit times, guard names, and visitor movement." />
      <DataTable
        title="Gate movement logs"
        headers={["Visitor", "Code", "Entry time", "Exit time", "Guard", "Status"]}
        rows={state.visitorLogs.map((log) => [
          log.visitorName,
          <span key={log.code} className="font-mono text-smart">{log.code}</span>,
          log.entryTime ?? "Pending",
          log.exitTime ?? (log.decision === "checked-in" ? "Inside" : "Pending"),
          log.guardName,
          <StatusBadge key={log.decision} status={log.decision} />
        ])}
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
  onCreateBill,
  state,
  residentsDirectory
}: {
  onCreateBill: (input: { title: string; amount: number; dueDate: string; residentId: string; category?: string; unitId?: string }) => Bill;
  state: LocalEstateState;
  residentsDirectory: Resident[];
}) {
  const [message, setMessage] = useState("");

  function submitBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const residentId = String(form.get("residentId") ?? residentsDirectory[0]?.id ?? "");
    const resident = residentsDirectory.find((item) => item.id === residentId);
    if (!resident) {
      setMessage("Add or import residents before creating a bill.");
      return;
    }
    const bill = onCreateBill({
      title: String(form.get("title") ?? ""),
      category: String(form.get("category") ?? "Service charge"),
      amount: Number(form.get("amount") ?? 0),
      dueDate: String(form.get("dueDate") ?? ""),
      residentId,
      unitId: resident?.unitId
    });
    setMessage(`${bill.title} saved locally.`);
    event.currentTarget.reset();
  }

  return (
    <Card id="create-bill" className="scroll-mt-24">
      <CardHeader title="Create bill" description="Assign a service charge, security levy, waste fee, power levy, maintenance fee, or custom charge." />
      <form onSubmit={submitBill}>
        <div className="grid gap-4 md:grid-cols-5">
          <Field label="Title"><Input name="title" defaultValue="June 2026 Service Charge" required /></Field>
          <Field label="Category">
            <Select name="category" defaultValue="Service charge">
              <option>Service charge</option>
              <option>Security levy</option>
              <option>Waste management</option>
              <option>Power/infrastructure levy</option>
              <option>Maintenance fee</option>
            </Select>
          </Field>
          <Field label="Amount"><Input name="amount" type="number" defaultValue={85000} min={1} required /></Field>
          <Field label="Due date"><Input name="dueDate" type="date" defaultValue="2026-06-28" required /></Field>
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
        <Button className="mt-5">Create bill</Button>
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
  activeAlerts: EmergencyAlert[];
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

function useSosAlertSound(activeAlerts: EmergencyAlert[]) {
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

function formatEmergencyStatus(status: EmergencyAlertStatus) {
  return status.replaceAll("_", " ");
}

function emergencyStatusTone(status: EmergencyAlertStatus) {
  if (status === "active") return "red";
  if (status === "acknowledged") return "yellow";
  if (status === "resolved") return "green";
  if (status === "cancelled") return "red";
  return "slate";
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
      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={checkInDisabled} onClick={onCheckIn}><CheckCircle2 className="h-4 w-4" />Check in</Button>
        <Button variant="secondary" disabled={expired || !checkedIn} onClick={onCheckOut}>Check out</Button>
        <Button variant="danger" disabled={checkedIn || checkedOut} onClick={onReject}>Reject</Button>
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
  const [src, setSrc] = useState("");

  useEffect(() => {
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 260,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    }).then(setSrc);
  }, [value]);

  if (!src) {
    return <div className="mx-auto h-44 w-44 rounded-lg bg-white/80" />;
  }

  return <img src={src} alt={`QR code for ${value}`} className="mx-auto h-44 w-44 rounded-lg" />;
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

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${id}`);
}

