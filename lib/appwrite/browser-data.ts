"use client";

import type { Resident, SecurityIncident, UserRole, Visitor } from "@/lib/types";

type AccessRequestResult = {
  status: "created" | "already-pending" | "already-approved";
  message?: string;
};

type ApiAccessRequest = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  requested_role: UserRole;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  reviewed_at: string | null;
  estates?: { name?: string } | null;
};

type VisitorCreateInput = Pick<
  Visitor,
  "visitorName" | "phone" | "visitDate" | "arrivalTime" | "purpose" | "count"
> & {
  code?: string;
};

export type AppwriteVisitorView = {
  visitor: Visitor;
  resident: Resident | null;
  residentName: string;
  unitCode: string;
};

export type SosCreateInput = {
  alertType: "panic" | "medical" | "fire" | "security" | "other";
  locationLabel?: string;
  details?: string;
};

export type SosUpdateInput = {
  incidentId: string;
  status: "acknowledged" | "responding" | "resolved" | "false_alarm";
  note?: string;
};

export type ResidentUpdateInput = Pick<
  Resident,
  "name" | "houseNumber" | "phone" | "email" | "type" | "status"
>;

export type AccessRequestView = {
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

let publicEstatesSessionCache: Array<{ id: string; name: string }> | null = null;

export async function createAppwriteAccessRequest(input: {
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
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => ({})) as Partial<AccessRequestResult> & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Access request could not be submitted.");
  }

  return payload as AccessRequestResult;
}

export async function readPublicAppwriteEstates() {
  if (publicEstatesSessionCache) {
    return publicEstatesSessionCache;
  }

  const response = await fetch("/api/public/estates", { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as {
    estates?: Array<{ id: string; name: string }>;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Estate list could not be loaded.");
  }

  publicEstatesSessionCache = payload.estates ?? [];
  return publicEstatesSessionCache;
}

export async function readAppwriteAccessRequestForCurrentUser(identifier: string) {
  const response = await fetch(`/api/access-requests/status?identifier=${encodeURIComponent(identifier)}`, {
    cache: "no-store"
  });
  if (response.status === 404) {
    return null;
  }
  const payload = await response.json().catch(() => ({})) as {
    request?: { status: "pending" | "approved" | "rejected" };
    error?: string;
  };

  if (!response.ok) {
    return null;
  }

  return payload.request ?? null;
}

export async function readAppwriteAdminAccessRequests() {
  const response = await fetch(`/api/appwrite/admin/access-requests?t=${Date.now()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as {
    requests?: ApiAccessRequest[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Access requests could not be loaded.");
  }

  return mapApiAccessRequests(payload.requests ?? []);
}

export async function reviewAppwriteAccessRequest(requestId: string, action: "approve" | "reject") {
  const response = await fetch("/api/appwrite/admin/access-requests", {
    method: "PATCH",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ requestId, action })
  });
  const payload = await response.json().catch(() => ({})) as {
    message?: string;
    requests?: ApiAccessRequest[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Access request could not be reviewed.");
  }

  return {
    message: payload.message ?? "",
    requests: payload.requests ? mapApiAccessRequests(payload.requests) : await readAppwriteAdminAccessRequests()
  };
}

function mapApiAccessRequests(requests: ApiAccessRequest[]) {
  return requests.map((request) => ({
    id: request.id,
    fullName: request.full_name,
    email: request.email,
    phone: request.phone ?? "",
    password: "",
    role: request.requested_role,
    estate: request.estates?.name ?? "LBS View Estate",
    status: request.status,
    requestedAt: request.requested_at.slice(0, 10),
    reviewedAt: request.reviewed_at ? request.reviewed_at.slice(0, 10) : undefined
  })) satisfies AccessRequestView[];
}

export async function createAppwriteResidentVisitor(input: VisitorCreateInput) {
  const response = await fetch("/api/resident/visitors", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => ({})) as { visitor?: Visitor; error?: string };

  if (!response.ok || !payload.visitor) {
    throw new Error(payload.error ?? "Visitor invitation could not be saved online.");
  }

  return payload.visitor;
}

export async function readAppwriteResidentVisitors() {
  const response = await fetch("/api/resident/visitors", { cache: "no-store" });
  return readVisitorViewsResponse(response, "Visitor invitations could not be loaded online.");
}

export async function readAppwriteAdminVisitors() {
  const response = await fetch("/api/appwrite/admin/visitors", { cache: "no-store" });
  return readVisitorViewsResponse(response, "Visitor logs could not be loaded online.");
}

export async function readAppwriteExpectedVisitors() {
  const response = await fetch("/api/security/visitors", { cache: "no-store" });
  return readVisitorViewsResponse(response, "Expected visitors could not be loaded online.");
}

export async function readAppwriteSecurityVisitorHistory() {
  const response = await fetch("/api/security/visitor-history", { cache: "no-store" });
  return readVisitorViewsResponse(response, "Visitor movement history could not be loaded online.");
}

export async function findAppwriteVisitorByCode(code: string) {
  const response = await fetch(`/api/security/visitors?code=${encodeURIComponent(code)}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as {
    visitor?: Visitor;
    resident?: Resident | null;
    error?: string;
  };

  if (!response.ok || !payload.visitor) {
    throw new Error(payload.error ?? "Visitor code could not be verified online.");
  }

  return {
    visitor: payload.visitor,
    resident: payload.resident ?? null
  };
}

export async function updateAppwriteVisitorStatus(visitor: Visitor, status: Visitor["status"]) {
  const response = await fetch("/api/security/visitors", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ visitorId: visitor.id, status })
  });
  const payload = await response.json().catch(() => ({})) as { visitor?: Visitor; error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Visitor status could not be updated online.");
  }

  return payload.visitor ?? visitor;
}

export async function createAppwriteResidentSos(input: SosCreateInput) {
  const response = await fetch("/api/appwrite/resident/sos", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => ({})) as {
    incident?: SecurityIncident;
    incidentId?: string;
    error?: string;
  };

  if (!response.ok || !payload.incident) {
    throw new Error(payload.error ?? "SOS alert could not be sent.");
  }

  return payload.incident;
}

export async function readAppwriteResidentSosHistory() {
  const response = await fetch("/api/appwrite/resident/sos", { cache: "no-store" });
  return readSosResponse(response, "SOS history could not be loaded.");
}

export async function readAppwriteResidentSosIncident(incidentId: string) {
  const response = await fetch(`/api/appwrite/resident/sos/${encodeURIComponent(incidentId)}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as {
    incident?: SecurityIncident;
    error?: string;
  };

  if (!response.ok || !payload.incident) {
    throw new Error(payload.error ?? "SOS alert status could not be loaded.");
  }

  return payload.incident;
}

export async function readAppwriteAdminSosIncidents() {
  const response = await fetch("/api/appwrite/admin/sos", { cache: "no-store" });
  return readSosResponse(response, "SOS alerts could not be loaded.");
}

export async function updateAppwriteSosIncident(input: SosUpdateInput) {
  const response = await fetch("/api/appwrite/admin/sos", {
    method: "PATCH",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await response.json().catch(() => ({})) as {
    incident?: SecurityIncident;
    error?: string;
  };

  if (!response.ok || !payload.incident) {
    throw new Error(payload.error ?? "SOS alert could not be updated.");
  }

  return payload.incident;
}

async function readVisitorViewsResponse(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => ({})) as {
    visitors?: AppwriteVisitorView[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? fallbackMessage);
  }

  return payload.visitors ?? [];
}

async function readSosResponse(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => ({})) as {
    incidents?: SecurityIncident[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? fallbackMessage);
  }

  return payload.incidents ?? [];
}

export async function updateAppwriteResident(residentId: string, input: ResidentUpdateInput) {
  const response = await fetch("/api/appwrite/admin/residents", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ residentId, ...input })
  });
  const payload = await response.json().catch(() => ({})) as { resident?: Resident; error?: string };

  if (!response.ok || !payload.resident) {
    throw new Error(payload.error ?? "Resident details could not be updated.");
  }

  return payload.resident;
}
