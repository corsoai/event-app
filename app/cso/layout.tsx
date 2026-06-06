import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { csoNav } from "@/components/layout/nav";

export default function CsoLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell roleLabel="Chief Security Officer" navItems={csoNav}>
      {children}
    </AppShell>
  );
}
