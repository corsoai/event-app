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
    name: "LBS View Estate",
    address: "LBS View Estate, Lagos",
    contactEmail: "admin@lbsviewestate.example",
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
    legacyName: "Amina Okafor compound",
    status: "active"
  },
  {
    id: "prop-ldi-14",
    estateId: "lekki-gardens",
    propertyCode: "LDI-14",
    name: "LDI-14",
    description: "Eight-tenant compound",
    street: "LBS View Estate, Central Close",
    legacyName: "Tunde Balogun block",
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
    legacyName: "Ngozi Hassan penthouse",
    status: "active"
  },
  {
    id: "prop-abr-18",
    estateId: "abuja-royal",
    propertyCode: "ABR-18",
    name: "ABR-18",
    description: "Abuja Royal residential block",
    street: "Gwarinpa",
    legacyName: "Chinedu Eze house",
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
    status: "occupied",
    currentResidentId: "res-001",
    moveInDate: "2024-01-10",
    legacyName: "Amina Okafor house"
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
    status: "occupied",
    currentResidentId: "res-002",
    moveInDate: "2025-07-01",
    legacyName: "Tunde Balogun apartment"
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
    status: "occupied",
    currentResidentId: "res-003",
    moveInDate: "2023-04-12",
    legacyName: "Penthouse 2"
  },
  {
    id: "unit-abr-18-a",
    estateId: "abuja-royal",
    propertyId: "prop-abr-18",
    unitCode: "ABR-18-A",
    label: "Apartment A",
    apartmentType: "3 bedroom flat",
    status: "moved out",
    currentResidentId: "res-004",
    moveInDate: "2024-08-01",
    legacyName: "R18"
  }
];

export const residents: Resident[] = [
  {
    id: "res-001",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-01",
    unitId: "unit-ldi-01-b",
    name: "Amina Okafor",
    houseNumber: "LDI-01-B",
    phone: "+234 803 920 4412",
    email: "amina.okafor@example.com",
    type: "owner",
    status: "active",
    moveInDate: "2024-01-10"
  },
  {
    id: "res-002",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitId: "unit-ldi-14-a",
    name: "Tunde Balogun",
    houseNumber: "LDI-14-A",
    phone: "+234 805 110 9320",
    email: "tunde.balogun@example.com",
    type: "tenant",
    status: "active",
    moveInDate: "2025-07-01"
  },
  {
    id: "res-003",
    estateId: "vi-court",
    propertyId: "prop-vic-02",
    unitId: "unit-vic-02-p2",
    name: "Ngozi Hassan",
    houseNumber: "VIC-02-P2",
    phone: "+234 809 440 2281",
    email: "ngozi.hassan@example.com",
    type: "owner",
    status: "active",
    moveInDate: "2023-04-12"
  },
  {
    id: "res-004",
    estateId: "abuja-royal",
    propertyId: "prop-abr-18",
    unitId: "unit-abr-18-a",
    name: "Chinedu Eze",
    houseNumber: "ABR-18-A",
    phone: "+234 812 617 0031",
    email: "chinedu.eze@example.com",
    type: "tenant",
    status: "inactive",
    moveInDate: "2024-08-01"
  }
];

export const visitors: Visitor[] = [
  {
    id: "vis-001",
    residentId: "res-001",
    estateId: "lekki-gardens",
    visitorName: "Cane Corso",
    phone: "+234 906 343 1313",
    visitDate: "2026-05-15",
    arrivalTime: "14:30",
    purpose: "Family visit",
    count: 2,
    code: "482913",
    status: "pending"
  },
  {
    id: "vis-002",
    residentId: "res-002",
    estateId: "lekki-gardens",
    visitorName: "Kemi Adeyemi",
    phone: "+234 802 012 7190",
    visitDate: "2026-05-15",
    arrivalTime: "10:00",
    purpose: "Maintenance inspection",
    count: 1,
    code: "739204",
    status: "checked-in"
  },
  {
    id: "vis-003",
    residentId: "res-003",
    estateId: "vi-court",
    visitorName: "Dispatch Rider",
    phone: "+234 701 220 1199",
    visitDate: "2026-05-15",
    arrivalTime: "16:00",
    purpose: "Delivery",
    count: 1,
    code: "158620",
    status: "verified"
  }
];

export const bills: Bill[] = [
  {
    id: "bill-001",
    residentId: "res-001",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-01",
    unitId: "unit-ldi-01-b",
    category: "Service charge",
    title: "May 2026 Service Charge",
    amount: 85000,
    paidAmount: 0,
    dueDate: "2026-05-28",
    status: "unpaid"
  },
  {
    id: "bill-002",
    residentId: "res-002",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitId: "unit-ldi-14-a",
    category: "Security levy",
    title: "Security Levy",
    amount: 30000,
    paidAmount: 0,
    dueDate: "2026-05-20",
    status: "unpaid"
  },
  {
    id: "bill-003",
    residentId: "res-003",
    estateId: "vi-court",
    propertyId: "prop-vic-02",
    unitId: "unit-vic-02-p2",
    category: "Power/infrastructure levy",
    title: "Power Infrastructure Levy",
    amount: 140000,
    paidAmount: 140000,
    dueDate: "2026-05-30",
    status: "paid"
  },
  {
    id: "bill-004",
    residentId: "res-004",
    estateId: "abuja-royal",
    propertyId: "prop-abr-18",
    unitId: "unit-abr-18-a",
    category: "Waste management",
    title: "Waste Management",
    amount: 18000,
    paidAmount: 0,
    dueDate: "2026-05-05",
    status: "overdue"
  }
];

export const payments: Payment[] = [
  {
    id: "pay-001",
    billId: "bill-003",
    residentId: "res-003",
    estateId: "vi-court",
    propertyId: "prop-vic-02",
    unitId: "unit-vic-02-p2",
    amount: 140000,
    reference: "PSK-LBS-54012",
    processor: "paystack",
    channel: "online",
    providerReference: "paystack_54012",
    date: "2026-05-09",
    status: "confirmed",
    source: "webhook",
    confirmedAt: "2026-05-09T10:22:00.000Z",
    confirmedBy: "Paystack webhook"
  },
  {
    id: "pay-002",
    billId: "bill-002",
    residentId: "res-002",
    estateId: "lekki-gardens",
    propertyId: "prop-ldi-14",
    unitId: "unit-ldi-14-a",
    amount: 15000,
    reference: "OPAY-192001",
    processor: "manual",
    channel: "whatsapp_receipt",
    date: "2026-05-12",
    status: "pending",
    source: "resident"
  }
];

export const complaints: Complaint[] = [
  {
    id: "cmp-001",
    residentId: "res-001",
    category: "power",
    title: "Transformer noise at night",
    priority: "medium",
    status: "in progress",
    createdAt: "2026-05-13",
    assignedTo: "Facility desk"
  },
  {
    id: "cmp-002",
    residentId: "res-002",
    category: "security",
    title: "Unverified visitor around C block",
    priority: "high",
    status: "open",
    createdAt: "2026-05-15",
    assignedTo: "Main Gate A"
  },
  {
    id: "cmp-003",
    residentId: "res-003",
    category: "waste",
    title: "Waste pickup skipped",
    priority: "low",
    status: "resolved",
    createdAt: "2026-05-08",
    assignedTo: "Waste contractor"
  }
];

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

export const emergencyAlerts: EmergencyAlert[] = [
  {
    id: "sos-001",
    estateId: "lekki-gardens",
    residentId: "res-002",
    residentName: "Tunde Balogun",
    houseNumber: "LDI-14-A",
    phone: "+234 805 110 9320",
    type: "suspicious_movement",
    status: "acknowledged",
    notes: "Resident reported movement around C Block parking after midnight.",
    createdAt: "2026-05-15T22:18:00.000Z",
    acknowledgedAt: "2026-05-15T22:20:00.000Z",
    acknowledgedBy: "Main Gate A",
    siren: false,
    locationLabel: "LDI-14-A, LBS View Estate, Lagos"
  }
];

export const activityLogs = [
  "Visitor code 482913 invited by Amina Okafor for LDI-01-B",
  "Security checked in Kemi Adeyemi at Main Gate A",
  "Payment proof OPAY-192001 uploaded by Tunde Balogun for LDI-14-A",
  "Complaint CMP-002 assigned to Main Gate A",
  "Announcement published to all residents"
];

export const auditLogs: AuditLog[] = [
  {
    id: "audit-001",
    estateId: "vi-court",
    actor: "Paystack webhook",
    action: "confirmed online payment",
    entityType: "payment",
    entityId: "pay-001",
    metadata: {
      processor: "paystack",
      amount: 140000,
      billId: "bill-003"
    },
    createdAt: "2026-05-09T10:22:00.000Z"
  },
  {
    id: "audit-002",
    estateId: "lekki-gardens",
    actor: "Resident upload",
    action: "submitted manual payment proof",
    entityType: "payment",
    entityId: "pay-002",
    metadata: {
      channel: "whatsapp_receipt",
      amount: 15000,
      billId: "bill-002"
    },
    createdAt: "2026-05-12T09:40:00.000Z"
  },
  {
    id: "audit-003",
    estateId: "lekki-gardens",
    actor: "Estate admin",
    action: "mapped resident to property unit",
    entityType: "unit",
    entityId: "unit-ldi-01-b",
    metadata: {
      propertyCode: "LDI-01",
      unitCode: "LDI-01-B",
      residentId: "res-001"
    },
    createdAt: "2026-05-15T08:30:00.000Z"
  }
];

