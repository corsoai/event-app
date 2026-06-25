import type { Facility, WorkOrder } from "@/lib/types";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteDeleteRow,
  appwriteUpsertRow,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";

const FACILITIES_TABLE = "facilities";
const WORK_ORDERS_TABLE = "work_orders";

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function finiteNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function estateIdFor(input: { estateId?: string | null; includeAllEstates?: boolean }) {
  return input.includeAllEstates ? APPWRITE_LBSVIEW_ESTATE_ID : input.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID;
}

type AppwriteFacilityRow = {
  $id?: string;
  estateId?: string;
  name?: string;
  category?: string;
  location?: string;
  status?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  vendorId?: string;
  vendorName?: string;
  photoUrl?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FacilitySaveInput = {
  id?: string;
  name: string;
  category?: string;
  location?: string;
  status?: Facility["status"];
  purchaseDate?: string;
  warrantyExpiry?: string;
  vendorId?: string;
  vendorName?: string;
  photoUrl?: string;
  notes?: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
};

function mapFacilityRow(row: AppwriteFacilityRow): Facility {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    name: text(row.name),
    category: text(row.category),
    location: text(row.location),
    status: (row.status as Facility["status"]) || "operational",
    purchaseDate: text(row.purchaseDate),
    warrantyExpiry: text(row.warrantyExpiry),
    vendorId: text(row.vendorId),
    vendorName: text(row.vendorName),
    photoUrl: text(row.photoUrl),
    notes: text(row.notes),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt)
  };
}

export async function listFacilities(scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteFacilityRow>(FACILITIES_TABLE, scope);
  return rows.map(mapFacilityRow).sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveFacility(input: FacilitySaveInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Facility name is required.");
  }

  const estateId = estateIdFor(input);
  const now = new Date().toISOString();
  const existingId = input.id?.trim();
  const rowId = existingId || safeAppwriteId("facility", `${name}-${now}`);

  const payload = {
    estateId,
    name,
    category: input.category?.trim() ?? "",
    location: input.location?.trim() ?? "",
    status: input.status ?? "operational",
    purchaseDate: input.purchaseDate?.trim() ?? "",
    warrantyExpiry: input.warrantyExpiry?.trim() ?? "",
    vendorId: input.vendorId?.trim() ?? "",
    vendorName: input.vendorName?.trim() ?? "",
    photoUrl: input.photoUrl?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    updatedAt: now,
    ...(existingId ? {} : { createdAt: now })
  };

  const row = await appwriteUpsertRow<AppwriteFacilityRow>(FACILITIES_TABLE, rowId, payload);
  return mapFacilityRow(row);
}

export async function deleteFacility(facilityId: string) {
  const id = facilityId.trim();
  if (!id) {
    throw new Error("Facility ID is required.");
  }
  await appwriteDeleteRow<AppwriteFacilityRow>(FACILITIES_TABLE, id);
  return { id };
}

type AppwriteWorkOrderRow = {
  $id?: string;
  estateId?: string;
  facilityId?: string;
  facilityName?: string;
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  status?: string;
  reportedByRole?: string;
  assignedTo?: string;
  dueDate?: string;
  resolvedAt?: string;
  cost?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkOrderSaveInput = {
  id?: string;
  facilityId?: string;
  facilityName?: string;
  title: string;
  description?: string;
  category?: string;
  priority?: WorkOrder["priority"];
  status?: WorkOrder["status"];
  reportedByRole?: string;
  assignedTo?: string;
  dueDate?: string;
  resolvedAt?: string;
  cost?: number;
  notes?: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
};

function mapWorkOrderRow(row: AppwriteWorkOrderRow): WorkOrder {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    facilityId: text(row.facilityId),
    facilityName: text(row.facilityName),
    title: text(row.title),
    description: text(row.description),
    category: text(row.category),
    priority: (row.priority as WorkOrder["priority"]) || "medium",
    status: (row.status as WorkOrder["status"]) || "open",
    reportedByRole: text(row.reportedByRole),
    assignedTo: text(row.assignedTo),
    dueDate: text(row.dueDate),
    resolvedAt: text(row.resolvedAt),
    cost: finiteNumber(row.cost),
    notes: text(row.notes),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt)
  };
}

export async function listWorkOrders(scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteWorkOrderRow>(WORK_ORDERS_TABLE, scope);
  return rows
    .map(mapWorkOrderRow)
    .sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""));
}

export async function saveWorkOrder(input: WorkOrderSaveInput) {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Work order title is required.");
  }

  const estateId = estateIdFor(input);
  const now = new Date().toISOString();
  const existingId = input.id?.trim();
  const rowId = existingId || safeAppwriteId("workorder", `${title}-${now}`);
  const status = input.status ?? "open";
  const resolvedAt = input.resolvedAt
    ?? ((status === "resolved" || status === "closed") ? now : "");

  const payload = {
    estateId,
    facilityId: input.facilityId?.trim() ?? "",
    facilityName: input.facilityName?.trim() ?? "",
    title,
    description: input.description?.trim() ?? "",
    category: input.category?.trim() ?? "",
    priority: input.priority ?? "medium",
    status,
    reportedByRole: input.reportedByRole?.trim() ?? "estate_admin",
    assignedTo: input.assignedTo?.trim() ?? "",
    dueDate: input.dueDate?.trim() ?? "",
    resolvedAt,
    cost: finiteNumber(input.cost),
    notes: input.notes?.trim() ?? "",
    updatedAt: now,
    ...(existingId ? {} : { createdAt: now })
  };

  const row = await appwriteUpsertRow<AppwriteWorkOrderRow>(WORK_ORDERS_TABLE, rowId, payload);
  return mapWorkOrderRow(row);
}

export async function deleteWorkOrder(workOrderId: string) {
  const id = workOrderId.trim();
  if (!id) {
    throw new Error("Work order ID is required.");
  }
  await appwriteDeleteRow<AppwriteWorkOrderRow>(WORK_ORDERS_TABLE, id);
  return { id };
}
