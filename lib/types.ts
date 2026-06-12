export type UserRole =
  | "super_admin"
  | "estate_admin"
  | "cso"
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
  legacyName?: string;
  legacyAddress?: string;
  openingOutstanding?: number;
  expectedMonthly?: number;
  onboardingStatus?: "verified" | "needs_review" | string;
  reviewReasons?: string;
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
  billingMonth?: string;
  status: "unpaid" | "partially paid" | "paid" | "overdue";
};

export type PaymentChannel =
  | "online"
  | "monnify_card"
  | "monnify_transfer"
  | "monnify_virtual_account"
  | "bank_transfer"
  | "cash"
  | "pos"
  | "whatsapp_receipt"
  | "credit_applied";

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
  source?: "resident" | "admin" | "webhook" | "monnify_online" | "monnify_webhook";
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

export type AppwriteAnnouncement = {
  id: string;
  estateId: string;
  title: string;
  message: string;
  priority: "low" | "normal" | "high" | "urgent";
  targetRole: "all" | "resident" | "security" | "cso";
  createdBy: string;
  createdByName: string;
  publishedAt?: string;
  expiresAt?: string;
  status: "draft" | "published" | "archived";
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppwriteComplaint = {
  id: string;
  estateId: string;
  residentId: string;
  residentName: string;
  unitCode: string;
  propertyCode: string;
  category: "security" | "power" | "water" | "waste" | "noise" | "road" | "facility" | "other";
  priority: "low" | "medium" | "high";
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  assignedToName?: string;
  adminResponse?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type AppwriteKnowledgeBaseArticle = {
  id: string;
  estateId: string;
  title: string;
  content: string;
  category: "billing" | "access" | "security" | "facilities" | "rules" | "emergency" | "general";
  targetRole: "all" | "resident" | "security" | "cso";
  createdBy: string;
  createdByName: string;
  isPublished: boolean;
  viewCount: number;
  sortOrder: number;
  tags?: string;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdMember = {
  id: string;
  estateId: string;
  residentId: string;
  unitCode: string;
  propertyCode: string;
  fullName: string;
  relationship:
    | "spouse"
    | "child"
    | "parent"
    | "sibling"
    | "relative"
    | "domestic_staff"
    | "driver"
    | "guard"
    | "vendor"
    | "other";
  phone?: string;
  idType?: "nin" | "bvn" | "passport" | "drivers_license" | "other" | "none";
  idNumber?: string;
  photoFileId?: string;
  hasEstateAccess: boolean;
  accessNote?: string;
  addedBy: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionRate = {
  id: string;
  estateId: string;
  apartmentType:
    | "SELF_CONTAINED"
    | "ONE_BEDROOM"
    | "TWO_BEDROOM"
    | "THREE_BEDROOM"
    | "DUPLEX"
    | "LANDLORD_OCCUPIER"
    | "CUSTOM";
  monthlyRate: number;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyBillingRun = {
  id: string;
  estateId: string;
  billingMonth: string;
  runDate: string;
  runBy: string;
  runByName: string;
  totalResidents: number;
  billsCreated: number;
  autoPaidFromCredit: number;
  requiresPayment: number;
  skipped: number;
  errors: number;
  errorDetails?: string;
  status: "completed" | "partial" | "failed";
  createdAt: string;
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

export type GuardCheckpoint = {
  id: string;
  estateId: string;
  checkpointId: string;
  checkpointCode: string;
  checkpointName: string;
  name: string;
  gateName: string;
  locationLabel: string;
  qrToken: string;
  latitude?: number;
  longitude?: number;
  allowedRadius: number;
  status: "active" | "inactive";
  sortOrder?: number;
};

export type GuardPatrolEvent = {
  id: string;
  estateId: string;
  checkpointId: string;
  checkpointCode: string;
  checkpointName: string;
  qrToken: string;
  guardId: string;
  guardProfileId: string;
  guardName: string;
  scanType: "checkpoint";
  scannedAt: string;
  status: "verified" | "gps_violation" | "offline_pending" | "checkpoint_missing";
  deviceLatitude?: number;
  deviceLongitude?: number;
  checkpointLatitude?: number;
  checkpointLongitude?: number;
  allowedRadius?: number;
  distanceMeters?: number;
  isGpsVerified?: boolean;
  isOfflineLog?: boolean;
  deviceLabel?: string;
  note?: string;
};

export type SecurityIncident = {
  id: string;
  estateId: string;
  incidentType: string;
  alertType?: "panic" | "medical" | "fire" | "security" | "other";
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "acknowledged" | "responding" | "resolved" | "false_alarm" | "closed";
  reportedByRole: string;
  reportedByProfileId?: string;
  assignedToProfileId?: string;
  residentName?: string;
  unitCode?: string;
  locationLabel?: string;
  summary: string;
  details?: string;
  openedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  respondingAt?: string;
  resolvedAt?: string;
};

export type CsoReview = {
  id: string;
  estateId: string;
  incidentId: string;
  csoProfileId: string;
  decision: string;
  note?: string;
  reviewedAt: string;
  followUpDate?: string;
  status: "open" | "pending" | "approved" | "rejected" | "closed" | "completed";
};
