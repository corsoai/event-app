import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { residentNav } from "@/components/layout/nav";

export default function ResidentLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="resident" roleLabel="Resident" navItems={residentNav}>
      {children}
    </AppShell>
  );
}
