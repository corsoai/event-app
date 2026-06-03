export type UserRole =
  | "super_admin"
  | "estate_admin"
  | "resident"
  | "security_guard"
  | "vendor";

export type StatusTone = "green" | "blue" | "yellow" | "red" | "slate";

export type Estate = {
  id: string;
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  gateName: string;
};

export type Property = {
  id: string;
  estateId: string;
  propertyCode: string;
  name: string;
  description: string;
  street: string;
  legacyName?: string;
  status: "active" | "inactive";
};

export type Unit = {
  id: string;
  estateId: string;
  propertyId: string;
  unitCode: string;
  label: string;
  apartmentType: string;
  status: "occupied" | "vacant" | "moved out";
  currentResidentId?: string;
  moveInDate?: string;
  legacyName?: string;
};

export type Resident = {
  id: string;
  estateId: string;
  propertyId?: string;
  unitId?: string;
  name: string;
  houseNumber: string;
  phone: string;
  email: string;
  type: "owner" | "tenant" | "family member";
  status: "active" | "inactive" | "moved out";
  moveInDate?: string;
};

export type Visitor = {
  id: string;
  residentId: string;
  estateId: string;
  visitorName: string;
  phone: string;
  visitDate: string;
  arrivalTime: string;
  purpose: string;
  count: number;
  code: string;
  createdAt?: string;
  expiresAt?: string;
  status: "pending" | "verified" | "checked-in" | "checked-out" | "expired" | "cancelled";
};

export type Bill = {
  id: string;
  residentId: string;
  estateId: string;
  propertyId?: string;
  unitId?: string;
  category?: string;
  title: string;
  amount: number;
  paidAmount?: number;
  dueDate: string;
  status: "unpaid" | "partially paid" | "paid" | "overdue";
};

export type PaymentChannel =
  | "online"
  | "bank_transfer"
  | "cash"
  | "pos"
  | "whatsapp_receipt";

export type PaymentProcessor =
  | "paystack"
  | "flutterwave"
  | "monnify"
  | "gtbank_squad"
  | "manual";

export type Payment = {
  id: string;
  billId: string;
  residentId: string;
  estateId?: string;
  propertyId?: string;
  unitId?: string;
  amount: number;
  reference: string;
  processor?: PaymentProcessor;
  channel?: PaymentChannel;
  providerReference?: string;
  date: string;
  status: "pending" | "confirmed" | "rejected";
  source?: "resident" | "admin" | "webhook";
  confirmedAt?: string;
  confirmedBy?: string;
};

export type AuditLog = {
  id: string;
  estateId: string;
  actor: string;
  action: string;
  entityType: "property" | "unit" | "resident" | "bill" | "payment" | "visitor" | "system";
  entityId: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
};

export type Complaint = {
  id: string;
  residentId: string;
  category: "security" | "power" | "water" | "waste" | "noise" | "road" | "facility" | "other";
  title: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in progress" | "resolved" | "closed";
  createdAt: string;
  assignedTo: string;
};

export type Announcement = {
  id: string;
  estateId: string;
  title: string;
  message: string;
  target: "all residents" | "owners" | "tenants" | "security" | "vendors";
  priority: "normal" | "urgent";
  publishDate: string;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  category: string;
  summary: string;
  updatedAt: string;
};

export type EmergencyAlertType =
  | "medical"
  | "security"
  | "fire"
  | "domestic_violence"
  | "suspicious_movement";

export type EmergencyAlertStatus = "active" | "acknowledged" | "resolved" | "false_alarm" | "cancelled";

export type EmergencyAlert = {
  id: string;
  estateId: string;
  residentId: string;
  residentName: string;
  houseNumber: string;
  phone: string;
  type: EmergencyAlertType;
  status: EmergencyAlertStatus;
  notes: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  siren: boolean;
  locationLabel: string;
};
