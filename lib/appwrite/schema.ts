export const APPWRITE_ONBOARDING_DATABASE_ID = "lbsview_estate";

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
    tableId: "estates",
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
    tableId: "profiles",
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
    tableId: "properties",
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
    tableId: "units",
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
    tableId: "residents",
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
      { key: "expectedMonthly", type: "float", required: false, default: 0 }
    ],
    indexes: [
      { key: "resident_unit_idx", type: "key", attributes: ["unitId"] },
      { key: "resident_status_idx", type: "key", attributes: ["status"] },
      { key: "resident_phone_idx", type: "key", attributes: ["phone"] }
    ]
  },
  {
    tableId: "resident_unit_history",
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
    tableId: "bills",
    name: "Bills",
    columns: [
      ...baseColumns,
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: false },
      { key: "residentId", type: "string", size: 64, required: true },
      { key: "category", type: "string", size: 64, required: true },
      { key: "title", type: "string", size: 160, required: true },
      { key: "amount", type: "float", required: true },
      { key: "paidAmount", type: "float", required: false, default: 0 },
      { key: "dueDate", type: "string", size: 32, required: true },
      { key: "status", type: "string", size: 32, required: true }
    ],
    indexes: [
      { key: "bill_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "bill_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: "payments",
    name: "Payments",
    columns: [
      ...baseColumns,
      { key: "propertyId", type: "string", size: 64, required: false },
      { key: "unitId", type: "string", size: 64, required: false },
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
      { key: "confirmedBy", type: "string", size: 128, required: false }
    ],
    indexes: [
      { key: "payment_reference_unique", type: "unique", attributes: ["reference"] },
      { key: "payment_resident_idx", type: "key", attributes: ["residentId"] },
      { key: "payment_status_idx", type: "key", attributes: ["status"] }
    ]
  },
  {
    tableId: "visitors",
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
    tableId: "visitor_logs",
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
    tableId: "audit_logs",
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
  }
];

export const appwriteOnboardingTableIds = appwriteOnboardingTables.map((table) => table.tableId);
