import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { adminNav } from "@/components/layout/nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="admin" roleLabel="Organizer" navItems={adminNav}>
      {children}
    </AppShell>
  );
}
