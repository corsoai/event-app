import type { NavItem } from "@/components/layout/app-shell";

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "Gauge" },
  { label: "🚨 SOS", href: "/admin/sos-alerts", icon: "AlertTriangle", tone: "danger", badge: "sos" },
  { label: "Estate Profile", href: "/admin/estate", icon: "Building2" },
  { label: "Users & Roles", href: "/admin/users", icon: "Users" },
  { label: "Residents", href: "/admin/residents", icon: "Users" },
  { label: "Visitor Logs", href: "/admin/visitors", icon: "QrCode" },
  { label: "Bills", href: "/admin/bills", icon: "ReceiptText" },
  { label: "Payments", href: "/admin/payments", icon: "WalletCards" },
  { label: "Complaints", href: "/admin/complaints", icon: "ClipboardList" },
  { label: "Facilities", href: "/admin/facilities", icon: "Building2", module: "facilities" },
  { label: "Announcements", href: "/admin/announcements", icon: "Megaphone" },
  { label: "Digital IDs", href: "/admin/digital-ids", icon: "IdCard", module: "digital_ids" },
  { label: "Knowledge Base", href: "/admin/knowledge-base", icon: "BookOpen", module: "knowledge_base" },
  { label: "Reports", href: "/admin/reports", icon: "BarChart3" },
  { label: "System Status", href: "/admin/system", icon: "ShieldCheck" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" }
];

export const residentNav: NavItem[] = [
  { label: "Home", href: "/resident", icon: "Home" },
  { label: "Invite Visitor", href: "/resident/invite-visitor", icon: "QrCode" },
  { label: "My Bills", href: "/resident/bills", icon: "ReceiptText" },
  { label: "Complaints", href: "/resident/complaints", icon: "ClipboardList" },
  { label: "Digital ID", href: "/resident/digital-id", icon: "IdCard", module: "digital_ids" },
  { label: "Visitors", href: "/resident/visitors", icon: "DoorOpen" },
  { label: "Payments", href: "/resident/payments", icon: "CreditCard" },
  { label: "Announcements", href: "/resident/announcements", icon: "Bell" },
  { label: "Household", href: "/resident/household", icon: "Users", module: "household" },
  { label: "Marketplace", href: "/marketplace", icon: "Store", module: "marketplace" },
  { label: "Knowledge Base", href: "/resident/knowledge-base", icon: "BookOpen", module: "knowledge_base" },
  { label: "🚨 SOS", href: "/resident/sos", icon: "AlertTriangle", tone: "danger" }
];

export const securityNav: NavItem[] = [
  { label: "Dashboard", href: "/security", icon: "Gauge" },
  { label: "🚨 SOS", href: "/security/sos-alerts", icon: "AlertTriangle", tone: "danger", badge: "sos" },
  { label: "Verify Visitor", href: "/security/verify-visitor", icon: "QrCode" },
  { label: "Guard Tour", href: "/security/guard-tour", icon: "ShieldCheck", module: "guard_tour" },
  { label: "Expected Visitors", href: "/security/expected-visitors", icon: "DoorOpen" },
  { label: "Entry Logs", href: "/security/logs", icon: "FileText" },
  { label: "Verify Digital ID", href: "/security/verify-id", icon: "IdCard", module: "digital_ids" }
];

export const csoNav: NavItem[] = [
  { label: "Command", href: "/cso", icon: "Gauge" },
  { label: "Personnel", href: "/cso/personnel", icon: "Users" },
  { label: "🚨 SOS", href: "/cso/sos-alerts", icon: "AlertTriangle", tone: "danger", badge: "sos" },
  { label: "Checkpoints", href: "/cso#checkpoints", icon: "ShieldCheck", module: "guard_tour" },
  { label: "Patrol Feed", href: "/cso#patrol-feed", icon: "FileText", module: "guard_tour" }
];

export const superAdminNav: NavItem[] = [
  { label: "Dashboard", href: "/super-admin", icon: "Gauge" },
  { label: "Estates", href: "/super-admin/estates", icon: "Building2" },
  { label: "Users & Roles", href: "/super-admin/users", icon: "Users" },
  { label: "Reports", href: "/super-admin/reports", icon: "BarChart3" },
  { label: "Settings", href: "/super-admin/settings", icon: "Settings" }
];
