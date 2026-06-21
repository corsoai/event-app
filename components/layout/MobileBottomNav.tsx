"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardList,
  CreditCard,
  Home,
  LayoutDashboard,
  MapPin,
  QrCode,
  ReceiptText,
  Shield,
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
  tone?: "danger";
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);

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
    if (role !== "cso" && role !== "security_guard" && role !== "admin") return;

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

  useEffect(() => {
    function checkKeyboardState() {
      const activeElement = document.activeElement;
      const focusedInput = isTextEntryElement(activeElement);
      const visualViewport = window.visualViewport;
      const viewportShrunk = visualViewport ? window.innerHeight - visualViewport.height > 140 : false;
      const mobileWidth = window.innerWidth < 1024;

      setKeyboardOpen(Boolean(focusedInput && mobileWidth && (viewportShrunk || focusedInput)));
    }

    function checkAfterFocusChange() {
      window.setTimeout(checkKeyboardState, 80);
    }

    window.addEventListener("focusin", checkKeyboardState);
    window.addEventListener("focusout", checkAfterFocusChange);
    window.addEventListener("resize", checkKeyboardState);
    window.visualViewport?.addEventListener("resize", checkKeyboardState);
    checkKeyboardState();

    return () => {
      window.removeEventListener("focusin", checkKeyboardState);
      window.removeEventListener("focusout", checkAfterFocusChange);
      window.removeEventListener("resize", checkKeyboardState);
      window.visualViewport?.removeEventListener("resize", checkKeyboardState);
    };
  }, []);

  if (keyboardOpen) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 overflow-hidden rounded-3xl border border-line bg-white/95 px-1.5 pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.45rem)" }}
      aria-label="Mobile primary navigation"
    >
      <div className="mx-auto grid h-16 max-w-2xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActiveMobileTab(pathname, item.href);
          const danger = item.tone === "danger";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative grid min-h-12 place-items-center content-center gap-0.5 rounded-2xl px-1 text-[10px] font-semibold text-slate-500 transition",
                danger && "text-red-600",
                active && (danger ? "bg-red-600/10 text-red-700" : `${estateGreen} bg-[#1a7c4a]/10`)
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
      { label: "SOS", href: "/resident/sos", icon: AlertTriangle, tone: "danger" }
    ];
  }

  if (role === "security_guard") {
    return [
      { label: "Dashboard", href: "/security", icon: Shield },
      { label: "Verify", href: "/security/verify-visitor", icon: QrCode },
      { label: "Expected", href: "/security/expected-visitors", icon: Users },
      { label: "Logs", href: "/security/logs", icon: ClipboardList },
      { label: "SOS", href: "/security/sos-alerts", icon: AlertTriangle, badge: openIncidents, tone: "danger" }
    ];
  }

  if (role === "cso") {
    return [
      { label: "Dashboard", href: "/cso", icon: Shield },
      { label: "SOS", href: "/cso/sos-alerts", icon: AlertTriangle, badge: openIncidents, tone: "danger" },
      { label: "Checkpoints", href: "/cso#checkpoints", icon: MapPin },
      { label: "Patrol", href: "/cso#patrol-feed", icon: Activity }
    ];
  }

  return [
    { label: "Dashboard", href: role === "super_admin" ? "/super-admin" : "/admin", icon: LayoutDashboard },
    { label: "Residents", href: "/admin/residents", icon: Users },
    { label: "SOS", href: "/admin/sos-alerts", icon: AlertTriangle, badge: openIncidents, tone: "danger" },
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

function isTextEntryElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName.toLowerCase();
  if (tagName === "textarea" || tagName === "select") {
    return true;
  }

  if (tagName !== "input") {
    return false;
  }

  const type = (element.getAttribute("type") ?? "text").toLowerCase();
  return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(type);
}
