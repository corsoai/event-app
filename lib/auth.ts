import type { UserRole } from "@/lib/types";
import { DEMO_PASSWORD } from "@/lib/password-policy";

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  estate_admin: "Estate Admin",
  resident: "Resident",
  security_guard: "Security Guard",
  vendor: "Vendor / Domestic Staff"
};

export const roleHome: Record<UserRole, string> = {
  super_admin: "/super-admin",
  estate_admin: "/admin",
  resident: "/resident",
  security_guard: "/security",
  vendor: "/resident/digital-id"
};

export const demoUsers = [
  {
    email: "super@corso.test",
    password: DEMO_PASSWORD,
    role: "super_admin" as UserRole,
    name: "Corso Platform Admin"
  },
  {
    email: "admin@lbsview.test",
    password: DEMO_PASSWORD,
    role: "estate_admin" as UserRole,
    name: "LBS View Estate Manager"
  },
  {
    email: "resident@lbsview.test",
    password: DEMO_PASSWORD,
    role: "resident" as UserRole,
    name: "Amina Okafor"
  },
  {
    email: "security@lbsview.test",
    password: DEMO_PASSWORD,
    role: "security_guard" as UserRole,
    name: "Gate Officer Musa"
  }
];

export function resolveDemoUser(email: string) {
  return demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? demoUsers[2];
}
