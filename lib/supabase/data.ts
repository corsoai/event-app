import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { auditLogs, properties, units } from "@/lib/demo-data";
import type { Bill, Complaint, EmergencyAlert, EmergencyAlertStatus, Estate, Payment, Resident, UserRole, Visitor } from "@/lib/types";
import { getVisitorExpiresAtIso } from "@/lib/visitor-window";
import { DEFAULT_ESTATE_NAME, loginIdentifierToEmail, sortEstatesWithDefaultFirst } from "@/lib/utils";
import type {
  LocalAccessRequest,
  LocalApprovedUser,
  LocalEstateState,
  LocalVisitorLog
} from "@/lib/local-store";

const LBS_VIEW_ESTATE_ID = "11111111-1111-1111-1111-111111111111";
const LAGOS_TIME_ZONE = "Africa/Lagos";

type SupabaseAccessRequest = {
  id: string;
  auth_user_id: string | null;
  estate_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  requested_role: UserRole;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  estates?: { name?: string } | { name?: string }[] | null;
};

type VisitorCreateInput = Pick<
  Visitor,
  "visitorName" | "phone" | "visitDate" | "arrivalTime" | "purpose" | "count"
>;

export type ResidentUpdateInput = Pick<
  Resident,
  "name" | "houseNumber" | "phone" | "email" | "type" | "status"
>;

export async function createSupabaseAccessRequest(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  estate: string;
  estateId?: string;
}) {
  const response = await fetch("/api/access-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      password: input.password,
      role: input.role,
      estate: input.estate,
      estateId: input.estateId ?? estateIdForName(input.estate)
    })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Access request could not be submitted.");
  }

  return payload as { status: "created" | "already-pending" | "already-approved"; message?: string };
}

export async function readSupabaseSessionProfile() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name,email,phone,role,is_active,estates(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    return null;
  }

  return {
    email: data.email as string,
    phone: (data.phone as string | null) ?? "",
    name: data.full_name as string,
    role: data.role as UserRole,
    estate: relationName(data.estates) ?? DEFAULT_ESTATE_NAME
  };
}

export async function readSupabaseAccessRequestForCurrentUser(identifier: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const email = loginIdentifierToEmail(identifier);
  const { data } = await supabase
    .from("access_requests")
    .select("status")
    .eq("email", email)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as { status: "pending" | "approved" | "rejected" } | null;
}

export async function loadSupabaseEstateState() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const [
    estatesResult,
    residentsResult,
    visitorsResult,
    visitorLogsResult,
    billsResult,
    paymentsResult,
    complaintsResult,
    emergencyAlertsResult,
    accessRequests
  ] = await Promise.all([
    supabase.from("estates").select("*").order("created_at", { ascending: false }),
    supabase.from("residents").select("*").order("created_at", { ascending: false }),
    supabase.from("visitors").select("*").order("created_at", { ascending: false }),
    supabase.from("visitor_logs").select("*, visitors(visitor_name, access_code)").order("created_at", { ascending: false }),
    supabase.from("bills").select("*").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").order("paid_at", { ascending: false }),
    supabase.from("complaints").select("*").order("created_at", { ascending: false }),
    supabase.from("emergency_alerts").select("*").order("created_at", { ascending: false }),
    readAdminAccessRequests(session.access_token)
  ]);

  const estateRows = estatesResult.error ? [] : estatesResult.data ?? [];
  const residentRows = residentsResult.error ? [] : residentsResult.data ?? [];
  const visitorRows = visitorsResult.error ? [] : visitorsResult.data ?? [];
  const visitorLogRows = visitorLogsResult.error ? [] : visitorLogsResult.data ?? [];
  const billRows = billsResult.error ? [] : billsResult.data ?? [];
  const paymentRows = paymentsResult.error ? [] : paymentsResult.data ?? [];
  const complaintRows = complaintsResult.error ? [] : complaintsResult.data ?? [];
  const emergencyAlertRows = emergencyAlertsResult.error ? [] : emergencyAlertsResult.data ?? [];

  return {
    estates: sortEstatesWithDefaultFirst(estateRows.map(mapEstate)),
    properties,
    units,
    residents: residentRows.map(mapResident),
    visitors: visitorRows.map(mapVisitor),
    visitorLogs: visitorLogRows.map(mapVisitorLog),
    bills: billRows.map(mapBill),
    payments: paymentRows.map(mapPayment),
    complaints: complaintRows.map(mapComplaint),
    emergencyAlerts: emergencyAlertRows.map(mapSupabaseEmergencyAlert),
    accessRequests: accessRequests.map(mapAccessRequest),
    approvedUsers: accessRequests.filter((request) => request.status === "approved").map(mapApprovedUser),
    auditLogs
  } satisfies LocalEstateState;
}

export async function readSupabaseAdminAccessRequests() {
  const accessToken = await getCurrentAccessToken("Sign in again before loading access requests.");
  return readAdminAccessRequests(accessToken).then((requests) => requests.map(mapAccessRequest));
}

export async function saveSupabaseEstate(estate: Estate) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("estates").insert({
    id: estate.id,
    name: estate.name,
    address: estate.address,
    contact_email: estate.contactEmail,
    contact_phone: estate.contactPhone,
    gate_name: estate.gateName,
    payment_account_name: `${estate.name} Service Account`,
    payment_bank_name: "Pending setup",
    payment_account_number: "Pending setup",
    service_charge_categories: ["Service charge", "Security levy", "Waste management"]
  });

  if (error) {
    throw error;
  }
}

async function readAdminAccessRequests(accessToken: string): Promise<SupabaseAccessRequest[]> {
  const response = await fetch(`/api/admin/access-requests?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  }).catch(() => null);

  if (!response?.ok) {
    return [];
  }

  const payload = await response.json().catch(() => ({ requests: [] }));
  return (payload.requests ?? []) as SupabaseAccessRequest[];
}

export async function approveSupabaseAccessRequest(requestId: string) {
  return patchAdminAccessRequest(requestId, "approve");
}

export async function rejectSupabaseAccessRequest(requestId: string) {
  return patchAdminAccessRequest(requestId, "reject");
}

async function patchAdminAccessRequest(requestId: string, action: "approve" | "reject") {
  const accessToken = await getCurrentAccessToken("Your login session has expired. Sign in again before reviewing access requests.");

  const response = await fetch("/api/admin/access-requests", {
    method: "PATCH",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ requestId, action })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Access request could not be reviewed.");
  }

  return {
    message: String(payload.message ?? ""),
    requests: ((payload.requests ?? []) as SupabaseAccessRequest[]).map(mapAccessRequest)
  };
}

async function getCurrentAccessToken(errorMessage: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error(errorMessage);
  }

  return session.access_token;
}

export async function createSupabaseResidentVisitor(input: VisitorCreateInput) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your login session has expired. Sign in again before creating a visitor code.");
  }

  const response = await fetch("/api/resident/visitors", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Visitor invitation could not be saved online.");
  }

  return payload.visitor as Visitor;
}

export async function findSupabaseVisitorByCode(code: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your login session has expired. Sign in again before verifying a visitor code.");
  }

  const response = await fetch(`/api/security/visitors?code=${encodeURIComponent(code)}`, {
    headers: {
      authorization: `Bearer ${session.access_token}`
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Visitor code could not be verified online.");
  }

  return payload as { visitor: Visitor; resident: Resident | null };
}

export async function saveSupabaseVisitor(visitor: Visitor) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("visitors").insert({
    estate_id: visitor.estateId,
    resident_id: visitor.residentId,
    visitor_name: visitor.visitorName,
    phone: visitor.phone,
    visit_date: visitor.visitDate,
    expected_arrival_time: visitor.arrivalTime,
    purpose: visitor.purpose,
    visitor_count: visitor.count,
    access_code: visitor.code,
    qr_payload: visitor.code,
    expires_at: getVisitorExpiresAtIso(visitor),
    created_at: visitor.createdAt ?? new Date().toISOString(),
    status: toSupabaseVisitorStatus(visitor.status)
  });

  if (error) {
    throw error;
  }
}

export async function updateSupabaseVisitorStatus(visitor: Visitor, status: Visitor["status"]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Your login session has expired. Sign in again before updating a visitor code.");
  }

  const response = await fetch("/api/security/visitors", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ visitorId: visitor.id, status })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Visitor status could not be updated online.");
  }
}

export async function updateSupabaseResident(residentId: string, input: ResidentUpdateInput) {
  const accessToken = await getCurrentAccessToken("Your login session has expired. Sign in again before updating resident details.");

  const response = await fetch("/api/admin/residents", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ residentId, ...input })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Resident details could not be updated.");
  }

  return payload.resident as Resident;
}

export async function saveSupabaseComplaint(complaint: Complaint) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("complaints").insert({
    estate_id: "11111111-1111-1111-1111-111111111111",
    resident_id: complaint.residentId,
    category: complaint.category,
    title: complaint.title,
    description: complaint.title,
    priority: complaint.priority,
    status: toSupabaseComplaintStatus(complaint.status),
    assigned_to: complaint.assignedTo
  });
}

export async function saveSupabaseEmergencyAlert(alert: EmergencyAlert) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("emergency_alerts").insert({
    id: isUuid(alert.id) ? alert.id : undefined,
    estate_id: alert.estateId,
    resident_id: isUuid(alert.residentId) ? alert.residentId : null,
    alert_type: alert.type,
    status: alert.status,
    resident_name: alert.residentName,
    house_number: alert.houseNumber,
    phone: alert.phone,
    location_label: alert.locationLabel,
    notes: alert.notes,
    siren_requested: alert.siren,
    created_at: alert.createdAt
  });

  if (error) {
    throw error;
  }
}

export async function updateSupabaseEmergencyAlertStatus(alert: EmergencyAlert, status: EmergencyAlertStatus) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !isUuid(alert.id)) return;

  const payload: Record<string, string | null> = { status };
  if (status === "acknowledged") {
    payload.acknowledged_at = new Date().toISOString();
  }
  if (status === "resolved" || status === "false_alarm" || status === "cancelled") {
    payload.resolved_at = new Date().toISOString();
  }

  const { error } = await supabase.from("emergency_alerts").update(payload).eq("id", alert.id);

  if (error) {
    throw error;
  }
}

export async function readPublicSupabaseEstates() {
  const response = await fetch("/api/public/estates", { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Estate list could not be loaded.");
  }

  return sortEstatesWithDefaultFirst((payload.estates ?? []) as Array<{ id: string; name: string }>);
}

export async function saveSupabasePayment(payment: Payment) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("payments").insert({
    estate_id: "11111111-1111-1111-1111-111111111111",
    bill_id: payment.billId,
    resident_id: payment.residentId,
    amount: payment.amount,
    payment_reference: payment.reference,
    status: payment.status
  });
}

export async function saveSupabaseBill(bill: Bill) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("bills").insert({
    estate_id: bill.estateId,
    resident_id: bill.residentId,
    title: bill.title,
    category: bill.title,
    amount: bill.amount,
    due_date: bill.dueDate,
    status: toSupabaseBillStatus(bill.status)
  });
}

function mapEstate(row: Record<string, any>): Estate {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    contactEmail: row.contact_email ?? "Not provided",
    contactPhone: row.contact_phone ?? "Not provided",
    gateName: row.gate_name ?? "Main Gate"
  };
}

function mapResident(row: Record<string, any>): Resident {
  return {
    id: row.id,
    estateId: row.estate_id,
    name: row.full_name,
    houseNumber: row.apartment_number,
    phone: row.phone ?? "Not provided",
    email: row.email ?? "",
    type: row.resident_type === "family_member" ? "family member" : row.resident_type,
    status: row.status === "moved_out" ? "moved out" : row.status
  };
}

function mapVisitor(row: Record<string, any>): Visitor {
  return {
    id: row.id,
    residentId: row.resident_id,
    estateId: row.estate_id,
    visitorName: row.visitor_name,
    phone: row.phone ?? "",
    visitDate: row.visit_date,
    arrivalTime: String(row.expected_arrival_time).slice(0, 5),
    purpose: row.purpose,
    count: row.visitor_count,
    code: row.access_code,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: fromSupabaseVisitorStatus(row.status)
  };
}

function mapVisitorLog(row: Record<string, any>): LocalVisitorLog {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    visitorName: row.visitors?.visitor_name ?? "Visitor",
    code: row.visitors?.access_code ?? "",
    gateName: row.gate_name,
    guardName: "Security",
    entryTime: row.entry_time ? new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: LAGOS_TIME_ZONE }).format(new Date(row.entry_time)) : undefined,
    exitTime: row.exit_time ? new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: LAGOS_TIME_ZONE }).format(new Date(row.exit_time)) : undefined,
    decision: fromSupabaseVisitorDecision(row.decision),
    createdAt: String(row.created_at).slice(0, 10)
  };
}

function mapBill(row: Record<string, any>): Bill {
  return {
    id: row.id,
    residentId: row.resident_id,
    estateId: row.estate_id,
    title: row.title,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: fromSupabaseBillStatus(row.status)
  };
}

function mapPayment(row: Record<string, any>): Payment {
  return {
    id: row.id,
    billId: row.bill_id,
    residentId: row.resident_id,
    amount: Number(row.amount),
    reference: row.payment_reference,
    date: String(row.paid_at).slice(0, 10),
    status: row.status
  };
}

function mapComplaint(row: Record<string, any>): Complaint {
  return {
    id: row.id,
    residentId: row.resident_id,
    category: row.category,
    title: row.title,
    priority: row.priority,
    status: fromSupabaseComplaintStatus(row.status),
    createdAt: String(row.created_at).slice(0, 10),
    assignedTo: row.assigned_to ?? "Estate admin desk"
  };
}

export function mapSupabaseEmergencyAlert(row: Record<string, any>): EmergencyAlert {
  return {
    id: row.id,
    estateId: row.estate_id,
    residentId: row.resident_id ?? "",
    residentName: row.resident_name,
    houseNumber: row.house_number,
    phone: row.phone ?? "",
    type: row.alert_type,
    status: row.status,
    notes: row.notes ?? "",
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    acknowledgedBy: row.acknowledged_by ?? undefined,
    siren: Boolean(row.siren_requested),
    locationLabel: row.location_label ?? row.house_number ?? "Estate location"
  };
}

function mapAccessRequest(row: SupabaseAccessRequest): LocalAccessRequest {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    password: "",
    role: row.requested_role,
    estate: relationName(row.estates) ?? DEFAULT_ESTATE_NAME,
    status: row.status,
    requestedAt: String(row.requested_at).slice(0, 10),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at).slice(0, 10) : undefined
  };
}

function mapApprovedUser(row: SupabaseAccessRequest): LocalApprovedUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    password: "",
    role: row.requested_role,
    estate: relationName(row.estates) ?? DEFAULT_ESTATE_NAME,
    approvedAt: row.reviewed_at ? String(row.reviewed_at).slice(0, 10) : String(row.requested_at).slice(0, 10)
  };
}

function estateIdForName(name: string) {
  return name === DEFAULT_ESTATE_NAME ? LBS_VIEW_ESTATE_ID : LBS_VIEW_ESTATE_ID;
}

function relationName(value: unknown) {
  if (Array.isArray(value)) {
    return value[0]?.name;
  }

  if (value && typeof value === "object" && "name" in value) {
    return String((value as { name?: string }).name ?? "");
  }

  return null;
}

function fromSupabaseVisitorStatus(status: string): Visitor["status"] {
  return status.replaceAll("_", "-") as Visitor["status"];
}

function fromSupabaseVisitorDecision(status: string): LocalVisitorLog["decision"] {
  return status.replaceAll("_", "-") as LocalVisitorLog["decision"];
}

function toSupabaseVisitorStatus(status: Visitor["status"]) {
  return status.replaceAll("-", "_");
}

function fromSupabaseBillStatus(status: string): Bill["status"] {
  return status.replaceAll("_", " ") as Bill["status"];
}

function toSupabaseBillStatus(status: Bill["status"]) {
  return status.replaceAll(" ", "_");
}

function fromSupabaseComplaintStatus(status: string): Complaint["status"] {
  return status.replaceAll("_", " ") as Complaint["status"];
}

function toSupabaseComplaintStatus(status: Complaint["status"]) {
  return status.replaceAll(" ", "_");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
