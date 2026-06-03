import type {
  Announcement,
  Bill,
  Complaint,
  EmergencyAlert,
  Estate,
  KnowledgeArticle,
  Payment,
  Resident,
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

export const residents: Resident[] = [
  {
    id: "res-001",
    estateId: "lekki-gardens",
    name: "Amina Okafor",
    houseNumber: "B12",
    phone: "+234 803 920 4412",
    email: "amina.okafor@example.com",
    type: "owner",
    status: "active"
  },
  {
    id: "res-002",
    estateId: "lekki-gardens",
    name: "Tunde Balogun",
    houseNumber: "C04",
    phone: "+234 805 110 9320",
    email: "tunde.balogun@example.com",
    type: "tenant",
    status: "active"
  },
  {
    id: "res-003",
    estateId: "vi-court",
    name: "Ngozi Hassan",
    houseNumber: "Penthouse 2",
    phone: "+234 809 440 2281",
    email: "ngozi.hassan@example.com",
    type: "owner",
    status: "active"
  },
  {
    id: "res-004",
    estateId: "abuja-royal",
    name: "Chinedu Eze",
    houseNumber: "R18",
    phone: "+234 812 617 0031",
    email: "chinedu.eze@example.com",
    type: "tenant",
    status: "inactive"
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
    title: "May 2026 Service Charge",
    amount: 85000,
    dueDate: "2026-05-28",
    status: "unpaid"
  },
  {
    id: "bill-002",
    residentId: "res-002",
    estateId: "lekki-gardens",
    title: "Security Levy",
    amount: 30000,
    dueDate: "2026-05-20",
    status: "partially paid"
  },
  {
    id: "bill-003",
    residentId: "res-003",
    estateId: "vi-court",
    title: "Power Infrastructure Levy",
    amount: 140000,
    dueDate: "2026-05-30",
    status: "paid"
  },
  {
    id: "bill-004",
    residentId: "res-004",
    estateId: "abuja-royal",
    title: "Waste Management",
    amount: 18000,
    dueDate: "2026-05-05",
    status: "overdue"
  }
];

export const payments: Payment[] = [
  {
    id: "pay-001",
    billId: "bill-003",
    residentId: "res-003",
    amount: 140000,
    reference: "GTB-TRF-54012",
    date: "2026-05-09",
    status: "confirmed"
  },
  {
    id: "pay-002",
    billId: "bill-002",
    residentId: "res-002",
    amount: 15000,
    reference: "OPAY-192001",
    date: "2026-05-12",
    status: "pending"
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
    message: "Please upload payment proof after transfer to the estate account.",
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
    houseNumber: "C04",
    phone: "+234 805 110 9320",
    type: "suspicious_movement",
    status: "acknowledged",
    notes: "Resident reported movement around C Block parking after midnight.",
    createdAt: "2026-05-15T22:18:00.000Z",
    acknowledgedAt: "2026-05-15T22:20:00.000Z",
    acknowledgedBy: "Main Gate A",
    siren: false,
    locationLabel: "C04, LBS View Estate, Lagos"
  }
];

export const activityLogs = [
  "Visitor code 482913 invited by Amina Okafor",
  "Security checked in Kemi Adeyemi at Main Gate A",
  "Payment proof OPAY-192001 uploaded by Tunde Balogun",
  "Complaint CMP-002 assigned to Main Gate A",
  "Announcement published to all residents"
];

