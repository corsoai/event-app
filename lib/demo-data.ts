import type {
  AuditLog,
  Announcement,
  Bill,
  Complaint,
  EmergencyAlert,
  Estate,
  KnowledgeArticle,
  Payment,
  Property,
  Resident,
  Unit,
  Visitor
} from "@/lib/types";

export const estates: Estate[] = [
  {
    id: "lekki-gardens",
    name: "Demo Organizer Workspace",
    address: "Lagos, Nigeria",
    contactEmail: "admin@corsvent.example",
    contactPhone: "+234 801 111 2040",
    gateName: "Main Gate A"
  },
  {
    id: "vi-court",
    name: "Victoria Island Court",
    address: "Akin Adesola Street, Victoria Island, Lagos",
    contactEmail: "office@vicourt.example",
    contactPhone: "+234 802 300 4400",
    gateName: "Ocean Gate"
  },
  {
    id: "abuja-royal",
    name: "Abuja Royal Estate",
    address: "Gwarinpa, Abuja",
    contactEmail: "manager@abujaroyal.example",
    contactPhone: "+234 803 540 7100",
    gateName: "Royal Gate"
  },
  {
    id: "banana-residence",
    name: "Banana Island Residence",
    address: "Banana Island, Ikoyi, Lagos",
    contactEmail: "security@bananaresidence.example",
    contactPhone: "+234 809 440 0011",
    gateName: "Lagoon Gate"
  }
];

export const properties: Property[] = [
  {
    id: "prop-ldi-01",
    estateId: "lekki-gardens",
    propertyCode: "LDI-01",
    name: "LDI-01",
    description: "Four-unit compound near the main gate",
    street: "LBS View Estate, Digital Identity Row",
    status: "active"
  },
  {
    id: "prop-ldi-14",
    estateId: "lekki-gardens",
    propertyCode: "LDI-14",
    name: "LDI-14",
    description: "Eight-tenant compound",
    street: "LBS View Estate, Central Close",
    status: "active"
  },
  {
    id: "prop-ldi-22",
    estateId: "lekki-gardens",
    propertyCode: "LDI-22",
    name: "LDI-22",
    description: "Single-house compound",
    street: "LBS View Estate, Palm Avenue",
    status: "active"
  },
  {
    id: "prop-jc",
    estateId: "lekki-gardens",
    propertyCode: "JC",
    name: "Jeds Court Apartments",
    description: "Mini estate inside LBS View Estate",
    street: "LBS View Estate",
    legacyName: "Jed's Court Apartments",
    status: "active"
  },
  {
    id: "prop-aa",
    estateId: "lekki-gardens",
    propertyCode: "AA",
    name: "Ateeq Apartment",
    description: "Eight-unit Ateeq Apartment block inside LBS View Estate",
    street: "LBS View Estate",
    legacyName: "Ateeq Apartments",
    status: "active"
  },
  {
    id: "prop-vic-02",
    estateId: "vi-court",
    propertyCode: "VIC-02",
    name: "VIC-02",
    description: "Victoria Island Court tower",
    street: "Akin Adesola Street",
    status: "active"
  },
  {
    id: "prop-abr-18",
    estateId: "abuja-royal",
    propertyCode: "ABR-18",
    name: "ABR-18",
    description: "Abuja Royal residential block",
    street: "Gwarinpa",
    status: "active"
  }
];

export const units: Unit[] = [
  {
    id: "unit-ldi-01-a",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-01",
    unitCode: "LDI-01-A",
    label: "Apartment A",
    apartmentType: "2 bedroom flat",
    status: "vacant",
    legacyName: "Former boys' quarters"
  },
  {
    id: "unit-ldi-01-b",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-01",
    unitCode: "LDI-01-B",
    label: "Apartment B",
    apartmentType: "3 bedroom flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-01-c",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-01",
    unitCode: "LDI-01-C",
    label: "Apartment C",
    apartmentType: "2 bedroom flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-01-d",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-01",
    unitCode: "LDI-01-D",
    label: "Apartment D",
    apartmentType: "1 bedroom flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-a",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-A",
    label: "Apartment A",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-b",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-B",
    label: "Apartment B",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-c",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-C",
    label: "Apartment C",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-d",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-D",
    label: "Apartment D",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-e",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-E",
    label: "Apartment E",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-f",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-F",
    label: "Apartment F",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-g",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-G",
    label: "Apartment G",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-14-h",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitCode: "LDI-14-H",
    label: "Apartment H",
    apartmentType: "Mini flat",
    status: "vacant"
  },
  {
    id: "unit-ldi-22-a",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-22",
    unitCode: "LDI-22-A",
    label: "Main house",
    apartmentType: "Detached house",
    status: "vacant"
  },
  {
    id: "unit-aa-1",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-1",
    label: "Apartment 1",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A1, Ateeq Apartments"
  },
  {
    id: "unit-aa-2",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-2",
    label: "Apartment 2",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A2, Ateeq Apartments"
  },
  {
    id: "unit-aa-3",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-3",
    label: "Apartment 3",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A3, Ateeq Apartments"
  },
  {
    id: "unit-aa-4",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-4",
    label: "Apartment 4",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A4, Ateeq Apartments"
  },
  {
    id: "unit-aa-5",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-5",
    label: "Apartment 5",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A5, Ateeq Apartments"
  },
  {
    id: "unit-aa-6",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-6",
    label: "Apartment 6",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A6, Ateeq Apartments"
  },
  {
    id: "unit-aa-7",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-7",
    label: "Apartment 7",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A7, Ateeq Apartments"
  },
  {
    id: "unit-aa-8",
    estateId: "lekki-gardens",
    propertyId: "prop-aa",
    unitCode: "AA-8",
    label: "Apartment 8",
    apartmentType: "Duplex",
    status: "vacant",
    legacyName: "A8, Ateeq Apartments"
  },
  {
    id: "unit-vic-02-p2",
    estateId: "vi-court",
    propertyId: "prop-vic-02",
    unitCode: "VIC-02-P2",
    label: "Penthouse 2",
    apartmentType: "Penthouse",
    status: "vacant",
    legacyName: "Penthouse 2"
  },
  {
    id: "unit-abr-18-a",
    estateId: "abuja-royal",
    propertyId: "prop-abr-18",
    unitCode: "ABR-18-A",
    label: "Apartment A",
    apartmentType: "3 bedroom flat",
    status: "vacant",
    legacyName: "R18"
  }
];

export const residents: Resident[] = [];

export const visitors: Visitor[] = [];

export const bills: Bill[] = [];

export const payments: Payment[] = [];

export const complaints: Complaint[] = [];

export const announcements: Announcement[] = [
  {
    id: "ann-001",
    estateId: "lekki-gardens",
    title: "Power maintenance window",
    message: "Estate transformer servicing is scheduled from 10:00 AM to 1:00 PM on Saturday.",
    target: "all residents",
    priority: "urgent",
    publishDate: "2026-05-15"
  },
  {
    id: "ann-002",
    estateId: "lekki-gardens",
    title: "May dues reminder",
    message: "Please pay estate dues online where possible. Manual receipts remain available for offline payments.",
    target: "owners",
    priority: "normal",
    publishDate: "2026-05-14"
  },
  {
    id: "ann-003",
    estateId: "vi-court",
    title: "New visitor verification process",
    message: "Security will now verify visitor access codes before allowing entry.",
    target: "security",
    priority: "normal",
    publishDate: "2026-05-11"
  }
];

export const knowledgeBase: KnowledgeArticle[] = [
  {
    id: "kb-001",
    title: "Estate Rules",
    category: "Community",
    summary: "Quiet hours, facility usage, short-let policy, parking rules, and conduct guidelines.",
    updatedAt: "2026-05-01"
  },
  {
    id: "kb-002",
    title: "Waste Disposal Guide",
    category: "Facilities",
    summary: "Collection days, bin locations, recycling notes, and bulk waste pickup process.",
    updatedAt: "2026-05-06"
  },
  {
    id: "kb-003",
    title: "Security Rules",
    category: "Access Control",
    summary: "Visitor invitation rules, guest checks, contractor entry, and emergency escalation.",
    updatedAt: "2026-05-10"
  },
  {
    id: "kb-004",
    title: "Payment Instructions",
    category: "Billing",
    summary: "Estate bank account details, payment reference format, and proof upload process.",
    updatedAt: "2026-05-12"
  },
  {
    id: "kb-005",
    title: "Emergency Contacts",
    category: "Safety",
    summary: "Security control room, estate manager, ambulance, fire service, and police contacts.",
    updatedAt: "2026-05-15"
  }
];

export const emergencyAlerts: EmergencyAlert[] = [];

export const activityLogs: string[] = [];

export const auditLogs: AuditLog[] = [];

