import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { securityNav } from "@/components/layout/nav";
import { SosAlarmWatcher } from "@/components/security/sos-alarm";

export default function SecurityLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="security_guard" roleLabel="Security Guard" navItems={securityNav}>
      {children}
      <SosAlarmWatcher />
    </AppShell>
  );
}
