import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { residentNav } from "@/components/layout/nav";

export default function ResidentLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell roleLabel="Resident" navItems={residentNav} bottomNav>
      {children}
    </AppShell>
  );
}
