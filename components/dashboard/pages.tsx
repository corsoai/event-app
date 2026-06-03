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
  CheckCircle2,
  ClipboardList,
  DoorOpen,
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
  billOutstandingAmount,
  billPaidAmount,
  getCurrentResident,
  getResidentProperty,
  getResidentUnit,
  residentUnitLabel,
  type LocalAccessRequest,
  type LocalEstateState,
  useLocalEstateStore
} from "@/lib/local-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createSupabaseResidentVisitor, findSupabaseVisitorByCode } from "@/lib/supabase/data";
import type { Bill, EmergencyAlert, EmergencyAlertStatus, EmergencyAlertType, Estate, Payment, Resident, UserRole, Visitor } from "@/lib/types";
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
  const [resident, setResident] = useState(() => state.residents[0]);

  useEffect(() => {
    setResident(getCurrentResident(state));
  }, [state]);

  return resident ?? state.residents[0];
}

export function AdminDashboard() {
  const { state } = useLocalEstateStore();
  const confirmedPayments = state.payments.filter((payment) => payment.status === "confirmed");
  const paid = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const expected = state.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const outstanding = state.bills.reduce((sum, bill) => sum + billOutstandingAmount(state, bill), 0);
  const onlinePayments = confirmedPayments.filter((payment) => payment.channel === "online").reduce((sum, payment) => sum + payment.amount, 0);
  const manualPayments = confirmedPayments.filter((payment) => payment.channel !== "online").reduce((sum, payment) => sum + payment.amount, 0);
  const pendingPayments = state.payments.filter((payment) => payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);

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
            `${visitor.visitDate} ${visitor.arrivalTime}`,
            <span key={visitor.code} className="font-mono text-smart">{visitor.code}</span>,
            <StatusBadge key={visitor.status} status={visitor.status} />
          ])}
        />
        <Card>
          <CardHeader title="Revenue snapshot" description="Expected revenue, confirmed payments, outstanding balances, and pending reviews." />
          <div className="space-y-5">
            <Progress label="Expected revenue" value={expected} max={expected} />
            <Progress label="Confirmed paid" value={paid} max={expected} />
            <Progress label="Outstanding" value={outstanding} max={expected} tone="bg-warn" />
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
  const { state, approveAccessRequest, rejectAccessRequest, refreshEstateState, updateResident } = useLocalEstateStore();
  const pendingRequests = state.accessRequests.filter((request) => request.status === "pending");
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [savingResident, setSavingResident] = useState(false);
  const [residentMessage, setResidentMessage] = useState("");

  async function saveResident(resident: Resident, input: ResidentEditInput) {
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

  return (
    <>
      <PageHeader title="Residents" description="Add residents, manage household details, ownership status, and estate access." >
        <Link href="/admin/users">
          <Button><Users className="h-4 w-4" />Add resident</Button>
        </Link>
      </PageHeader>
      <AccessRequestsPanel
        requests={pendingRequests}
        onApprove={approveAccessRequest}
        onReject={rejectAccessRequest}
        onRefresh={() => void refreshEstateState()}
      />
      {residentMessage ? <p className="mb-4 rounded-lg border border-smart/30 bg-smart/10 px-3 py-2 text-sm text-smart">{residentMessage}</p> : null}
      {editingResident ? (
        <ResidentEditCard
          resident={editingResident}
          state={state}
          saving={savingResident}
          onSave={saveResident}
          onCancel={() => setEditingResident(null)}
        />
      ) : null}
      <DataTable
        title="Resident directory"
        description="Edit resident contact details, property/unit assignment, resident type, and active status."
        headers={["Name", "Property / Unit", "Type", "Phone", "Status", "Action"]}
        rows={state.residents.map((resident) => {
          const unit = getResidentUnit(state, resident);
          const property = getResidentProperty(state, resident);

          return [
          <div key={resident.id}><p className="font-medium text-white">{resident.name}</p><p className="text-xs text-slate-500">{resident.email}</p></div>,
          <div key={`${resident.id}-unit`}>
            <p className="font-mono text-smart">{residentUnitLabel(state, resident)}</p>
            <p className="text-xs text-slate-500">{unit?.apartmentType ?? "Unit pending"}{property?.legacyName ? ` - Legacy: ${property.legacyName}` : ""}</p>
          </div>,
          resident.type,
          resident.phone,
          <StatusBadge key={resident.status} status={resident.status} />,
          <Button key={`${resident.id}-edit`} variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={() => setEditingResident(resident)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ];
        })}
      />
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

type ResidentEditInput = Pick<Resident, "name" | "houseNumber" | "phone" | "email" | "type" | "status"> & {
  propertyId?: string;
  unitId?: string;
  moveInDate?: string;
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
      moveInDate: String(form.get("moveInDate") ?? resident.moveInDate ?? "").trim()
    });
  }

  return (
    <Card className="mb-6">
      <CardHeader
        title={`Edit ${resident.name}`}
        description="Correct resident details, update apartment / house number, or mark a resident inactive or moved out."
      />
      <form className="grid gap-4" onSubmit={submitResidentEdit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input name="name" defaultValue={resident.name} required />
          </Field>
          <Field label="Property / unit">
            <Select name="unitId" defaultValue={selectedUnit?.id ?? resident.unitId ?? ""}>
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
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={saving}>{saving ? "Saving resident" : "Save resident"}</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
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
  const { state, confirmPayment } = useLocalEstateStore();
  const expected = state.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const confirmed = state.payments.filter((payment) => payment.status === "confirmed").reduce((sum, payment) => sum + payment.amount, 0);
  const pendingReview = state.payments.filter((payment) => payment.status === "pending").reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = state.bills.reduce((sum, bill) => sum + billOutstandingAmount(state, bill), 0);
  const debtors = state.bills.filter((bill) => billOutstandingAmount(state, bill) > 0).length;

  return (
    <>
      <PageHeader title="Payments" description="Online payments confirm automatically through processor webhooks. Manual bank transfers, cash, POS, and WhatsApp receipts stay available as admin-reviewed fallback." />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Expected revenue" value={money(expected)} helper="All issued bills" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Confirmed paid" value={money(confirmed)} helper="Webhook and admin confirmed" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Outstanding" value={money(outstanding)} helper="Balance still owed" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Pending review" value={money(pendingReview)} helper="Manual proofs awaiting admin" icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="Debtors" value={String(debtors)} helper="Bills with balance" icon={<Users className="h-5 w-5" />} />
      </div>
      <DataTable
        title="Payment queue"
        headers={["Reference", "Resident / unit", "Bill", "Amount", "Channel", "Status", "Action"]}
        rows={state.payments.map((payment) => {
          const resident = state.residents.find((item) => item.id === payment.residentId);

          return [
          <span key={payment.reference} className="font-mono text-smart">{payment.reference}</span>,
          <div key={`${payment.id}-resident`}>
            <p className="font-medium text-white">{resident?.name ?? "Unknown"}</p>
            <p className="text-xs font-mono text-smart">{resident ? residentUnitLabel(state, resident) : payment.unitId ?? "Unit pending"}</p>
          </div>,
          state.bills.find((bill) => bill.id === payment.billId)?.title ?? "Unknown bill",
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
          rows={state.auditLogs.slice(0, 8).map((log) => [
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
  const expectedRevenue = state.bills.reduce((sum, bill) => sum + bill.amount, 0);
  const confirmedPayments = state.payments.filter((payment) => payment.status === "confirmed");
  const paidAmount = confirmedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstandingBalance = state.bills.reduce((sum, bill) => sum + billOutstandingAmount(state, bill), 0);
  const debtorBills = state.bills.filter((bill) => billOutstandingAmount(state, bill) > 0);
  const channelTotals = confirmedPayments.reduce<Record<string, number>>((totals, payment) => {
    const channel = paymentChannelLabel(payment);
    totals[channel] = (totals[channel] ?? 0) + payment.amount;
    return totals;
  }, {});
  const paymentStatusTotals = state.payments.reduce<Record<string, { count: number; amount: number }>>((totals, payment) => {
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
  const categoryTotals = state.bills.reduce<Record<string, number>>((totals, bill) => {
    const category = bill.category ?? "Service charge";
    totals[category] = (totals[category] ?? 0) + bill.amount;
    return totals;
  }, {});

  return (
    <>
      <PageHeader title="Reports" description="Accounting and operations analytics for expected revenue, confirmed payments, outstanding balances, debtors, channels, categories, and audit trail." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Expected revenue" value={money(expectedRevenue)} helper="All bills issued" icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Paid amount" value={money(paidAmount)} helper="Confirmed payments" icon={<WalletCards className="h-5 w-5" />} />
        <StatCard label="Outstanding" value={money(outstandingBalance)} helper="Open balance" icon={<Landmark className="h-5 w-5" />} />
        <StatCard label="Debtors" value={String(debtorBills.length)} helper="Bills with balance" icon={<Users className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Debtors"
          headers={["Resident", "Unit", "Bill", "Outstanding"]}
          rows={debtorBills.map((bill) => {
            const resident = state.residents.find((item) => item.id === bill.residentId);

            return [
              resident?.name ?? "Unknown",
              resident ? residentUnitLabel(state, resident) : bill.unitId ?? "Unit pending",
              bill.title,
              money(billOutstandingAmount(state, bill))
            ];
          })}
        />
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
          rows={state.auditLogs.slice(0, 8).map((log) => [
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
            `${visitor.visitDate} ${visitor.arrivalTime}`,
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
  const allowedRoles: UserRole[] = scope === "super-admin"
    ? ["super_admin", "estate_admin", "security_guard", "resident", "vendor"]
    : ["security_guard", "resident", "vendor"];
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

  async function loadUsers() {
    setLoadingUsers(true);
    setMessage("");

    try {
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
      const token = await getAccessToken();
      const data = await patchUserWithToken(token, payload);

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
      const token = await getAccessToken();
      const data = await deleteUserWithToken(token, user.id);

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
      const token = await getAccessToken();
      const results = [];
      for (const user of selectedUsers) {
        results.push(await patchUserWithToken(token, { profileId: user.id, action }));
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
      const token = await getAccessToken();
      for (const user of selectedUsers) {
        await deleteUserWithToken(token, user.id);
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
          ? "Create platform, estate admin, security, resident, and vendor users from Corso."
          : "Create security, resident, and vendor users for your assigned estate."}
      />
      <AccessRequestsPanel
        requests={pendingRequests}
        onApprove={approvePendingRequest}
        onReject={rejectPendingRequest}
        onRefresh={() => void refreshRequestsAndUsers()}
      />
      <Card className="mb-6">
        <CardHeader title="Create user" description="Estate admins can create security, resident, and vendor users for their assigned estate, then share the login details privately." />
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
  const myBills = state.bills.filter((bill) => bill.residentId === resident.id);
  const outstanding = myBills.reduce((sum, bill) => sum + billOutstandingAmount(state, bill), 0);
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
        <StatCard label="Outstanding bills" value={money(outstanding)} helper="Pay online first" icon={<ReceiptText className="h-5 w-5" />} />
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
  const [visitorName, setVisitorName] = useState("Cane Corso");
  const [sharePhone, setSharePhone] = useState("+234 906 343 1313");
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
          `${visitor.visitDate} ${visitor.arrivalTime}`,
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

  return (
    <>
      <PageHeader title="My bills" description="View outstanding estate bills, due dates, and payment status." />
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
          <CardHeader title="No outstanding bills" description="All assigned bills are fully paid or no bills have been assigned to this resident." />
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
  const [lookupResident, setLookupResident] = useState<Resident | null>(null);
  const [lookupVisitor, setLookupVisitor] = useState<Visitor | null>(null);
  const [searching, setSearching] = useState(false);
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

  function handleVisitorQrScan(rawValue: string) {
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
          helper="Camera ready. Scanning QR code."
          onResult={handleVisitorQrScan}
          onClose={() => setScannerOpen(false)}
        />
        <div className="mt-5">
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
          visitor.arrivalTime,
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
          <DigitalIdCard name="Amina Okafor" role="Resident owner" estate="LBS View Estate" house="LDI-01-B" idNumber={idNumber} status="active" />
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
      headers={["Bill", "Unit", "Resident", "Expected", "Paid", "Outstanding", "Status", "Action"]}
      rows={rows.map((bill) => {
        const resident = residentsDirectory.find((item) => item.id === bill.residentId);
        const paid = billPaidAmount(state, bill);
        const outstanding = billOutstandingAmount(state, bill);

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
        <StatusBadge key={bill.status} status={bill.status} />,
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
    const residentId = String(form.get("residentId") ?? "res-001");
    const resident = residentsDirectory.find((item) => item.id === residentId);
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
            <Select name="residentId" defaultValue="res-001">
              {residentsDirectory.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.name} - {residentUnitLabel(state, resident)}
                </option>
              ))}
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
    return `from ${time}`;
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
  const formattedEndTime = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LAGOS_TIME_ZONE
  }).format(endsAt);

  return `on ${formattedDate} from ${startTime} to ${formattedEndTime}`;
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
        <p><span className="text-slate-500">Arrival:</span> {visitor.visitDate} {visitor.arrivalTime}</p>
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

