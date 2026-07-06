import type { Staff, StaffAttendance, StaffAttendanceStatus } from "@/lib/types";
import {
  APPWRITE_LBSVIEW_ESTATE_ID,
  appwriteDeleteRow,
  appwriteUpsertRow,
  safeAppwriteId
} from "@/lib/appwrite/server";
import { listAppwriteTableRows, type AppwriteEstateScope } from "@/lib/appwrite/residents";

const STAFF_TABLE = "staff";
const ATTENDANCE_TABLE = "staff_attendance";

type AppwriteStaffRow = {
  $id?: string;
  estateId?: string;
  staffId?: string;
  fullName?: string;
  roleTitle?: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  employmentStatus?: string;
  employmentType?: string;
  hireDate?: string;
  endDate?: string;
  assignedPost?: string;
  checkpointId?: string;
  onDuty?: boolean;
  currentShiftLabel?: string;
  idType?: string;
  idNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffSaveInput = {
  id?: string;
  fullName: string;
  roleTitle: string;
  phone?: string;
  email?: string;
  photoUrl?: string;
  employmentStatus?: Staff["employmentStatus"];
  employmentType?: Staff["employmentType"];
  hireDate?: string;
  endDate?: string;
  assignedPost?: string;
  checkpointId?: string;
  onDuty?: boolean;
  currentShiftLabel?: string;
  idType?: string;
  idNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  notes?: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
};

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function mapStaffRow(row: AppwriteStaffRow): Staff {
  return {
    id: row.$id ?? row.staffId ?? "",
    estateId: row.estateId ?? "",
    fullName: text(row.fullName),
    roleTitle: text(row.roleTitle),
    phone: text(row.phone),
    email: text(row.email),
    photoUrl: text(row.photoUrl),
    employmentStatus: (row.employmentStatus as Staff["employmentStatus"]) || "active",
    employmentType: (row.employmentType as Staff["employmentType"]) || "full_time",
    hireDate: text(row.hireDate),
    endDate: text(row.endDate),
    assignedPost: text(row.assignedPost),
    checkpointId: text(row.checkpointId),
    onDuty: row.onDuty === true,
    currentShiftLabel: text(row.currentShiftLabel),
    idType: text(row.idType),
    idNumber: text(row.idNumber),
    emergencyContactName: text(row.emergencyContactName),
    emergencyContactPhone: text(row.emergencyContactPhone),
    address: text(row.address),
    notes: text(row.notes),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt)
  };
}

export async function listStaff(scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteStaffRow>(STAFF_TABLE, scope);
  return rows.map(mapStaffRow).sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export async function saveStaff(input: StaffSaveInput) {
  const fullName = input.fullName.trim();
  const roleTitle = input.roleTitle.trim();
  if (!fullName || !roleTitle) {
    throw new Error("Staff name and role are required.");
  }

  const estateId = input.includeAllEstates
    ? APPWRITE_LBSVIEW_ESTATE_ID
    : input.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID;
  const now = new Date().toISOString();
  const existingId = input.id?.trim();
  const rowId = existingId || safeAppwriteId("staff", `${fullName}-${now}`);

  const payload = {
    estateId,
    staffId: rowId,
    fullName,
    roleTitle,
    phone: input.phone?.trim() ?? "",
    email: input.email?.trim() ?? "",
    photoUrl: input.photoUrl?.trim() ?? "",
    employmentStatus: input.employmentStatus ?? "active",
    employmentType: input.employmentType ?? "full_time",
    hireDate: input.hireDate?.trim() ?? "",
    endDate: input.endDate?.trim() ?? "",
    assignedPost: input.assignedPost?.trim() ?? "",
    checkpointId: input.checkpointId?.trim() ?? "",
    onDuty: input.onDuty === true,
    currentShiftLabel: input.currentShiftLabel?.trim() ?? "",
    idType: input.idType?.trim() ?? "",
    idNumber: input.idNumber?.trim() ?? "",
    emergencyContactName: input.emergencyContactName?.trim() ?? "",
    emergencyContactPhone: input.emergencyContactPhone?.trim() ?? "",
    address: input.address?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    updatedAt: now,
    ...(existingId ? {} : { createdAt: now })
  };

  const row = await appwriteUpsertRow<AppwriteStaffRow>(STAFF_TABLE, rowId, payload);
  return mapStaffRow(row);
}

export async function deleteStaff(staffId: string) {
  const id = staffId.trim();
  if (!id) {
    throw new Error("Staff ID is required.");
  }
  await appwriteDeleteRow<AppwriteStaffRow>(STAFF_TABLE, id);
  return { id };
}

type AppwriteAttendanceRow = {
  $id?: string;
  estateId?: string;
  staffId?: string;
  staffName?: string;
  attendanceDate?: string;
  clockIn?: string;
  clockOut?: string;
  status?: string;
  source?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffAttendanceSaveInput = {
  staffId: string;
  staffName?: string;
  attendanceDate: string;
  clockIn?: string;
  clockOut?: string;
  status?: StaffAttendanceStatus;
  source?: string;
  note?: string;
  estateId?: string | null;
  includeAllEstates?: boolean;
};

function mapAttendanceRow(row: AppwriteAttendanceRow): StaffAttendance {
  return {
    id: row.$id ?? "",
    estateId: row.estateId ?? "",
    staffId: text(row.staffId),
    staffName: text(row.staffName),
    attendanceDate: text(row.attendanceDate),
    clockIn: text(row.clockIn),
    clockOut: text(row.clockOut),
    status: (row.status as StaffAttendanceStatus) || "present",
    source: text(row.source),
    note: text(row.note),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt)
  };
}

export async function listStaffAttendance(attendanceDate: string, scope: AppwriteEstateScope = {}) {
  const rows = await listAppwriteTableRows<AppwriteAttendanceRow>(ATTENDANCE_TABLE, scope);
  const target = attendanceDate.trim();
  return rows
    .map(mapAttendanceRow)
    .filter((row) => !target || row.attendanceDate === target);
}

export async function saveStaffAttendance(input: StaffAttendanceSaveInput) {
  const staffId = input.staffId.trim();
  const attendanceDate = input.attendanceDate.trim();
  if (!staffId || !attendanceDate) {
    throw new Error("Staff and date are required for attendance.");
  }

  const estateId = input.includeAllEstates
    ? APPWRITE_LBSVIEW_ESTATE_ID
    : input.estateId ?? APPWRITE_LBSVIEW_ESTATE_ID;
  const now = new Date().toISOString();
  const rowId = safeAppwriteId("attendance", `${staffId}-${attendanceDate}`);

  const existing = (await listAppwriteTableRows<AppwriteAttendanceRow>(ATTENDANCE_TABLE, {
    estateId,
    includeAllEstates: input.includeAllEstates
  }))
    .map(mapAttendanceRow)
    .find((row) => row.id === rowId || (row.staffId === staffId && row.attendanceDate === attendanceDate));

  const payload = {
    estateId,
    staffId,
    staffName: input.staffName?.trim() ?? existing?.staffName ?? "",
    attendanceDate,
    clockIn: input.clockIn ?? existing?.clockIn ?? "",
    clockOut: input.clockOut ?? existing?.clockOut ?? "",
    status: input.status ?? existing?.status ?? "present",
    source: input.source ?? existing?.source ?? "supervisor",
    note: input.note ?? existing?.note ?? "",
    updatedAt: now,
    ...(existing ? {} : { createdAt: now })
  };

  const row = await appwriteUpsertRow<AppwriteAttendanceRow>(ATTENDANCE_TABLE, rowId, payload);
  return mapAttendanceRow(row);
}
