import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { superAdminNav } from "@/components/layout/nav";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell roleLabel="Super Admin" navItems={superAdminNav}>
      {children}
    </AppShell>
  );
}
