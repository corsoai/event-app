"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  MapPin,
  QrCode,
  ReceiptText,
  Shield,
  User,
  Users,
  WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

type MobileRole = UserRole | "admin";

type BottomNavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  badge?: number;
};

type ResidentAccountingResponse = {
  summary?: {
    outstandingBalance?: number;
  } | null;
};

type SosResponse = {
  incidents?: Array<{ status?: string }>;
};

const estateGreen = "text-[#1a7c4a]";

export function MobileBottomNav({ role }: { role: MobileRole }) {
  const pathname = usePathname();
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [openIncidents, setOpenIncidents] = useState(0);

  useEffect(() => {
    if (role !== "resident") return;

    let active = true;
    fetch("/api/appwrite/resident/accounting", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: ResidentAccountingResponse) => {
        if (active) setOutstandingBalance(Math.max(0, Number(payload.summary?.outstandingBalance ?? 0)));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    if (role !== "cso" && role !== "security_guard") return;

    let active = true;
    fetch("/api/appwrite/admin/sos", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: SosResponse) => {
        if (!active) return;
        setOpenIncidents((payload.incidents ?? []).filter((incident) => incident.status === "open" || incident.status === "acknowledged" || incident.status === "responding").length);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [role]);

  const items = useMemo(() => mobileItemsForRole(role, outstandingBalance, openIncidents), [role, outstandingBalance, openIncidents]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 px-1 pt-1 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.35rem)" }}
      aria-label="Mobile primary navigation"
    >
      <div className="mx-auto grid h-16 max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActiveMobileTab(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative grid min-h-11 place-items-center content-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold text-slate-500 transition",
                active && `${estateGreen} bg-[#1a7c4a]/10`
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[9px] leading-4 text-white">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </span>
              <span className="leading-3">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function mobileItemsForRole(role: MobileRole, outstandingBalance: number, openIncidents: number): BottomNavItem[] {
  if (role === "resident") {
    return [
      { label: "Home", href: "/resident", icon: Home },
      { label: "Bills", href: "/resident/bills", icon: ReceiptText, badge: outstandingBalance > 0 ? 1 : 0 },
      { label: "Pay", href: "/resident/payments", icon: CreditCard },
      { label: "Visitors", href: "/resident/visitors", icon: Users },
      { label: "Profile", href: "/resident/digital-id", icon: User }
    ];
  }

  if (role === "security_guard") {
    return [
      { label: "Dashboard", href: "/security", icon: Shield },
      { label: "Verify", href: "/security/verify-visitor", icon: QrCode },
      { label: "Visitors", href: "/security/expected-visitors", icon: Users },
      { label: "Alerts", href: "/security/sos-alerts", icon: Bell, badge: openIncidents },
      { label: "Logs", href: "/security/logs", icon: ClipboardList }
    ];
  }

  if (role === "cso") {
    return [
      { label: "Dashboard", href: "/cso", icon: Shield },
      { label: "Checkpoints", href: "/cso#checkpoints", icon: MapPin },
      { label: "Patrol", href: "/cso#patrol-feed", icon: Activity },
      { label: "Alerts", href: "/cso#alerts", icon: Bell, badge: openIncidents }
    ];
  }

  return [
    { label: "Dashboard", href: role === "super_admin" ? "/super-admin" : "/admin", icon: LayoutDashboard },
    { label: "Residents", href: "/admin/residents", icon: Users },
    { label: "Bills", href: "/admin/bills", icon: ReceiptText },
    { label: "Payments", href: "/admin/payments", icon: WalletCards },
    { label: "Reports", href: role === "super_admin" ? "/super-admin/reports" : "/admin/reports", icon: BarChart3 }
  ];
}

function isActiveMobileTab(pathname: string, href: string) {
  const cleanHref = href.split("#")[0];
  if (cleanHref === "/admin" || cleanHref === "/resident" || cleanHref === "/security" || cleanHref === "/cso" || cleanHref === "/super-admin") {
    return pathname === cleanHref;
  }

  return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
}
