import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { superAdminNav } from "@/components/layout/nav";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="super_admin" roleLabel="Super Admin" navItems={superAdminNav}>
      {children}
    </AppShell>
  );
}
