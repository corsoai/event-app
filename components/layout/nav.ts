import type { NavItem } from "@/components/layout/app-shell";

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "Gauge" },
  { label: "Estate Profile", href: "/admin/estate", icon: "Building2" },
  { label: "Users & Roles", href: "/admin/users", icon: "Users" },
  { label: "Residents", href: "/admin/residents", icon: "Users" },
  { label: "Visitor Logs", href: "/admin/visitors", icon: "QrCode" },
  { label: "Bills", href: "/admin/bills", icon: "ReceiptText" },
  { label: "Payments", href: "/admin/payments", icon: "WalletCards" },
  { label: "Complaints", href: "/admin/complaints", icon: "ClipboardList" },
  { label: "Announcements", href: "/admin/announcements", icon: "Megaphone" },
  { label: "Digital IDs", href: "/admin/digital-ids", icon: "IdCard" },
  { label: "Knowledge Base", href: "/admin/knowledge-base", icon: "BookOpen" },
  { label: "Reports", href: "/admin/reports", icon: "BarChart3" },
  { label: "System Status", href: "/admin/system", icon: "ShieldCheck" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" }
];

export const residentNav: NavItem[] = [
  { label: "Home", href: "/resident", icon: "Home" },
  { label: "Invite Visitor", href: "/resident/invite-visitor", icon: "QrCode" },
  { label: "My Bills", href: "/resident/bills", icon: "ReceiptText" },
  { label: "Complaints", href: "/resident/complaints", icon: "ClipboardList" },
  { label: "Digital ID", href: "/resident/digital-id", icon: "IdCard" },
  { label: "Visitors", href: "/resident/visitors", icon: "DoorOpen" },
  { label: "Payments", href: "/resident/payments", icon: "CreditCard" },
  { label: "Announcements", href: "/resident/announcements", icon: "Bell" },
  { label: "Household", href: "/resident/household", icon: "Users" },
  { label: "Knowledge Base", href: "/resident/knowledge-base", icon: "BookOpen" },
  { label: "Marketplace", href: "/marketplace", icon: "Store" }
];

export const securityNav: NavItem[] = [
  { label: "Dashboard", href: "/security", icon: "Gauge" },
  { label: "Verify Visitor", href: "/security/verify-visitor", icon: "QrCode" },
  { label: "Guard Tour", href: "/security/verify-visitor", icon: "ShieldCheck" },
  { label: "Expected Visitors", href: "/security/expected-visitors", icon: "DoorOpen" },
  { label: "Entry Logs", href: "/security/logs", icon: "FileText" },
  { label: "Verify Digital ID", href: "/security/verify-id", icon: "IdCard" }
];

export const csoNav: NavItem[] = [
  { label: "Command", href: "/cso", icon: "Gauge" },
  { label: "Checkpoints", href: "/cso#checkpoints", icon: "ShieldCheck" },
  { label: "Patrol Feed", href: "/cso#patrol-feed", icon: "FileText" },
  { label: "Security Alerts", href: "/cso#alerts", icon: "Siren" }
];

export const superAdminNav: NavItem[] = [
  { label: "Dashboard", href: "/super-admin", icon: "Gauge" },
  { label: "Estates", href: "/super-admin/estates", icon: "Building2" },
  { label: "Users & Roles", href: "/super-admin/users", icon: "Users" },
  { label: "Reports", href: "/super-admin/reports", icon: "BarChart3" },
  { label: "Settings", href: "/super-admin/settings", icon: "Settings" }
];
