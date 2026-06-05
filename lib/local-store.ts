"use client";

import { useEffect, useState } from "react";
import {
  auditLogs,
  estates,
  properties,
  units
} from "@/lib/demo-data";
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
import type {
  AuditLog,
  Bill,
  Complaint,
  EmergencyAlert,
  EmergencyAlertStatus,
  EmergencyAlertType,
  Estate,
  Payment,
  PaymentChannel,
  PaymentProcessor,
  Property,
  Resident,
  Unit,
  UserRole,
  Visitor
} from "@/lib/types";
import { loginIdentifierToEmail, makeAccessCode, normalizePhoneNumber, phoneAuthEmail, sortEstatesWithDefaultFirst } from "@/lib/utils";
import { getVisitorExpiresAtIso } from "@/lib/visitor-window";

const STORAGE_KEY = "corso_estate_local_db_v1";
const STATE_UPDATED_EVENT = "corso_estate_state_updated";
const LEGACY_ESTATE_TOKEN = ["lekki", "gardens"].join("");
const LAGOS_TIME_ZONE = "Africa/Lagos";
const DEMO_RESIDENT_IDS = new Set(["res-001", "res-002", "res-003", "res-004"]);

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
  properties: Property[];
  units: Unit[];
  visitors: Visitor[];
  visitorLogs: LocalVisitorLog[];
  bills: Bill[];
  payments: Payment[];
  complaints: Complaint[];
  emergencyAlerts: EmergencyAlert[];
  residents: Resident[];
  accessRequests: LocalAccessRequest[];
  approvedUsers: LocalApprovedUser[];
  auditLogs: AuditLog[];
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
  channel?: PaymentChannel;
  processor?: PaymentProcessor;
  source?: Payment["source"];
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
  category?: string;
  unitId?: string;
};

type EstateInput = {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  gateName: string;
};

type PropertyInput = {
  estateId: string;
  propertyCode: string;
  name: string;
  description: string;
  street: string;
  legacyName?: string;
  status?: Property["status"];
};

type UnitInput = {
  estateId: string;
  propertyId: string;
  unitCode: string;
  label: string;
  apartmentType: string;
  status?: Unit["status"];
  moveInDate?: string;
  legacyName?: string;
};

type ResidentUpdateInput = Pick<Resident, "name" | "houseNumber" | "phone" | "email" | "type" | "status"> & {
  propertyId?: string;
  unitId?: string;
  moveInDate?: string;
  legacyName?: string;
  legacyAddress?: string;
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

type ManagedLocalUserInput = {
  fullName: string;
  email?: string;
  phone: string;
  password: string;
  role: UserRole;
  estateId: string;
  houseNumber?: string;
};

function defaultState(): LocalEstateState {
  return {
    estates,
    properties,
    units,
    visitors: [],
    visitorLogs: [],
    bills: [],
    payments: [],
    complaints: [],
    emergencyAlerts: [],
    residents: [],
    accessRequests: [],
    approvedUsers: [],
    auditLogs
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
    minute: "2-digit",
    timeZone: LAGOS_TIME_ZONE
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

function paymentTotalForBill(paymentsList: Payment[], billId: string) {
  return paymentsList
    .filter((payment) => payment.billId === billId && payment.status === "confirmed")
    .reduce((sum, payment) => sum + payment.amount, 0);
}

async function updateDemoVisitorStatus(visitor: Visitor, status: Visitor["status"]) {
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

function billStatusForPaymentTotal(bill: Bill, paidAmount: number): Bill["status"] {
  if (paidAmount >= bill.amount) {
    return "paid";
  }

  if (paidAmount > 0) {
    return "partially paid";
  }

  return bill.status === "overdue" ? "overdue" : "unpaid";
}

function addAuditLog(current: LocalEstateState, log: Omit<AuditLog, "id" | "createdAt">) {
  const auditLog: AuditLog = {
    id: `audit-${Date.now()}-${current.auditLogs.length + 1}`,
    createdAt: new Date().toISOString(),
    ...log
  };

  return [auditLog, ...current.auditLogs];
}

function slugForId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

function entityId(prefix: string, value: string) {
  return `${prefix}-${slugForId(value)}`;
}

function nextEntityId(prefix: string, value: string) {
  return `${entityId(prefix, value)}-${Date.now()}`;
}

function normalizePropertyCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function propertyCodeFromUnitCode(unitCode: string) {
  const normalized = normalizeOnboardingUnitCode(unitCode);
  const ldiMatch = normalized.match(/^(LDI-\d+)-[A-Z0-9]+$/);

  if (ldiMatch) {
    return ldiMatch[1];
  }

  if (normalized.startsWith("JC-")) {
    return "JC";
  }

  if (normalized.startsWith("AA-")) {
    return "AA";
  }

  return normalized.split("-").slice(0, -1).join("-") || normalized;
}

export function normalizeOnboardingUnitCode(value: string, propertyCode = "") {
  const raw = value
    .trim()
    .toUpperCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-");
  const normalizedPropertyCode = normalizePropertyCode(propertyCode);
  const jcMatch = raw.match(/^JC-?(\d+)$/);
  const ateeqMatch = raw.match(/^A-?(\d+)$/);
  const aaMatch = raw.match(/^AA-?(\d+)$/);

  if (jcMatch) {
    return `JC-${Number(jcMatch[1])}`;
  }

  if (aaMatch) {
    return `AA-${Number(aaMatch[1])}`;
  }

  if (normalizedPropertyCode === "AA" && ateeqMatch) {
    return `AA-${Number(ateeqMatch[1])}`;
  }

  return raw;
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
      if (getSupabaseBrowserClient()) {
        void updateSupabaseVisitorStatus(visitor, status).catch(() => {
          // Local status changes remain available on this device when online sync rejects the update.
        });
      } else {
        void updateDemoVisitorStatus(visitor, status);
      }
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
      ...input,
      houseNumber: input.houseNumber || currentResident.houseNumber,
      propertyId: input.propertyId ?? currentResident.propertyId,
      unitId: input.unitId ?? currentResident.unitId,
      moveInDate: input.moveInDate ?? currentResident.moveInDate
    };

    commit((current) => ({
      ...current,
      residents: current.residents.map((resident) =>
        resident.id === residentId ? updatedResident : resident
      ),
      units: current.units.map((unit) => {
        if (unit.id === updatedResident.unitId) {
          return {
            ...unit,
            propertyId: updatedResident.propertyId ?? unit.propertyId,
            currentResidentId: updatedResident.id,
            status: updatedResident.status === "moved out" ? "moved out" : "occupied",
            moveInDate: updatedResident.moveInDate ?? unit.moveInDate
          };
        }

        if (unit.currentResidentId === updatedResident.id) {
          return {
            ...unit,
            currentResidentId: undefined,
            status: unit.status === "moved out" ? "moved out" : "vacant"
          };
        }

        return unit;
      }),
      auditLogs: addAuditLog(current, {
        estateId: updatedResident.estateId,
        actor: "Estate admin",
        action: "updated resident unit assignment",
        entityType: "resident",
        entityId: updatedResident.id,
        metadata: {
          propertyId: updatedResident.propertyId ?? "",
          unitId: updatedResident.unitId ?? "",
          unitCode: updatedResident.houseNumber
        }
      })
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
      locationLabel: input.locationLabel?.trim() || `${residentUnitLabel(state, resident)}, ${estate?.address ?? "LBS View Estate"}`
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
    const paymentResident = state.residents.find((item) => item.id === bill.residentId) ?? resident;
    const payment: Payment = {
      id: `pay-${Date.now()}`,
      billId: bill.id,
      residentId: bill.residentId || resident.id,
      estateId: bill.estateId ?? paymentResident.estateId,
      propertyId: bill.propertyId ?? paymentResident.propertyId,
      unitId: bill.unitId ?? paymentResident.unitId,
      amount: input.amount,
      reference: input.reference,
      processor: input.processor ?? "manual",
      channel: input.channel ?? "bank_transfer",
      date: today(),
      status: input.source === "webhook" ? "confirmed" : "pending",
      source: input.source ?? "resident",
      confirmedAt: input.source === "webhook" ? new Date().toISOString() : undefined,
      confirmedBy: input.source === "webhook" ? `${input.processor ?? "payment"} webhook` : undefined
    };

    commit((current) => {
      const nextPayments = [payment, ...current.payments];

      return {
        ...current,
        payments: nextPayments,
        bills: current.bills.map((item) => {
          if (item.id !== bill.id) {
            return item;
          }

          const paidAmount = paymentTotalForBill(nextPayments, item.id);
          return {
            ...item,
            paidAmount,
            status: payment.status === "confirmed"
              ? billStatusForPaymentTotal(item, paidAmount)
              : item.status
          };
        }),
        auditLogs: addAuditLog(current, {
          estateId: payment.estateId ?? bill.estateId,
          actor: payment.source === "webhook" ? `${payment.processor ?? "payment"} webhook` : "Resident upload",
          action: payment.source === "webhook" ? "confirmed online payment" : "submitted manual payment proof",
          entityType: "payment",
          entityId: payment.id,
          metadata: {
            billId: payment.billId,
            amount: payment.amount,
            channel: payment.channel ?? "bank_transfer",
            processor: payment.processor ?? "manual",
            reference: payment.reference
          }
        })
      };
    });
    void saveSupabasePayment(payment);

    return payment;
  }

  function confirmPayment(paymentId: string) {
    commit((current) => {
      const payment = current.payments.find((item) => item.id === paymentId);
      if (!payment) {
        return current;
      }

      const nextPayments = current.payments.map((item) =>
        item.id === paymentId
          ? {
              ...item,
              status: "confirmed" as const,
              confirmedAt: item.confirmedAt ?? new Date().toISOString(),
              confirmedBy: item.confirmedBy ?? "Estate admin"
            }
          : item
      );

      return {
        ...current,
        payments: nextPayments,
        bills: current.bills.map((item) => {
          if (item.id !== payment.billId) {
            return item;
          }

          const paidAmount = paymentTotalForBill(nextPayments, item.id);
          return {
            ...item,
            paidAmount,
            status: billStatusForPaymentTotal(item, paidAmount)
          };
        }),
        auditLogs: addAuditLog(current, {
          estateId: payment.estateId ?? current.bills.find((item) => item.id === payment.billId)?.estateId ?? "lekki-gardens",
          actor: "Estate admin",
          action: "confirmed manual payment",
          entityType: "payment",
          entityId: payment.id,
          metadata: {
            billId: payment.billId,
            amount: payment.amount,
            channel: payment.channel ?? "bank_transfer",
            reference: payment.reference
          }
        })
      };
    });
  }

  function markBillPaid(billId: string) {
    commit((current) => {
      const bill = current.bills.find((item) => item.id === billId);
      if (!bill) {
        return current;
      }

      const payment: Payment = {
        id: `pay-${Date.now()}`,
        billId: bill.id,
        residentId: bill.residentId,
        estateId: bill.estateId,
        propertyId: bill.propertyId,
        unitId: bill.unitId,
        amount: Math.max(0, bill.amount - (bill.paidAmount ?? paymentTotalForBill(current.payments, bill.id))),
        reference: `ADMIN-${Date.now()}`,
        processor: "manual",
        channel: "cash",
        date: today(),
        status: "confirmed",
        source: "admin",
        confirmedAt: new Date().toISOString(),
        confirmedBy: "Estate admin"
      };
      const nextPayments = payment.amount > 0 ? [payment, ...current.payments] : current.payments;

      return {
        ...current,
        payments: nextPayments,
        bills: current.bills.map((item) =>
          item.id === billId ? { ...item, paidAmount: item.amount, status: "paid" } : item
        ),
        auditLogs: addAuditLog(current, {
          estateId: bill.estateId,
          actor: "Estate admin",
          action: "marked bill paid manually",
          entityType: "bill",
          entityId: bill.id,
          metadata: {
            amount: bill.amount,
            residentId: bill.residentId,
            unitId: bill.unitId ?? ""
          }
        })
      };
    });
  }

  function addBill(input: BillInput) {
    const resident = state.residents.find((item) => item.id === input.residentId);
    const unit = state.units.find((item) => item.id === input.unitId) ?? state.units.find((item) => item.id === resident?.unitId);
    const bill: Bill = {
      id: `bill-${Date.now()}`,
      residentId: input.residentId,
      estateId: resident?.estateId ?? state.estates[0]?.id ?? "lekki-gardens",
      propertyId: unit?.propertyId ?? resident?.propertyId,
      unitId: unit?.id ?? resident?.unitId,
      category: input.category ?? "Service charge",
      title: input.title,
      amount: input.amount,
      paidAmount: 0,
      dueDate: input.dueDate,
      status: "unpaid"
    };

    commit((current) => ({
      ...current,
      bills: [bill, ...current.bills],
      auditLogs: addAuditLog(current, {
        estateId: bill.estateId,
        actor: "Estate admin",
        action: "created bill",
        entityType: "bill",
        entityId: bill.id,
        metadata: {
          amount: bill.amount,
          category: bill.category ?? "",
          residentId: bill.residentId,
          unitId: bill.unitId ?? ""
        }
      })
    }));
    void saveSupabaseBill(bill);

    return bill;
  }

  function addProperty(input: PropertyInput) {
    const propertyCode = normalizePropertyCode(input.propertyCode);
    const existingProperty = state.properties.find(
      (property) => property.propertyCode.toUpperCase() === propertyCode && property.estateId === input.estateId
    );
    const property: Property = {
      id: existingProperty?.id ?? entityId("prop", `${input.estateId}-${propertyCode}`),
      estateId: input.estateId,
      propertyCode,
      name: input.name.trim() || propertyCode,
      description: input.description.trim(),
      street: input.street.trim(),
      legacyName: input.legacyName?.trim() || undefined,
      status: input.status ?? "active"
    };

    commit((current) => ({
      ...current,
      properties: existingProperty
        ? current.properties.map((item) => (item.id === existingProperty.id ? property : item))
        : [property, ...current.properties],
      auditLogs: addAuditLog(current, {
        estateId: property.estateId,
        actor: "Estate admin",
        action: existingProperty ? "updated property group" : "created property group",
        entityType: "property",
        entityId: property.id,
        metadata: {
          propertyCode: property.propertyCode,
          legacyName: property.legacyName ?? ""
        }
      })
    }));

    return property;
  }

  function addUnit(input: UnitInput) {
    const property = state.properties.find((item) => item.id === input.propertyId);
    if (!property) {
      throw new Error("Choose a valid property group before creating a unit.");
    }

    const unitCode = normalizeOnboardingUnitCode(input.unitCode, property.propertyCode);
    const existingUnit = state.units.find(
      (unit) => unit.unitCode.toUpperCase() === unitCode && unit.estateId === input.estateId
    );
    const unit: Unit = {
      id: existingUnit?.id ?? entityId("unit", `${input.estateId}-${unitCode}`),
      estateId: input.estateId,
      propertyId: property.id,
      unitCode,
      label: input.label.trim() || unitCode,
      apartmentType: input.apartmentType.trim() || "Pending classification",
      status: input.status ?? existingUnit?.status ?? "vacant",
      currentResidentId: existingUnit?.currentResidentId,
      moveInDate: input.moveInDate?.trim() || existingUnit?.moveInDate,
      legacyName: input.legacyName?.trim() || existingUnit?.legacyName
    };

    commit((current) => ({
      ...current,
      units: existingUnit
        ? current.units.map((item) => (item.id === existingUnit.id ? unit : item))
        : [unit, ...current.units],
      auditLogs: addAuditLog(current, {
        estateId: unit.estateId,
        actor: "Estate admin",
        action: existingUnit ? "updated unit" : "created unit",
        entityType: "unit",
        entityId: unit.id,
        metadata: {
          propertyId: unit.propertyId,
          unitCode: unit.unitCode,
          legacyName: unit.legacyName ?? ""
        }
      })
    }));

    return unit;
  }

  function onboardResident(input: ResidentOnboardingInput) {
    const unit = state.units.find((item) => item.id === input.unitId);
    if (!unit) {
      throw new Error("Choose a valid unit before onboarding a resident.");
    }

    const property = state.properties.find((item) => item.id === unit.propertyId);
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(input.phone);
    const existingResident = state.residents.find(
      (resident) =>
        (!!normalizedEmail && resident.email.toLowerCase() === normalizedEmail) ||
        (!!normalizedPhone && normalizePhoneNumber(resident.phone) === normalizedPhone)
    );
    const residentId = existingResident?.id ?? nextEntityId("res", input.name || unit.unitCode);
    const activeOccupantId = input.status === "active" ? residentId : unit.currentResidentId;
    const resident: Resident = {
      id: residentId,
      estateId: input.estateId,
      propertyId: property?.id ?? unit.propertyId,
      unitId: unit.id,
      name: input.name.trim(),
      houseNumber: unit.unitCode,
      phone: normalizedPhone || input.phone.trim() || "Not provided",
      email: normalizedEmail,
      type: input.type,
      status: input.status,
      moveInDate: input.moveInDate?.trim() || undefined,
      legacyName: input.legacyName?.trim() || undefined,
      legacyAddress: input.legacyAddress?.trim() || undefined
    };
    const previousCurrentResidentId = unit.currentResidentId && unit.currentResidentId !== resident.id
      ? unit.currentResidentId
      : undefined;
    const openingBalance = Math.max(0, input.openingBalance ?? 0);
    const openingBill: Bill | null = openingBalance > 0
      ? {
          id: `bill-open-${Date.now()}`,
          residentId: resident.id,
          estateId: resident.estateId,
          propertyId: resident.propertyId,
          unitId: resident.unitId,
          category: "Opening balance",
          title: "Opening balance from legacy system",
          amount: openingBalance,
          paidAmount: 0,
          dueDate: today(),
          status: "unpaid"
        }
      : null;

    commit((current) => ({
      ...current,
      residents: existingResident
        ? current.residents.map((item) => {
            if (item.id === resident.id) {
              return resident;
            }

            if (previousCurrentResidentId && item.id === previousCurrentResidentId) {
              return { ...item, status: "moved out" as const };
            }

            return item;
          })
        : [
            resident,
            ...current.residents.map((item) =>
              previousCurrentResidentId && item.id === previousCurrentResidentId
                ? { ...item, status: "moved out" as const }
                : item
            )
          ],
      units: current.units.map((item) =>
        item.id === unit.id
          ? {
              ...item,
              currentResidentId: input.status === "active" ? activeOccupantId : item.currentResidentId,
              status: input.status === "active" ? "occupied" : item.status,
              moveInDate: input.status === "active" ? resident.moveInDate ?? item.moveInDate : item.moveInDate
            }
          : item
      ),
      bills: openingBill ? [openingBill, ...current.bills] : current.bills,
      auditLogs: addAuditLog(current, {
        estateId: resident.estateId,
        actor: "Estate admin",
        action: existingResident ? "updated resident onboarding" : "onboarded resident",
        entityType: "resident",
        entityId: resident.id,
        metadata: {
          unitCode: unit.unitCode,
          propertyCode: property?.propertyCode ?? "",
          openingBalance,
          monthlyCharge: input.monthlyCharge ?? 0,
          previousCurrentResidentId: previousCurrentResidentId ?? ""
        }
      })
    }));

    return resident;
  }

  function createManagedLocalUser(input: ManagedLocalUserInput) {
    const fullName = input.fullName.trim();
    const phone = normalizePhoneNumber(input.phone);
    const rawEmail = input.email?.trim().toLowerCase() ?? "";
    const email = rawEmail || phoneAuthEmail(phone);
    const password = input.password.trim() || `Corso-${Date.now().toString(36)}-247`;
    const estate = state.estates.find((item) => item.id === input.estateId) ?? state.estates[0];
    const estateId = input.role === "super_admin" ? "" : estate?.id ?? input.estateId;
    const loginIdentifier = rawEmail || phone;

    if (!fullName || !phone) {
      throw new Error("Full name and phone number are required.");
    }

    if (rawEmail && !rawEmail.includes("@")) {
      throw new Error("Enter a valid email address or leave email empty.");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    if (input.role !== "super_admin" && !estateId) {
      throw new Error("An estate is required for this user role.");
    }

    const residentId = input.role === "resident" ? residentIdForIdentifier(phone || email) : undefined;
    const approvedUser: LocalApprovedUser = {
      id: `user-${Date.now()}`,
      fullName,
      email,
      phone,
      password,
      role: input.role,
      estate: estate?.name ?? "LBS View Estate",
      residentId,
      approvedAt: today()
    };

    commit((current) => {
      const existingApproved = current.approvedUsers.find(
        (user) => user.email === email || (!!phone && user.phone === phone)
      );
      const nextApprovedUser = existingApproved
        ? { ...existingApproved, ...approvedUser, id: existingApproved.id }
        : approvedUser;
      let nextProperties = current.properties;
      let nextUnits = current.units;
      let nextResidents = current.residents;
      let propertyId = "";
      let unitId = "";
      let unitCode = input.houseNumber?.trim() || "Pending assignment";

      if (input.role === "resident" && residentId && estateId) {
        unitCode = normalizeOnboardingUnitCode(unitCode);
        const propertyCode = propertyCodeFromUnitCode(unitCode);
        const existingProperty = current.properties.find(
          (property) => property.estateId === estateId && property.propertyCode.toUpperCase() === propertyCode
        );
        const property: Property = existingProperty ?? {
          id: entityId("prop", `${estateId}-${propertyCode}`),
          estateId,
          propertyCode,
          name: propertyCode,
          description: "Created from admin user onboarding",
          street: estate?.address ?? "LBS View Estate",
          status: "active"
        };
        propertyId = property.id;
        nextProperties = existingProperty ? nextProperties : [property, ...nextProperties];

        const existingUnit = current.units.find(
          (unit) => unit.estateId === estateId && unit.unitCode.toUpperCase() === unitCode
        );
        const unit: Unit = existingUnit
          ? { ...existingUnit, propertyId, currentResidentId: residentId, status: "occupied" }
          : {
              id: entityId("unit", `${estateId}-${unitCode}`),
              estateId,
              propertyId,
              unitCode,
              label: unitCode,
              apartmentType: "Pending classification",
              status: "occupied",
              currentResidentId: residentId
            };
        unitId = unit.id;
        nextUnits = existingUnit
          ? nextUnits.map((item) => (item.id === existingUnit.id ? unit : item))
          : [unit, ...nextUnits];

        const existingResident = current.residents.find(
          (resident) =>
            resident.id === residentId ||
            resident.email.toLowerCase() === email ||
            (!!phone && normalizePhoneNumber(resident.phone) === phone)
        );
        const resident: Resident = {
          id: existingResident?.id ?? residentId,
          estateId,
          propertyId,
          unitId,
          name: fullName,
          houseNumber: unitCode,
          phone,
          email,
          type: "tenant",
          status: "active"
        };
        nextResidents = existingResident
          ? nextResidents.map((item) => (item.id === existingResident.id ? resident : item))
          : [resident, ...nextResidents];
      }

      return {
        ...current,
        properties: nextProperties,
        units: nextUnits,
        residents: nextResidents,
        approvedUsers: [
          nextApprovedUser,
          ...current.approvedUsers.filter((user) => user.id !== nextApprovedUser.id)
        ],
        auditLogs: addAuditLog(current, {
          estateId: estateId || current.estates[0]?.id || "platform",
          actor: "Estate admin",
          action: "created local login user",
          entityType: "system",
          entityId: nextApprovedUser.id,
          metadata: {
            role: input.role,
            loginIdentifier,
            unitCode: input.role === "resident" ? unitCode : ""
          }
        })
      };
    });

    return {
      message: `${fullName} has been created as ${input.role.replaceAll("_", " ")} for local Appwrite demo login.`,
      temporaryPassword: password,
      loginIdentifier,
      user: {
        email,
        phone,
        fullName,
        role: input.role
      }
    };
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
    addProperty,
    addUnit,
    onboardResident,
    createManagedLocalUser,
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
    return state.residents[0] ?? makeResidentProfile({
      fullName: "Resident User",
      email: "resident@lbsview.test",
      phone: "Not provided",
      estate: "LBS View Estate",
      residentId: "res-local-demo"
    });
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

export function getResidentUnit(state: LocalEstateState, resident: Resident) {
  return state.units.find((unit) => unit.id === resident.unitId || unit.currentResidentId === resident.id);
}

export function getResidentProperty(state: LocalEstateState, resident: Resident) {
  const unit = getResidentUnit(state, resident);
  return state.properties.find((property) => property.id === (resident.propertyId ?? unit?.propertyId));
}

export function residentUnitLabel(state: LocalEstateState, resident: Resident) {
  const unit = getResidentUnit(state, resident);
  return unit?.unitCode ?? resident.houseNumber;
}

export function billPaidAmount(state: LocalEstateState, bill: Bill) {
  return bill.paidAmount ?? paymentTotalForBill(state.payments, bill.id);
}

export function billOutstandingAmount(state: LocalEstateState, bill: Bill) {
  return Math.max(0, bill.amount - billPaidAmount(state, bill));
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

function mergeSavedWithDefaultsById<T extends { id: string }>(savedItems: T[] | undefined, defaultItems: T[]) {
  if (!savedItems?.length) {
    return defaultItems;
  }

  const savedIds = new Set(savedItems.map((item) => item.id));
  return [...savedItems, ...defaultItems.filter((item) => !savedIds.has(item.id))];
}

function normalizeLocalEstateState(saved: Partial<LocalEstateState>) {
  const defaults = defaultState();
  const normalizedProperties = mergeSavedWithDefaultsById(saved.properties, defaults.properties);
  const normalizedUnits = mergeSavedWithDefaultsById(saved.units, defaults.units).map((unit) =>
    unit.currentResidentId && DEMO_RESIDENT_IDS.has(unit.currentResidentId)
      ? { ...unit, currentResidentId: undefined, status: unit.status === "occupied" ? "vacant" : unit.status }
      : unit
  );
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
  const normalizedResidents = savedResidents.filter((resident) => !isDemoResidentId(resident.id)).map((resident) => {
    const defaultResident = defaults.residents.find((item) => item.id === resident.id);
    const assignedUnit = normalizedUnits.find((unit) => unit.id === resident.unitId || unit.currentResidentId === resident.id)
      ?? (defaultResident?.unitId ? normalizedUnits.find((unit) => unit.id === defaultResident.unitId) : undefined);

    return {
      ...resident,
      propertyId: resident.propertyId ?? defaultResident?.propertyId ?? assignedUnit?.propertyId,
      unitId: resident.unitId ?? defaultResident?.unitId ?? assignedUnit?.id,
      houseNumber: resident.propertyId || resident.unitId
        ? resident.houseNumber
        : defaultResident?.houseNumber ?? resident.houseNumber,
      moveInDate: resident.moveInDate ?? defaultResident?.moveInDate ?? assignedUnit?.moveInDate
    };
  });
  const normalizedPayments = (saved.payments ?? defaults.payments).filter((payment) => !isDemoResidentId(payment.residentId)).map((payment) => {
    const bill = (saved.bills ?? defaults.bills).find((item) => item.id === payment.billId);
    const resident = normalizedResidents.find((item) => item.id === payment.residentId);

    return {
      ...payment,
      estateId: payment.estateId ?? bill?.estateId ?? resident?.estateId,
      propertyId: payment.propertyId ?? bill?.propertyId ?? resident?.propertyId,
      unitId: payment.unitId ?? bill?.unitId ?? resident?.unitId,
      processor: payment.processor ?? "manual",
      channel: payment.channel ?? "bank_transfer",
      source: payment.source ?? (payment.status === "confirmed" ? "admin" : "resident")
    };
  });
  const normalizedBills = (saved.bills ?? defaults.bills).filter((bill) => !isDemoResidentId(bill.residentId)).map((bill) => {
    const resident = normalizedResidents.find((item) => item.id === bill.residentId);
    const paidAmount = bill.paidAmount ?? paymentTotalForBill(normalizedPayments, bill.id);

    return {
      ...bill,
      propertyId: bill.propertyId ?? resident?.propertyId,
      unitId: bill.unitId ?? resident?.unitId,
      category: bill.category ?? "Service charge",
      paidAmount,
      status: billStatusForPaymentTotal(bill, paidAmount)
    };
  });
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
        !normalizedResidents.some(
          (resident) =>
            resident.id === profile.id ||
            resident.email.toLowerCase() === profile.email.toLowerCase()
        )
    );

  return {
    ...defaults,
    ...saved,
    estates: sortEstatesWithDefaultFirst(saved.estates?.length ? saved.estates : defaults.estates),
    properties: normalizedProperties,
    units: normalizedUnits,
    accessRequests,
    residents: [...normalizedResidents, ...approvedResidentProfiles],
    bills: normalizedBills,
    payments: normalizedPayments,
    visitors: (saved.visitors ?? defaults.visitors).filter((visitor) => !isDemoResidentId(visitor.residentId)),
    visitorLogs: (saved.visitorLogs ?? defaults.visitorLogs).filter((log) => !["vis-001", "vis-002", "vis-003"].includes(log.visitorId)),
    complaints: (saved.complaints ?? defaults.complaints).filter((complaint) => !isDemoResidentId(complaint.residentId)),
    emergencyAlerts: (saved.emergencyAlerts ?? defaults.emergencyAlerts).filter((alert) => !isDemoResidentId(alert.residentId)),
    approvedUsers,
    auditLogs: (saved.auditLogs?.length ? saved.auditLogs : defaults.auditLogs).filter((log) => !isDemoEntityId(log.entityId))
  } as LocalEstateState;
}

function isDemoResidentId(value?: string) {
  return Boolean(value && DEMO_RESIDENT_IDS.has(value));
}

function isDemoEntityId(value?: string) {
  return Boolean(value && (DEMO_RESIDENT_IDS.has(value) || value.startsWith("unit-vic-") || value.startsWith("unit-abr-")));
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
