import type { NavItem } from "@/components/layout/app-shell";

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: "Gauge" },
  { label: "🚨 SOS", href: "/admin/sos-alerts", icon: "AlertTriangle", tone: "danger", badge: "sos" },
  { label: "Events", href: "/admin/events", icon: "CalendarDays" },
  { label: "Organizer Profile", href: "/admin/estate", icon: "Building2" },
  { label: "Users & Roles", href: "/admin/users", icon: "Users" },
  { label: "Reports", href: "/admin/reports", icon: "BarChart3" },
  { label: "Settings", href: "/admin/settings", icon: "Settings" }
];

export const residentNav: NavItem[] = [
  { label: "Home", href: "/resident", icon: "Home" },
  { label: "Invite Visitor", href: "/resident/invite-visitor", icon: "QrCode" },
  { label: "Complaints", href: "/resident/complaints", icon: "ClipboardList" },
  { label: "Digital ID", href: "/resident/digital-id", icon: "IdCard", module: "digital_ids" },
  { label: "Visitors", href: "/resident/visitors", icon: "DoorOpen" },
  { label: "Announcements", href: "/resident/announcements", icon: "Bell" },
  { label: "🚨 SOS", href: "/resident/sos", icon: "AlertTriangle", tone: "danger" }
];

export const securityNav: NavItem[] = [
  { label: "Dashboard", href: "/security", icon: "Gauge" },
  { label: "🚨 SOS", href: "/security/sos-alerts", icon: "AlertTriangle", tone: "danger", badge: "sos" },
  { label: "Guest Check-in", href: "/security/checkin", icon: "CalendarDays" },
  { label: "VIP Parking", href: "/security/vip-parking", icon: "Car", module: "plate_capture" }
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
  { label: "Organizer Workspaces", href: "/super-admin/estates", icon: "Building2" },
  { label: "Users & Roles", href: "/super-admin/users", icon: "Users" },
  { label: "Reports", href: "/super-admin/reports", icon: "BarChart3" },
  { label: "Settings", href: "/super-admin/settings", icon: "Settings" }
];
