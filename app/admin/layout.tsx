import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { adminNav } from "@/components/layout/nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell roleLabel="Estate Admin / Manager" navItems={adminNav}>
      {children}
    </AppShell>
  );
}
