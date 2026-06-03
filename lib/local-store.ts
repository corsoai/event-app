"use client";

import { useEffect, useState } from "react";
import { bills, complaints, emergencyAlerts, estates, payments, residents as demoResidents, visitors } from "@/lib/demo-data";
import {
  approveSupabaseAccessRequest,
  loadSupabaseEstateState,
  mapSupabaseEmergencyAlert,
  rejectSupabaseAccessRequest,
  saveSupabaseEstate,
  saveSupabaseEmergencyAlert,
  saveSupabaseBill,
  saveSupabaseComplaint,
  saveSupabasePayment,
  saveSupabaseVisitor,
  updateSupabaseEmergencyAlertStatus,
  updateSupabaseResident,
  updateSupabaseVisitorStatus
} from "@/lib/supabase/data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Bill, Complaint, EmergencyAlert, EmergencyAlertStatus, EmergencyAlertType, Estate, Payment, Resident, UserRole, Visitor } from "@/lib/types";
import { loginIdentifierToEmail, makeAccessCode, normalizePhoneNumber, phoneAuthEmail, sortEstatesWithDefaultFirst } from "@/lib/utils";
import { getVisitorExpiresAtIso } from "@/lib/visitor-window";

const STORAGE_KEY = "corso_estate_local_db_v1";
const STATE_UPDATED_EVENT = "corso_estate_state_updated";
const LEGACY_ESTATE_TOKEN = ["lekki", "gardens"].join("");

export type LocalVisitorLog = {
  id: string;
  visitorId: string;
  visitorName: string;
  code: string;
  gateName: string;
  guardName: string;
  entryTime?: string;
  exitTime?: string;
  decision: "verified" | "checked-in" | "checked-out" | "rejected";
  createdAt: string;
};

export type LocalEstateState = {
  estates: Estate[];
  visitors: Visitor[];
  visitorLogs: LocalVisitorLog[];
  bills: Bill[];
  payments: Payment[];
  complaints: Complaint[];
  emergencyAlerts: EmergencyAlert[];
  residents: Resident[];
  accessRequests: LocalAccessRequest[];
  approvedUsers: LocalApprovedUser[];
};

export type LocalAccessRequest = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  estate: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  reviewedAt?: string;
};

export type LocalApprovedUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  estate: string;
  residentId?: string;
  approvedAt: string;
};

export type LocalSessionUser = {
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  estate: string;
};

type VisitorInput = {
  visitorName: string;
  phone: string;
  visitDate: string;
  arrivalTime: string;
  purpose: string;
  count: number;
};

type ComplaintInput = {
  category: Complaint["category"];
  title: string;
  description: string;
  priority: Complaint["priority"];
};

type PaymentInput = {
  billId: string;
  amount: number;
  reference: string;
};

type EmergencyAlertInput = {
  type: EmergencyAlertType;
  notes: string;
  siren: boolean;
  locationLabel?: string;
};

type BillInput = {
  title: string;
  amount: number;
  dueDate: string;
  residentId: string;
};

type EstateInput = {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  gateName: string;
};

type ResidentUpdateInput = Pick<Resident, "name" | "houseNumber" | "phone" | "email" | "type" | "status">;

function defaultState(): LocalEstateState {
  return {
    estates,
    visitors,
    visitorLogs: [
      {
        id: "log-vis-002",
        visitorId: "vis-002",
        visitorName: "Kemi Adeyemi",
        code: "739204",
        gateName: "Main Gate A",
        guardName: "Officer Musa",
        entryTime: "10:12 AM",
        decision: "checked-in",
        createdAt: "2026-05-15"
      }
    ],
    bills,
    payments,
    complaints,
    emergencyAlerts,
    residents: demoResidents,
    accessRequests: [],
    approvedUsers: []
  };
}

export function readLocalEstateState() {
  if (typeof window === "undefined") {
    return defaultState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState();
  }

  try {
    return normalizeLocalEstateState(JSON.parse(raw) as Partial<LocalEstateState>);
  } catch {
    return defaultState();
  }
}

function saveLocalEstateState(next: LocalEstateState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(STATE_UPDATED_EVENT));
  }
}

function formatTime() {
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueCode(existingVisitors: Visitor[]) {
  let code = makeAccessCode();
  while (existingVisitors.some((visitor) => visitor.code === code)) {
    code = makeAccessCode();
  }
  return code;
}

function isOpenEmergencyAlert(alert: EmergencyAlert) {
  return alert.status === "active" || alert.status === "acknowledged";
}

function mergeEmergencyAlerts(localAlerts: EmergencyAlert[], remoteAlerts: EmergencyAlert[]) {
  const remoteIds = new Set(remoteAlerts.map((alert) => alert.id));
  const preservedLocalAlerts = localAlerts.filter(
    (alert) => isOpenEmergencyAlert(alert) && !remoteIds.has(alert.id)
  );

  return [...preservedLocalAlerts, ...remoteAlerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function mergeSupabaseEstateState(localState: LocalEstateState, supabaseState: LocalEstateState): LocalEstateState {
  return {
    ...supabaseState,
    emergencyAlerts: mergeEmergencyAlerts(localState.emergencyAlerts, supabaseState.emergencyAlerts)
  };
}

function upsertEmergencyAlert(alerts: EmergencyAlert[], alert: EmergencyAlert) {
  return [alert, ...alerts.filter((item) => item.id !== alert.id)].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function realtimeEmergencyAlertFromPayload(payload: { new?: Record<string, unknown> | null }) {
  if (!payload.new?.id) {
    return null;
  }

  return mapSupabaseEmergencyAlert(payload.new);
}

export function useLocalEstateStore() {
  const [state, setState] = useState<LocalEstateState>(() => defaultState());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(readLocalEstateState());
    setLoaded(true);

    function syncLocalState() {
      setState(readLocalEstateState());
    }

    window.addEventListener(STATE_UPDATED_EVENT, syncLocalState);
    window.addEventListener("storage", syncLocalState);

    let active = true;
    const supabase = getSupabaseBrowserClient();
    let emergencyAlertsChannel: ReturnType<NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]> | null = null;

    loadSupabaseEstateState()
      .then((supabaseState) => {
        if (!active || !supabaseState) {
          return;
        }

        setState((current) => {
          const next = mergeSupabaseEstateState(current, supabaseState);
          saveLocalEstateState(next);
          return next;
        });
      })
      .catch(() => {
        // Local demo data remains available when Supabase is not ready.
      });

    if (supabase) {
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (!active || !session) {
            return;
          }

          emergencyAlertsChannel = supabase
            .channel("corso-emergency-alerts")
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "emergency_alerts" },
              (payload) => {
                const realtimeAlert = realtimeEmergencyAlertFromPayload(payload);
                if (realtimeAlert) {
                  setState((current) => {
                    const next = {
                      ...current,
                      emergencyAlerts: upsertEmergencyAlert(current.emergencyAlerts, realtimeAlert)
                    };
                    saveLocalEstateState(next);
                    return next;
                  });
                }

                void loadSupabaseEstateState()
                  .then((supabaseState) => {
                    if (!active || !supabaseState) {
                      return;
                    }

                    setState((current) => {
                      const next = mergeSupabaseEstateState(current, supabaseState);
                      saveLocalEstateState(next);
                      return next;
                    });
                  })
                  .catch(() => {
                    // The last loaded state remains available if realtime refresh fails.
                  });
              }
            )
            .subscribe();
        })
        .catch(() => {
          // Local storage events still keep same-device demo sessions in sync.
        });
    }

    return () => {
      active = false;
      if (emergencyAlertsChannel) {
        void supabase?.removeChannel(emergencyAlertsChannel);
      }
      window.removeEventListener(STATE_UPDATED_EVENT, syncLocalState);
      window.removeEventListener("storage", syncLocalState);
    };
  }, []);

  function commit(updater: (current: LocalEstateState) => LocalEstateState) {
    setState((current) => {
      const next = updater(current);
      saveLocalEstateState(next);
      return next;
    });
  }

  function createAccessRequest(input: {
    fullName: string;
    email?: string;
    phone: string;
    password: string;
    role: UserRole;
    estate: string;
  }) {
    const request = createLocalAccessRequest(input);
    setState(readLocalEstateState());
    return request;
  }

  async function approveAccessRequest(requestId: string) {
    if (!getSupabaseBrowserClient()) {
      commit((current) => approveLocalAccessRequest(current, requestId));
      return;
    }

    const result = await approveSupabaseAccessRequest(requestId);
    if (result.requests) {
      commit((current) => ({ ...current, accessRequests: result.requests }));
    }

    const supabaseState = await loadSupabaseEstateState();
    if (supabaseState) {
      setState((current) => {
        const next = mergeSupabaseEstateState(current, supabaseState);
        saveLocalEstateState(next);
        return next;
      });
    }
  }

  async function rejectAccessRequest(requestId: string) {
    if (!getSupabaseBrowserClient()) {
      commit((current) => ({
        ...current,
        accessRequests: current.accessRequests.map((request) =>
          request.id === requestId
            ? { ...request, status: "rejected" as const, reviewedAt: today() }
            : request
          )
      }));
      return;
    }

    const result = await rejectSupabaseAccessRequest(requestId);
    if (result.requests) {
      commit((current) => ({ ...current, accessRequests: result.requests }));
    }

    const supabaseState = await loadSupabaseEstateState();
    if (supabaseState) {
      setState((current) => {
        const next = mergeSupabaseEstateState(current, supabaseState);
        saveLocalEstateState(next);
        return next;
      });
    }
  }

  function addVisitor(input: VisitorInput) {
    const resident = getCurrentResident(state);
    const createdAt = new Date().toISOString();
    const visitor: Visitor = {
      id: `vis-${Date.now()}`,
      residentId: resident.id,
      estateId: resident.estateId,
      visitorName: input.visitorName,
      phone: input.phone,
      visitDate: input.visitDate,
      arrivalTime: input.arrivalTime,
      purpose: input.purpose,
      count: input.count,
      code: uniqueCode(state.visitors),
      createdAt,
      expiresAt: getVisitorExpiresAtIso({ createdAt, visitDate: input.visitDate, arrivalTime: input.arrivalTime }),
      status: "pending"
    };

    commit((current) => ({
      ...current,
      visitors: [visitor, ...current.visitors]
    }));
    void saveSupabaseVisitor(visitor).catch(() => {
      // Local demo invites remain available on this device when Supabase rejects the insert.
    });

    return visitor;
  }

  function addVisitorRecord(visitor: Visitor) {
    commit((current) => ({
      ...current,
      visitors: [visitor, ...current.visitors.filter((item) => item.id !== visitor.id)]
    }));

    return visitor;
  }

  function updateVisitorStatus(visitorId: string, status: Visitor["status"]) {
    commit((current) => {
      const visitor = current.visitors.find((item) => item.id === visitorId);
      if (!visitor) {
        return current;
      }

      const nextVisitors = current.visitors.map((item) =>
        item.id === visitorId ? { ...item, status } : item
      );
      const existingLog = current.visitorLogs.find((item) => item.visitorId === visitorId);
      const decision =
        status === "cancelled" ? "rejected" : status === "verified" ? "verified" : status;
      const log: LocalVisitorLog = {
        id: existingLog?.id ?? `log-${Date.now()}`,
        visitorId,
        visitorName: visitor.visitorName,
        code: visitor.code,
        gateName: "Main Gate A",
        guardName: "Officer Musa",
        entryTime: status === "checked-in" ? formatTime() : existingLog?.entryTime,
        exitTime: status === "checked-out" ? formatTime() : existingLog?.exitTime,
        decision: decision as LocalVisitorLog["decision"],
        createdAt: today()
      };

      return {
        ...current,
        visitors: nextVisitors,
        visitorLogs: existingLog
          ? current.visitorLogs.map((item) => (item.visitorId === visitorId ? log : item))
          : [log, ...current.visitorLogs]
      };
    });
    const visitor = state.visitors.find((item) => item.id === visitorId);
    if (visitor) {
      void updateSupabaseVisitorStatus(visitor, status).catch(() => {
        // Local status changes remain available on this device when online sync rejects the update.
      });
    }
  }

  async function updateResident(residentId: string, input: ResidentUpdateInput) {
    const currentResident = state.residents.find((resident) => resident.id === residentId);
    if (!currentResident) {
      throw new Error("Resident record was not found.");
    }

    if (getSupabaseBrowserClient()) {
      const updatedResident = await updateSupabaseResident(residentId, input);
      commit((current) => ({
        ...current,
        residents: current.residents.map((resident) =>
          resident.id === residentId ? updatedResident : resident
        )
      }));
      return updatedResident;
    }

    const updatedResident: Resident = {
      ...currentResident,
      ...input
    };

    commit((current) => ({
      ...current,
      residents: current.residents.map((resident) =>
        resident.id === residentId ? updatedResident : resident
      )
    }));

    return updatedResident;
  }

  function addComplaint(input: ComplaintInput) {
    const resident = getCurrentResident(state);
    const complaint: Complaint = {
      id: `cmp-${Date.now()}`,
      residentId: resident.id,
      category: input.category,
      title: input.title,
      priority: input.priority,
      status: "open",
      createdAt: today(),
      assignedTo: "Estate admin desk"
    };

    commit((current) => ({
      ...current,
      complaints: [complaint, ...current.complaints]
    }));
    void saveSupabaseComplaint(complaint);

    return complaint;
  }

  function createEmergencyAlert(input: EmergencyAlertInput) {
    const resident = getCurrentResident(state);
    const estate = state.estates.find((item) => item.id === resident.estateId) ?? state.estates[0];
    const alertId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sos-${Date.now()}`;
    const alert: EmergencyAlert = {
      id: alertId,
      estateId: resident.estateId,
      residentId: resident.id,
      residentName: resident.name,
      houseNumber: resident.houseNumber,
      phone: resident.phone,
      type: input.type,
      status: "active",
      notes: input.notes.trim(),
      createdAt: new Date().toISOString(),
      siren: input.siren,
      locationLabel: input.locationLabel?.trim() || `${resident.houseNumber}, ${estate?.address ?? "LBS View Estate"}`
    };

    commit((current) => ({
      ...current,
      emergencyAlerts: [alert, ...current.emergencyAlerts]
    }));
    void saveSupabaseEmergencyAlert(alert).catch(() => {
      // Local SOS alerts remain visible when online sync is not ready.
    });

    return alert;
  }

  function updateEmergencyAlertStatus(alertId: string, status: EmergencyAlertStatus) {
    const timestamp = new Date().toISOString();
    let updatedAlert: EmergencyAlert | null = null;

    commit((current) => ({
      ...current,
      emergencyAlerts: current.emergencyAlerts.map((alert) => {
        if (alert.id !== alertId) {
          return alert;
        }

        updatedAlert = {
          ...alert,
          status,
          acknowledgedAt: status === "acknowledged" ? timestamp : alert.acknowledgedAt,
          acknowledgedBy: status === "acknowledged" ? "Security control room" : alert.acknowledgedBy,
          resolvedAt: status === "resolved" || status === "false_alarm" || status === "cancelled" ? timestamp : alert.resolvedAt
        };

        return updatedAlert;
      })
    }));

    if (updatedAlert) {
      void updateSupabaseEmergencyAlertStatus(updatedAlert, status).catch(() => {
        // Local incident response state remains available when online sync is not ready.
      });
    }

    return updatedAlert;
  }

  function addPayment(input: PaymentInput) {
    const bill = state.bills.find((item) => item.id === input.billId) ?? state.bills[0];
    const resident = getCurrentResident(state);
    const payment: Payment = {
      id: `pay-${Date.now()}`,
      billId: bill.id,
      residentId: bill.residentId || resident.id,
      amount: input.amount,
      reference: input.reference,
      date: today(),
      status: "pending"
    };

    commit((current) => ({
      ...current,
      payments: [payment, ...current.payments],
      bills: current.bills.map((item) =>
        item.id === bill.id && item.status === "unpaid" ? { ...item, status: "partially paid" } : item
      )
    }));
    void saveSupabasePayment(payment);

    return payment;
  }

  function confirmPayment(paymentId: string) {
    commit((current) => {
      const payment = current.payments.find((item) => item.id === paymentId);
      if (!payment) {
        return current;
      }

      return {
        ...current,
        payments: current.payments.map((item) =>
          item.id === paymentId ? { ...item, status: "confirmed" } : item
        ),
        bills: current.bills.map((item) =>
          item.id === payment.billId ? { ...item, status: "paid" } : item
        )
      };
    });
  }

  function markBillPaid(billId: string) {
    commit((current) => ({
      ...current,
      bills: current.bills.map((item) =>
        item.id === billId ? { ...item, status: "paid" } : item
      )
    }));
  }

  function addBill(input: BillInput) {
    const resident = state.residents.find((item) => item.id === input.residentId);
    const bill: Bill = {
      id: `bill-${Date.now()}`,
      residentId: input.residentId,
      estateId: resident?.estateId ?? state.estates[0]?.id ?? "lekki-gardens",
      title: input.title,
      amount: input.amount,
      dueDate: input.dueDate,
      status: "unpaid"
    };

    commit((current) => ({
      ...current,
      bills: [bill, ...current.bills]
    }));
    void saveSupabaseBill(bill);

    return bill;
  }

  function addEstate(input: EstateInput) {
    const estate: Estate = {
      id: makeEstateId(),
      name: input.name,
      address: input.address,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      gateName: input.gateName
    };

    commit((current) => ({
      ...current,
      estates: sortEstatesWithDefaultFirst([estate, ...current.estates])
    }));
    void saveSupabaseEstate(estate)
      .then(loadSupabaseEstateState)
      .then((supabaseState) => {
        if (supabaseState) {
          setState((current) => {
            const next = mergeSupabaseEstateState(current, supabaseState);
            saveLocalEstateState(next);
            return next;
          });
        }
      })
      .catch(() => {
        // Local estate creation still works when Supabase is not configured.
      });

    return estate;
  }

  function resetLocalDemo() {
    const fresh = defaultState();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    }
    setState(fresh);
  }

  async function refreshEstateState() {
    try {
      const supabaseState = await loadSupabaseEstateState();
      if (supabaseState) {
        setState((current) => {
          const next = mergeSupabaseEstateState(current, supabaseState);
          saveLocalEstateState(next);
          return next;
        });
        return;
      }
    } catch {
      // Keep the local state available when Supabase is not reachable.
    }

    setState(readLocalEstateState());
  }

  return {
    state,
    loaded,
    refreshEstateState,
    createAccessRequest,
    approveAccessRequest,
    rejectAccessRequest,
    addVisitor,
    addVisitorRecord,
    updateVisitorStatus,
    updateResident,
    addComplaint,
    createEmergencyAlert,
    updateEmergencyAlertStatus,
    addPayment,
    confirmPayment,
    markBillPaid,
    addBill,
    addEstate,
    resetLocalDemo
  };
}

export function createLocalAccessRequest(input: {
  fullName: string;
  email?: string;
  phone: string;
  password: string;
  role: UserRole;
  estate: string;
}) {
  const current = readLocalEstateState();
  const normalizedPhone = normalizePhoneNumber(input.phone);
  const normalizedEmail = input.email?.trim().toLowerCase() ?? "";
  const authEmail = normalizedEmail || phoneAuthEmail(normalizedPhone);
  const existingApproved = current.approvedUsers.find(
    (user) => user.email === authEmail || user.phone === normalizedPhone
  );
  const existingPending = current.accessRequests.find(
    (request) => request.status === "pending" && (request.email === authEmail || request.phone === normalizedPhone)
  );

  if (existingApproved) {
    return { status: "already-approved" as const, request: existingApproved };
  }

  if (existingPending) {
    return { status: "already-pending" as const, request: existingPending };
  }

  const request: LocalAccessRequest = {
    id: `req-${Date.now()}`,
    fullName: input.fullName || normalizedPhone,
    email: authEmail,
    phone: normalizedPhone,
    password: input.password,
    role: input.role,
    estate: input.estate,
    status: "pending",
    requestedAt: today()
  };

  saveLocalEstateState({
    ...current,
    accessRequests: [request, ...current.accessRequests]
  });

  return { status: "created" as const, request };
}

export function findApprovedLocalUser(identifier: string, password: string) {
  const normalizedEmail = loginIdentifierToEmail(identifier);
  const normalizedPhone = normalizePhoneNumber(identifier);
  return readLocalEstateState().approvedUsers.find(
    (user) => (user.email === normalizedEmail || user.phone === normalizedPhone) && user.password === password
  );
}

export function findLocalAccessRequest(identifier: string) {
  const normalizedEmail = loginIdentifierToEmail(identifier);
  const normalizedPhone = normalizePhoneNumber(identifier);
  return readLocalEstateState().accessRequests.find(
    (request) => request.email === normalizedEmail || request.phone === normalizedPhone
  );
}

export function readLocalSessionUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem("corso_user");
    return raw ? (JSON.parse(raw) as LocalSessionUser) : null;
  } catch {
    return null;
  }
}

export function getCurrentResident(state: LocalEstateState) {
  const session = readLocalSessionUser();

  if (!session || session.role !== "resident") {
    return state.residents[0] ?? demoResidents[0];
  }

  const normalizedEmail = session.email.trim().toLowerCase();
  const normalizedPhone = normalizePhoneNumber(session.phone ?? "");
  const approvedUser = state.approvedUsers.find(
    (user) => user.email === normalizedEmail || (!!normalizedPhone && user.phone === normalizedPhone)
  );
  const approvedResident = approvedUser?.residentId
    ? state.residents.find((resident) => resident.id === approvedUser.residentId)
    : undefined;
  const residentByEmail = state.residents.find((resident) => resident.email.toLowerCase() === normalizedEmail);
  const residentByName = state.residents.find((resident) => resident.name.toLowerCase() === session.name.toLowerCase());

  return approvedResident ?? residentByEmail ?? residentByName ?? makeResidentProfile({
    fullName: session.name,
    email: normalizedEmail,
    phone: normalizedPhone || "Not provided",
    estate: session.estate,
    residentId: residentIdForIdentifier(normalizedPhone || normalizedEmail)
  });
}

export function removeLegacyLekkiAccounts() {
  if (typeof window === "undefined") {
    return;
  }

  const current = readLocalEstateState();
  const withoutLegacyEmails: LocalEstateState = {
    ...current,
    accessRequests: current.accessRequests.filter(
      (request) => !isLegacyEstateValue(request.email)
    ),
    approvedUsers: current.approvedUsers.filter(
      (user) => !isLegacyEstateValue(user.email)
    )
  };

  saveLocalEstateState(withoutLegacyEmails);

  const currentUser = window.localStorage.getItem("corso_user");
  if (currentUser && isLegacyEstateValue(currentUser)) {
    window.localStorage.removeItem("corso_user");
    document.cookie = "corso_role=; Max-Age=0; path=/";
  }
}

export function isLegacyEstateValue(value: string) {
  return value.toLowerCase().includes(LEGACY_ESTATE_TOKEN);
}

function approveLocalAccessRequest(current: LocalEstateState, requestId: string) {
  const request = current.accessRequests.find((item) => item.id === requestId);
  if (!request) {
    return current;
  }

  const residentId = request.role === "resident" ? residentIdForIdentifier(request.phone || request.email) : undefined;
  const approvedUser: LocalApprovedUser = {
    id: `user-${Date.now()}`,
    fullName: request.fullName,
    email: request.email,
    phone: request.phone,
    password: request.password,
    role: request.role,
    estate: request.estate,
    residentId,
    approvedAt: today()
  };
  const hasResident = residentId
    ? current.residents.some(
        (resident) =>
          resident.id === residentId ||
          resident.email.toLowerCase() === request.email ||
          (!!request.phone && normalizePhoneNumber(resident.phone) === request.phone)
      )
    : true;
  const residentProfile = residentId
    ? makeResidentProfile({
        fullName: request.fullName,
        email: request.email,
        phone: request.phone || "Not provided",
        estate: request.estate,
        residentId
      })
    : null;

  return {
    ...current,
    accessRequests: current.accessRequests.map((item) =>
      item.id === requestId ? { ...item, status: "approved" as const, reviewedAt: today() } : item
    ),
    approvedUsers: current.approvedUsers.some((user) => user.email === request.email)
      ? current.approvedUsers
      : [approvedUser, ...current.approvedUsers],
    residents: !hasResident && residentProfile ? [residentProfile, ...current.residents] : current.residents
  };
}

function normalizeLocalEstateState(saved: Partial<LocalEstateState>) {
  const defaults = defaultState();
  const approvedUsers = (saved.approvedUsers ?? defaults.approvedUsers).map((user) =>
    user.role === "resident" && !user.residentId
      ? { ...user, phone: user.phone ?? "", residentId: residentIdForIdentifier(user.phone || user.email) }
      : { ...user, phone: user.phone ?? "" }
  );
  const accessRequests = (saved.accessRequests ?? defaults.accessRequests).map((request) => ({
    ...request,
    phone: request.phone ?? ""
  }));
  const savedResidents = saved.residents?.length ? saved.residents : defaults.residents;
  const approvedResidentProfiles = approvedUsers
    .filter((user) => user.role === "resident")
    .map((user) =>
      makeResidentProfile({
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || "Not provided",
        estate: user.estate,
        residentId: user.residentId ?? residentIdForIdentifier(user.phone || user.email)
      })
    )
    .filter(
      (profile) =>
        !savedResidents.some(
          (resident) =>
            resident.id === profile.id ||
            resident.email.toLowerCase() === profile.email.toLowerCase()
        )
    );

  return {
    ...defaults,
    ...saved,
    estates: sortEstatesWithDefaultFirst(saved.estates?.length ? saved.estates : defaults.estates),
    accessRequests,
    residents: [...savedResidents, ...approvedResidentProfiles],
    emergencyAlerts: saved.emergencyAlerts ?? defaults.emergencyAlerts,
    approvedUsers
  } as LocalEstateState;
}

function makeResidentProfile({
  fullName,
  email,
  phone,
  estate,
  residentId
}: {
  fullName: string;
  email: string;
  phone: string;
  estate: string;
  residentId: string;
}): Resident {
  return {
    id: residentId,
    estateId: estateIdForName(estate),
    name: fullName,
    houseNumber: "Pending assignment",
    phone,
    email,
    type: "tenant",
    status: "active"
  };
}

function residentIdForIdentifier(identifier: string) {
  const slug = identifier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `res-local-${slug || "resident"}`;
}

function estateIdForName(name: string) {
  return estates.find((estate) => estate.name === name)?.id ?? "lekki-gardens";
}

function makeEstateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `estate-${Date.now()}`;
}
