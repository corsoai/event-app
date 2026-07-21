import type { UserRole } from "@/lib/types";
import { DEMO_PASSWORD } from "@/lib/password-policy";

export const roleLabels: Record<UserRole, string> = {
  super_admin: "Super Admin",
  estate_admin: "Organizer",
  cso: "Chief Security Officer",
  resident: "Resident",
  security_guard: "Gate Staff",
  vendor: "Vendor / Domestic Staff"
};

export const roleHome: Record<UserRole, string> = {
  super_admin: "/super-admin",
  estate_admin: "/admin",
  cso: "/cso",
  resident: "/resident",
  security_guard: "/security",
  vendor: "/resident/digital-id"
};

export const demoUsers = [
  {
    email: "super@corso.ng",
    password: DEMO_PASSWORD,
    role: "super_admin" as UserRole,
    name: "Corsvent Platform Admin"
  },
  {
    email: "admin@corso.ng",
    password: DEMO_PASSWORD,
    role: "estate_admin" as UserRole,
    name: "Demo Organizer"
  },
  {
    email: "resident@corso.ng",
    password: DEMO_PASSWORD,
    role: "resident" as UserRole,
    name: "Resident User"
  },
  {
    email: "security@corso.ng",
    password: DEMO_PASSWORD,
    role: "security_guard" as UserRole,
    name: "Gate Officer Musa"
  },
  {
    email: "cso@corso.ng",
    password: DEMO_PASSWORD,
    role: "cso" as UserRole,
    name: "Event Security Lead"
  }
];

export function resolveDemoUser(email: string) {
  return demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? demoUsers[2];
}
