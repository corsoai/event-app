export const APPWRITE_ONBOARDING_DATABASE_ID = "lbsview_estate";
export const APPWRITE_TABLE_ESTATES = "estates";
export const APPWRITE_TABLE_PROFILES = "profiles";
export const APPWRITE_TABLE_ACCESS_REQUESTS = "access_requests";
export const APPWRITE_TABLE_PROPERTIES = "properties";
export const APPWRITE_TABLE_UNITS = "units";
export const APPWRITE_TABLE_RESIDENTS = "residents";
export const APPWRITE_TABLE_RESIDENT_UNIT_HISTORY = "resident_unit_history";
export const APPWRITE_TABLE_BILLS = "bills";
export const APPWRITE_TABLE_PAYMENTS = "payments";
export const APPWRITE_TABLE_RESIDENT_VIRTUAL_ACCOUNTS = "resident_virtual_accounts";
export const APPWRITE_TABLE_RESIDENT_SUBSCRIPTIONS = "resident_subscriptions";
export const APPWRITE_TABLE_PAYMENT_INTENTS = "payment_intents";
export const APPWRITE_TABLE_PAYMENT_WEBHOOK_EVENTS = "payment_webhook_events";
export const APPWRITE_TABLE_VISITORS = "visitors";
export const APPWRITE_TABLE_VISITOR_LOGS = "visitor_logs";
export const APPWRITE_TABLE_GUARD_CHECKPOINTS = "guard_checkpoints";
export const APPWRITE_TABLE_GUARD_PATROL_EVENTS = "guard_patrol_events";
export const APPWRITE_TABLE_SECURITY_INCIDENTS = "security_incidents";
export const APPWRITE_TABLE_CSO_REVIEWS = "cso_reviews";
export const APPWRITE_TABLE_AUDIT_LOGS = "audit_logs";
export const APPWRITE_TABLE_ANNOUNCEMENTS = "announcements";
export const APPWRITE_TABLE_COMPLAINTS = "complaints";
export const APPWRITE_TABLE_KNOWLEDGE_BASE = "knowledge_base";
export const APPWRITE_TABLE_HOUSEHOLD_MEMBERS = "household_members";
export const APPWRITE_TABLE_SUBSCRIPTION_RATES = "subscription_rates";
export const APPWRITE_TABLE_MONTHLY_BILLING_RUNS = "monthly_billing_runs";

export const APPWRITE_TABLE_IDS = {
  estates: APPWRITE_TABLE_ESTATES,
  profiles: APPWRITE_TABLE_PROFILES,
  accessRequests: APPWRITE_TABLE_ACCESS_REQUESTS,
  properties: APPWRITE_TABLE_PROPERTIES,
  units: APPWRITE_TABLE_UNITS,
  residents: APPWRITE_TABLE_RESIDENTS,
  residentUnitHistory: APPWRITE_TABLE_RESIDENT_UNIT_HISTORY,
  bills: APPWRITE_TABLE_BILLS,
  payments: APPWRITE_TABLE_PAYMENTS,
  residentVirtualAccounts: APPWRITE_TABLE_RESIDENT_VIRTUAL_ACCOUNTS,
  residentSubscriptions: APPWRITE_TABLE_RESIDENT_SUBSCRIPTIONS,
  paymentIntents: APPWRITE_TABLE_PAYMENT_INTENTS,
  paymentWebhookEvents: APPWRITE_TABLE_PAYMENT_WEBHOOK_EVENTS,
  visitors: APPWRITE_TABLE_VISITORS,
  visitorLogs: APPWRITE_TABLE_VISITOR_LOGS,
  guardCheckpoints: APPWRITE_TABLE_GUARD_CHECKPOINTS,
  guardPatrolEvents: APPWRITE_TABLE_GUARD_PATROL_EVENTS,
  securityIncidents: APPWRITE_TABLE_SECURITY_INCIDENTS,
  csoReviews: APPWRITE_TABLE_CSO_REVIEWS,
  auditLogs: APPWRITE_TABLE_AUDIT_LOGS,
  announcements: APPWRITE_TABLE_ANNOUNCEMENTS,
  complaints: APPWRITE_TABLE_COMPLAINTS,
  knowledgeBase: APPWRITE_TABLE_KNOWLEDGE_BASE,
  householdMembers: APPWRITE_TABLE_HOUSEHOLD_MEMBERS,
  subscriptionRates: APPWRITE_TABLE_SUBSCRIPTION_RATES,
  monthlyBillingRuns: APPWRITE_TABLE_MONTHLY_BILLING_RUNS
} as const;

export type AppwriteColumnDefinition = {
  key: string;
  type: "string" | "integer" | "float" | "boolean" | "datetime";
  size?: number;
  required?: boolean;
  default?: string | number | boolean;
  array?: boolean;
};

export type AppwriteIndexDefinition = {
  key: string;
  type: "key" | "unique" | "fulltext";
  attributes: string[];
  orders?: Array<"ASC" | "DESC">;
  lengths?: number[];
};

export type AppwriteTableDefinition = {
  tableId: string;
  name: string;
  columns: AppwriteColumnDefinition[];
  indexes?: AppwriteIndexDefinition[];
};

const baseColumns: AppwriteColumnDefinition[] = [
  { key: "estateId", type: "string", size: 64, required: true },
  { key: "createdAt", type: "datetime", required: false },
  { key: "updatedAt", type: "datetime", required: false }
];

export const appwriteOnboardingTables: AppwriteTableDefinition[] = [
  {
    tableId: APPWRITE_TABLE_ESTATES,
    name: "Estates",
    columns: [
      { key: "name", type: "string", size: 128, required: true },
      { key: "address", type: "string", size: 255, required: true },
      { key: "contactEmail", type: "string", size: 128, required: false },
      { key: "contactPhone", type: "string", size: 64, required: false },
      { key: "gateName", type: "string", size: 128, required: false },
      { key: "createdAt", type: "datetime", required: false },
      { key: "updatedAt", type: "datetime", required: false }
    ],
    indexes: [
      { key: "estate_name_idx", type: "key", attributes: ["name"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_PROFILES,
    name: "Profiles",
    columns: [
      ...baseColumns,
      { key: "userId", type: "string", size: 64, required: true },
      { key: "fullName", type: "string", size: 160, required: true },
      { key: "email", type: "string", size: 160, required: true },
      { key: "phone", type: "string", size: 64, required: false },
      { key: "role", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "houseNumber", type: "string", size: 64, required: false }
    ],
    indexes: [
      { key: "profile_user_unique", type: "unique", attributes: ["userId"] },
      { key: "profile_email_unique", type: "unique", attributes: ["email"] },
      { key: "profile_estate_idx", type: "key", attributes: ["estateId"] },
      { key: "profile_role_idx", type: "key", attributes: ["role"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_ACCESS_REQUESTS,
    name: "Access Requests",
    columns: [
      ...baseColumns,
      { key: "authUserId", type: "string", size: 64, required: false },
      { key: "fullName", type: "string", size: 160, required: true },
      { key: "email", type: "string", size: 160, required: true },
      { key: "phone", type: "string", size: 64, required: false },
      { key: "requestedRole", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "requestedAt", type: "datetime", required: true },
      { key: "reviewedAt", type: "datetime", required: false },
      { key: "reviewedBy", type: "string", size: 64, required: false },
      { key: "estateName", type: "string", size: 128, required: false }
    ],
    indexes: [
      { key: "access_request_status_idx", type: "key", attributes: ["status"] },
      { key: "access_request_estate_idx", type: "key", attributes: ["estateId"] },
      { key: "access_request_phone_idx", type: "key", attributes: ["phone"] },
      { key: "access_request_email_idx", type: "key", attributes: ["email"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_PROPERTIES,
    name: "Properties",
    columns: [
      ...baseColumns,
      { key: "propertyCode", type: "string", size: 32, required: true },
      { key: "name", type: "string", size: 128, required: true },
      { key: "description", type: "string", size: 512, required: false },
      { key: "street", type: "string", size: 255, required: false },
      { key: "legacyName", type: "string", size: 255, required: false },
      { key: "status", type: "string", size: 32, required: true }
    ],
    indexes: [
      { key: "property_code_unique", type: "unique", attributes: ["estateId", "propertyCode"] },
      { key: "property_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_UNITS,
    name: "Units",
    columns: [
      ...baseColumns,
      { key: "propertyId", type: "string", size: 64, required: true },
      { key: "unitCode", type: "string", size: 32, required: true },
      { key: "label", type: "string", size: 128, required: false },
      { key: "apartmentType", type: "string", size: 128, required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "currentResidentId", type: "string", size: 64, required: false },
      { key: "moveInDate", type: "string", size: 32, required: false },
      { key: "legacyName", type: "string", size: 255, required: false }
    ],
    indexes: [
      { key: "unit_code_unique", type: "unique", attributes: ["estateId", "unitCode"] },
      { key: "unit_property_idx", type: "key", attributes: ["propertyId"] },
      { key: "unit_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_RESIDENTS,
    name: "Residents",
    columns: [
      ...baseColumns,
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: false },
      { key: "fullName", type: "string", size: 160, required: true },
      { key: "phone", type: "string", size: 64, required: false },
      { key: "email", type: "string", size: 160, required: false },
      { key: "residentType", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "moveInDate", type: "string", size: 32, required: false },
      { key: "legacyName", type: "string", size: 255, required: false },
      { key: "legacyAddress", type: "string", size: 512, required: false },
      { key: "sourceRow", type: "integer", required: false },
      { key: "openingOutstanding", type: "float", required: false, default: 0 },
      { key: "expectedMonthly", type: "float", required: false, default: 0 },
      { key: "totalPaidAllTime", type: "float", required: false, default: 0 },
      { key: "advanceCredit", type: "float", required: false, default: 0 },
      { key: "coverageThroughDate", type: "string", size: 32, required: false },
      { key: "nextDueDate", type: "string", size: 32, required: false },
      { key: "lastPaymentDate", type: "string", size: 32, required: false },
      { key: "lastPaymentAmount", type: "float", required: false, default: 0 },
      { key: "onboardingStatus", type: "string", size: 32, required: false, default: "verified" },
      { key: "reviewReasons", type: "string", size: 1024, required: false }
    ],
    indexes: [
      { key: "resident_unit_idx", type: "key", attributes: ["unitId"] },
      { key: "resident_status_idx", type: "key", attributes: ["status"] },
      { key: "resident_phone_idx", type: "key", attributes: ["phone"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_RESIDENT_UNIT_HISTORY,
    name: "Resident Unit History",
    columns: [
      ...baseColumns,
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: true },
      { key: "unitCode", type: "string", size: 32, required: true },
      { key: "residentStatus", type: "string", size: 32, required: true },
      { key: "moveInDate", type: "string", size: 32, required: false },
      { key: "moveOutDate", type: "string", size: 32, required: false },
      { key: "source", type: "string", size: 64, required: false },
      { key: "legacyNote", type: "string", size: 512, required: false }
    ],
    indexes: [
      { key: "history_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "history_unit_idx", type: "key", attributes: ["unitId"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_BILLS,
    name: "Bills",
    columns: [
      ...baseColumns,
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: false },
      { key: "propertyCode", type: "string", size: 64, required: false },
      { key: "unitCode", type: "string", size: 64, required: false },
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "category", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 160, required: true },
      { key: "amount", type: "float", required: true },
      { key: "paidAmount", type: "float", required: false, default: 0 },
      { key: "dueDate", type: "string", size: 32, required: true },
      { key: "billingMonth", type: "string", size: 16, required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "createdBy", type: "string", size: 64, required: false }
    ],
    indexes: [
      { key: "bill_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "bill_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_PAYMENTS,
    name: "Payments",
    columns: [
      ...baseColumns,
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: false },
      { key: "propertyCode", type: "string", size: 64, required: false },
      { key: "unitCode", type: "string", size: 64, required: false },
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "billId", type: "string", size: 64, required: false },
      { key: "amount", type: "float", required: true },
      { key: "reference", type: "string", size: 128, required: true },
      { key: "processor", type: "string", size: 64, required: false },
      { key: "channel", type: "string", size: 64, required: true },
      { key: "providerReference", type: "string", size: 128, required: false },
      { key: "date", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "source", type: "string", size: 64, required: true },
      { key: "confirmedAt", type: "datetime", required: false },
      { key: "confirmedBy", type: "string", size: 128, required: false },
      { key: "recordedBy", type: "string", size: 128, required: false },
      { key: "allocations", type: "string", size: 4096, required: false },
      { key: "advanceCreditGenerated", type: "float", required: false, default: 0 },
      { key: "monnifyTransactionRef", type: "string", size: 128, required: false },
      { key: "monnifyPaymentRef", type: "string", size: 128, required: false },
      { key: "notes", type: "string", size: 1024, required: false }
    ],
    indexes: [
      { key: "payment_reference_unique", type: "unique", attributes: ["reference"] },
      { key: "payment_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "payment_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_RESIDENT_VIRTUAL_ACCOUNTS,
    name: "Resident Virtual Accounts",
    columns: [
      ...baseColumns,
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: false },
      { key: "propertyCode", type: "string", size: 64, required: false },
      { key: "unitCode", type: "string", size: 64, required: false },
      { key: "provider", type: "string", size: 64, required: true },
      { key: "accountNumber", type: "string", size: 32, required: true },
      { key: "accountName", type: "string", size: 160, required: true },
      { key: "bankName", type: "string", size: 128, required: false },
      { key: "bankCode", type: "string", size: 32, required: false },
      { key: "providerReference", type: "string", size: 128, required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "assignedAt", type: "datetime", required: false },
      { key: "deactivatedAt", type: "datetime", required: false }
    ],
    indexes: [
      { key: "virtual_account_unique", type: "unique", attributes: ["provider", "accountNumber"] },
      { key: "virtual_account_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "virtual_account_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_RESIDENT_SUBSCRIPTIONS,
    name: "Resident Subscriptions",
    columns: [
      ...baseColumns,
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: false },
      { key: "category", type: "string", size: 64, required: true },
      { key: "amount", type: "float", required: true },
      { key: "currency", type: "string", size: 8, required: false, default: "NGN" },
      { key: "billingCycle", type: "string", size: 32, required: true },
      { key: "nextDueDate", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "autoBill", type: "boolean", required: false, default: true }
    ],
    indexes: [
      { key: "subscription_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "subscription_due_idx", type: "key", attributes: ["nextDueDate"] },
      { key: "subscription_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_PAYMENT_INTENTS,
    name: "Payment Intents",
    columns: [
      ...baseColumns,
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "billId", type: "string", size: 64, required: false },
      { key: "subscriptionId", type: "string", size: 64, required: false },
      { key: "virtualAccountId", type: "string", size: 64, required: false },
      { key: "amount", type: "float", required: true },
      { key: "currency", type: "string", size: 8, required: false, default: "NGN" },
      { key: "reference", type: "string", size: 128, required: true },
      { key: "processor", type: "string", size: 64, required: true },
      { key: "channel", type: "string", size: 64, required: true },
      { key: "checkoutUrl", type: "string", size: 1024, required: false },
      { key: "transactionReference", type: "string", size: 128, required: false },
      { key: "paymentReference", type: "string", size: 128, required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "expiresAt", type: "datetime", required: false },
      { key: "metadata", type: "string", size: 4096, required: false },
      { key: "errorMessage", type: "string", size: 1024, required: false }
    ],
    indexes: [
      { key: "payment_intent_reference_unique", type: "unique", attributes: ["reference"] },
      { key: "payment_intent_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "payment_intent_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_PAYMENT_WEBHOOK_EVENTS,
    name: "Payment Webhook Events",
    columns: [
      ...baseColumns,
      { key: "provider", type: "string", size: 64, required: true },
      { key: "eventId", type: "string", size: 128, required: true },
      { key: "eventType", type: "string", size: 128, required: true },
      { key: "reference", type: "string", size: 128, required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "receivedAt", type: "datetime", required: true },
      { key: "processedAt", type: "datetime", required: false },
      { key: "payloadHash", type: "string", size: 128, required: false },
      { key: "errorMessage", type: "string", size: 512, required: false }
    ],
    indexes: [
      { key: "webhook_event_unique", type: "unique", attributes: ["provider", "eventId"] },
      { key: "webhook_reference_idx", type: "key", attributes: ["reference"] },
      { key: "webhook_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_VISITORS,
    name: "Visitors",
    columns: [
      ...baseColumns,
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "visitorName", type: "string", size: 160, required: true },
      { key: "phone", type: "string", size: 64, required: false },
      { key: "visitDate", type: "string", size: 32, required: true },
      { key: "arrivalTime", type: "string", size: 16, required: true },
      { key: "purpose", type: "string", size: 255, required: false },
      { key: "count", type: "integer", required: false, default: 1 },
      { key: "code", type: "string", size: 16, required: true },
      { key: "expiresAt", type: "datetime", required: false },
      { key: "status", type: "string", size: 32, required: true }
    ],
    indexes: [
      { key: "visitor_code_unique", type: "unique", attributes: ["code"] },
      { key: "visitor_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "visitor_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_VISITOR_LOGS,
    name: "Visitor Logs",
    columns: [
      ...baseColumns,
      { key: "visitorId", type: "string", size: 64, required: true },
      { key: "visitorName", type: "string", size: 160, required: true },
      { key: "code", type: "string", size: 16, required: true },
      { key: "gateName", type: "string", size: 128, required: false },
      { key: "guardName", type: "string", size: 128, required: false },
      { key: "entryTime", type: "string", size: 64, required: false },
      { key: "exitTime", type: "string", size: 64, required: false },
      { key: "decision", type: "string", size: 32, required: true }
    ],
    indexes: [
      { key: "visitor_log_visitor_idx", type: "key", attributes: ["visitorId"] },
      { key: "visitor_log_code_idx", type: "key", attributes: ["code"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_GUARD_CHECKPOINTS,
    name: "Guard Checkpoints",
    columns: [
      ...baseColumns,
      { key: "checkpointId", type: "string", size: 64, required: false },
      { key: "checkpointCode", type: "string", size: 64, required: true },
      { key: "checkpointName", type: "string", size: 128, required: false },
      { key: "name", type: "string", size: 128, required: true },
      { key: "gateName", type: "string", size: 128, required: false },
      { key: "locationLabel", type: "string", size: 255, required: false },
      { key: "qrToken", type: "string", size: 128, required: true },
      { key: "latitude", type: "float", required: false },
      { key: "longitude", type: "float", required: false },
      { key: "allowedRadius", type: "integer", required: false, default: 25 },
      { key: "status", type: "string", size: 32, required: true },
      { key: "sortOrder", type: "integer", required: false, default: 0 }
    ],
    indexes: [
      { key: "checkpoint_code_unique", type: "unique", attributes: ["estateId", "checkpointCode"] },
      { key: "checkpoint_token_unique", type: "unique", attributes: ["qrToken"] },
      { key: "checkpoint_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_GUARD_PATROL_EVENTS,
    name: "Guard Patrol Events",
    columns: [
      ...baseColumns,
      { key: "checkpointId", type: "string", size: 64, required: true },
      { key: "checkpointCode", type: "string", size: 64, required: true },
      { key: "checkpointName", type: "string", size: 128, required: false },
      { key: "qrToken", type: "string", size: 128, required: false },
      { key: "guardId", type: "string", size: 64, required: false },
      { key: "guardProfileId", type: "string", size: 64, required: true },
      { key: "guardName", type: "string", size: 128, required: false },
      { key: "scanType", type: "string", size: 32, required: true },
      { key: "scannedAt", type: "datetime", required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "deviceLatitude", type: "float", required: false },
      { key: "deviceLongitude", type: "float", required: false },
      { key: "checkpointLatitude", type: "float", required: false },
      { key: "checkpointLongitude", type: "float", required: false },
      { key: "allowedRadius", type: "integer", required: false },
      { key: "distanceMeters", type: "float", required: false },
      { key: "isGpsVerified", type: "boolean", required: false, default: false },
      { key: "isOfflineLog", type: "boolean", required: false, default: false },
      { key: "deviceLabel", type: "string", size: 128, required: false },
      { key: "note", type: "string", size: 512, required: false }
    ],
    indexes: [
      { key: "patrol_checkpoint_idx", type: "key", attributes: ["checkpointId"] },
      { key: "patrol_guard_idx", type: "key", attributes: ["guardProfileId"] },
      { key: "patrol_scanned_idx", type: "key", attributes: ["scannedAt"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_SECURITY_INCIDENTS,
    name: "Security Incidents",
    columns: [
      ...baseColumns,
      { key: "incidentType", type: "string", size: 64, required: true },
      { key: "severity", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "reportedByRole", type: "string", size: 32, required: true },
      { key: "reportedByProfileId", type: "string", size: 64, required: false },
      { key: "assignedToProfileId", type: "string", size: 64, required: false },
      { key: "locationLabel", type: "string", size: 255, required: false },
      { key: "summary", type: "string", size: 160, required: true },
      { key: "details", type: "string", size: 2048, required: false },
      { key: "openedAt", type: "datetime", required: true },
      { key: "resolvedAt", type: "datetime", required: false }
    ],
    indexes: [
      { key: "incident_status_idx", type: "key", attributes: ["status"] },
      { key: "incident_severity_idx", type: "key", attributes: ["severity"] },
      { key: "incident_assignee_idx", type: "key", attributes: ["assignedToProfileId"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_CSO_REVIEWS,
    name: "CSO Reviews",
    columns: [
      ...baseColumns,
      { key: "incidentId", type: "string", size: 64, required: true },
      { key: "csoProfileId", type: "string", size: 64, required: true },
      { key: "decision", type: "string", size: 64, required: true },
      { key: "note", type: "string", size: 2048, required: false },
      { key: "reviewedAt", type: "datetime", required: true },
      { key: "followUpDate", type: "string", size: 32, required: false },
      { key: "status", type: "string", size: 32, required: true }
    ],
    indexes: [
      { key: "cso_review_incident_idx", type: "key", attributes: ["incidentId"] },
      { key: "cso_review_profile_idx", type: "key", attributes: ["csoProfileId"] },
      { key: "cso_review_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_AUDIT_LOGS,
    name: "Audit Logs",
    columns: [
      ...baseColumns,
      { key: "actor", type: "string", size: 128, required: true },
      { key: "action", type: "string", size: 160, required: true },
      { key: "entityType", type: "string", size: 64, required: true },
      { key: "entityId", type: "string", size: 64, required: true },
      { key: "metadata", type: "string", size: 4096, required: false }
    ],
    indexes: [
      { key: "audit_entity_idx", type: "key", attributes: ["entityType", "entityId"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_ANNOUNCEMENTS,
    name: "Announcements",
    columns: [
      { key: "estateId", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 160, required: true },
      { key: "message", type: "string", size: 4096, required: true },
      { key: "priority", type: "string", size: 32, required: true },
      { key: "targetRole", type: "string", size: 32, required: true },
      { key: "createdBy", type: "string", size: 64, required: true },
      { key: "createdByName", type: "string", size: 160, required: true },
      { key: "publishedAt", type: "datetime", required: false },
      { key: "expiresAt", type: "datetime", required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "isPinned", type: "boolean", required: false, default: false },
      { key: "createdAt", type: "datetime", required: true },
      { key: "updatedAt", type: "datetime", required: true }
    ],
    indexes: [
      { key: "announcement_estate_status_idx", type: "key", attributes: ["estateId", "status"] },
      { key: "announcement_target_idx", type: "key", attributes: ["targetRole"] },
      { key: "announcement_published_idx", type: "key", attributes: ["publishedAt"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_COMPLAINTS,
    name: "Complaints",
    columns: [
      { key: "estateId", type: "string", size: 64, required: true },
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "residentName", type: "string", size: 160, required: true },
      { key: "unitCode", type: "string", size: 64, required: true },
      { key: "propertyCode", type: "string", size: 64, required: true },
      { key: "category", type: "string", size: 32, required: true },
      { key: "priority", type: "string", size: 32, required: true },
      { key: "subject", type: "string", size: 160, required: true },
      { key: "description", type: "string", size: 4096, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "assignedTo", type: "string", size: 64, required: false },
      { key: "assignedToName", type: "string", size: 160, required: false },
      { key: "adminResponse", type: "string", size: 4096, required: false },
      { key: "resolvedAt", type: "datetime", required: false },
      { key: "createdAt", type: "datetime", required: true },
      { key: "updatedAt", type: "datetime", required: true }
    ],
    indexes: [
      { key: "complaint_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "complaint_status_idx", type: "key", attributes: ["status"] },
      { key: "complaint_priority_idx", type: "key", attributes: ["priority"] },
      { key: "complaint_created_idx", type: "key", attributes: ["createdAt"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_KNOWLEDGE_BASE,
    name: "Knowledge Base",
    columns: [
      { key: "estateId", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 160, required: true },
      { key: "content", type: "string", size: 8192, required: true },
      { key: "category", type: "string", size: 32, required: true },
      { key: "targetRole", type: "string", size: 32, required: true },
      { key: "createdBy", type: "string", size: 64, required: true },
      { key: "createdByName", type: "string", size: 160, required: true },
      { key: "isPublished", type: "boolean", required: false, default: false },
      { key: "viewCount", type: "integer", required: false, default: 0 },
      { key: "sortOrder", type: "integer", required: false, default: 0 },
      { key: "tags", type: "string", size: 1024, required: false },
      { key: "createdAt", type: "datetime", required: true },
      { key: "updatedAt", type: "datetime", required: true }
    ],
    indexes: [
      { key: "knowledge_category_idx", type: "key", attributes: ["category"] },
      { key: "knowledge_target_idx", type: "key", attributes: ["targetRole"] },
      { key: "knowledge_published_idx", type: "key", attributes: ["isPublished"] },
      { key: "knowledge_sort_idx", type: "key", attributes: ["sortOrder"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_HOUSEHOLD_MEMBERS,
    name: "Household Members",
    columns: [
      { key: "estateId", type: "string", size: 64, required: true },
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "unitCode", type: "string", size: 64, required: true },
      { key: "propertyCode", type: "string", size: 64, required: true },
      { key: "fullName", type: "string", size: 160, required: true },
      { key: "relationship", type: "string", size: 32, required: true },
      { key: "phone", type: "string", size: 64, required: false },
      { key: "idType", type: "string", size: 32, required: false },
      { key: "idNumber", type: "string", size: 128, required: false },
      { key: "photoFileId", type: "string", size: 128, required: false },
      { key: "hasEstateAccess", type: "boolean", required: false, default: false },
      { key: "accessNote", type: "string", size: 1024, required: false },
      { key: "addedBy", type: "string", size: 64, required: true },
      { key: "status", type: "string", size: 32, required: true },
      { key: "createdAt", type: "datetime", required: true },
      { key: "updatedAt", type: "datetime", required: true }
    ],
    indexes: [
      { key: "household_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "household_unit_idx", type: "key", attributes: ["unitCode"] },
      { key: "household_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_SUBSCRIPTION_RATES,
    name: "Subscription Rates",
    columns: [
      { key: "estateId", type: "string", size: 64, required: true },
      { key: "apartmentType", type: "string", size: 64, required: true },
      { key: "monthlyRate", type: "integer", required: true },
      { key: "effectiveFrom", type: "datetime", required: true },
      { key: "effectiveTo", type: "datetime", required: false },
      { key: "createdBy", type: "string", size: 64, required: true },
      { key: "reason", type: "string", size: 512, required: true },
      { key: "createdAt", type: "datetime", required: true },
      { key: "updatedAt", type: "datetime", required: true }
    ],
    indexes: [
      { key: "subscription_rate_unique", type: "unique", attributes: ["estateId", "apartmentType", "effectiveFrom"] },
      { key: "subscription_rate_type_idx", type: "key", attributes: ["apartmentType"] },
      { key: "subscription_rate_effective_idx", type: "key", attributes: ["effectiveFrom"] }
    ]
  },
  {
    tableId: APPWRITE_TABLE_MONTHLY_BILLING_RUNS,
    name: "Monthly Billing Runs",
    columns: [
      { key: "estateId", type: "string", size: 64, required: true },
      { key: "billingMonth", type: "string", size: 16, required: true },
      { key: "runDate", type: "datetime", required: true },
      { key: "runBy", type: "string", size: 64, required: true },
      { key: "runByName", type: "string", size: 160, required: true },
      { key: "totalResidents", type: "integer", required: true },
      { key: "billsCreated", type: "integer", required: true },
      { key: "autoPaidFromCredit", type: "integer", required: true },
      { key: "requiresPayment", type: "integer", required: true },
      { key: "skipped", type: "integer", required: true },
      { key: "errors", type: "integer", required: true },
      { key: "errorDetails", type: "string", size: 4096, required: false },
      { key: "status", type: "string", size: 32, required: true },
      { key: "createdAt", type: "datetime", required: true }
    ],
    indexes: [
      { key: "billing_run_unique", type: "unique", attributes: ["estateId", "billingMonth"] },
      { key: "billing_run_status_idx", type: "key", attributes: ["status"] },
      { key: "billing_run_date_idx", type: "key", attributes: ["runDate"] }
    ]
  }
];

export const appwriteOnboardingTableIds = appwriteOnboardingTables.map((table) => table.tableId);
