"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  Gauge,
  Home,
  IdCard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  QrCode,
  ReceiptText,
  Settings,
  ShieldCheck,
  Siren,
  Store,
  Sun,
  Users,
  WalletCards
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

const icons = {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  DoorOpen,
  FileText,
  Gauge,
  Home,
  IdCard,
  Megaphone,
  QrCode,
  ReceiptText,
  Settings,
  ShieldCheck,
  Siren,
  Store,
  Users,
  WalletCards
};

type ThemeMode = "light" | "dark";
const THEME_STORAGE_KEY = "corso_theme";
const RESIDENT_ACCOUNTING_CACHE_PREFIX = "corso_resident_accounting_v1:";

export type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof icons;
  tone?: "danger";
  badge?: "sos";
  /** Optional module key — the item hides when the estate disables that module. */
  module?: string;
};

export function AppShell({
  role,
  roleLabel,
  navItems,
  children
}: {
  role: UserRole | "admin";
  roleLabel: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [activeSosCount, setActiveSosCount] = useState(0);
  const [disabledModules, setDisabledModules] = useState<string[]>([]);
  const visibleNavItems = navItems.filter((item) => !item.module || !disabledModules.includes(item.module));
  const dashboardHref = visibleNavItems[0]?.href ?? "/";

  useEffect(() => {
    let active = true;
    fetch("/api/appwrite/estate-modules", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { disabled?: string[] }) => {
        if (active && Array.isArray(payload?.disabled)) setDisabledModules(payload.disabled);
      })
      .catch(() => {
        // keep everything visible if the flag lookup fails
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    router.prefetch(pathname);
    navItems.slice(0, 5).forEach((item) => router.prefetch(item.href));
  }, [navItems, pathname, router]);

  useEffect(() => {
    if (!navItems.some((item) => item.badge === "sos")) return;

    let active = true;

    async function loadSosCount() {
      try {
        const response = await fetch("/api/appwrite/admin/sos", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { incidents?: Array<{ status?: string }> } | null;
        if (!active || !response.ok) return;
        setActiveSosCount((payload?.incidents ?? []).filter((incident) => isActiveSosStatus(incident.status)).length);
      } catch {
        if (active) {
          setActiveSosCount(0);
        }
      }
    }

    void loadSosCount();
    const interval = window.setInterval(loadSosCount, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [navItems]);

  useEffect(() => {
    function warmVisibleRoute() {
      if (document.visibilityState !== "visible") {
        return;
      }

      router.prefetch(pathname);
      if (pathname.startsWith("/resident")) {
        void fetch("/api/appwrite/resident/accounting", { cache: "no-store" }).catch(() => undefined);
      }
    }

    document.addEventListener("visibilitychange", warmVisibleRoute);
    window.addEventListener("focus", warmVisibleRoute);

    return () => {
      document.removeEventListener("visibilitychange", warmVisibleRoute);
      window.removeEventListener("focus", warmVisibleRoute);
    };
  }, [pathname, router]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    setTheme(savedTheme === "dark" ? "dark" : "light");
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, themeLoaded]);

  async function logout() {
    try {
      await fetch("/api/appwrite/auth/logout", {
        method: "POST",
        cache: "no-store"
      });
    } catch {
      // Continue with local cleanup even if the network request fails.
    }

    localStorage.removeItem("corso_user");
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(RESIDENT_ACCOUNTING_CACHE_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
    document.cookie = "corso_role=; Max-Age=0; path=/";
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href={dashboardHref} className="flex items-center gap-2 font-semibold text-white" aria-label={`${roleLabel} dashboard`}>
            <BrandMark className="h-9 w-9" />
            Corsvent
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggleButton theme={theme} onToggle={() => setTheme((value) => value === "dark" ? "light" : "dark")} />
            <button
              aria-label="Logout"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 hover:text-white"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
            <button
              aria-label="Open navigation"
              className="rounded-lg border border-white/15 bg-white/10 p-2 text-slate-100"
              onClick={() => setOpen((value) => !value)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
        {open ? (
          <nav className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 bg-black/65 px-3 py-3 backdrop-blur-xl">
            <div className="grid gap-1">
            {visibleNavItems.map((item) => (
              <NavLink
                key={`${item.href}:${item.label}`}
                item={item}
                active={pathname === item.href}
                onNavigate={() => setOpen(false)}
                badgeCount={item.badge === "sos" ? activeSosCount : 0}
              />
            ))}
            <button
              onClick={logout}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
            </div>
          </nav>
        ) : null}
      </div>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r border-white/10 bg-black/40 px-2 py-5 shadow-[10px_0_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl lg:flex xl:w-64 xl:px-3">
        <div className="shrink-0">
          <Link href={dashboardHref} className="flex items-center justify-center gap-3 px-2 text-white xl:justify-start" title="Corsvent dashboard">
            <BrandMark className="h-11 w-11" />
            <span className="hidden xl:block">
              <span className="block text-base font-semibold">Corsvent</span>
              <span className="text-xs text-slate-400">{roleLabel}</span>
            </span>
          </Link>
          <div className="mt-4 grid gap-2 px-1 xl:grid-cols-2">
            <ThemeToggleButton theme={theme} onToggle={() => setTheme((value) => value === "dark" ? "light" : "dark")} compact />
            <button
              onClick={logout}
              title="Sign out"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/15 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Sign out</span>
            </button>
          </div>
        </div>
        <nav className="mt-6 grid flex-1 gap-1 overflow-y-auto overscroll-contain pr-1">
          {visibleNavItems.map((item) => (
            <NavLink key={`${item.href}:${item.label}`} item={item} active={pathname === item.href} collapseLabel badgeCount={item.badge === "sos" ? activeSosCount : 0} />
          ))}
        </nav>
      </aside>

      <main className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-20 lg:ml-16 lg:px-5 lg:py-7 xl:ml-64 xl:px-6">
        {children}
      </main>

      <MobileBottomNav role={role} />
    </div>
  );
}

function ThemeToggleButton({
  theme,
  onToggle,
  wide = false,
  compact = false
}: {
  theme: ThemeMode;
  onToggle: () => void;
  wide?: boolean;
  compact?: boolean;
}) {
  const showingDark = theme === "dark";
  const Icon = showingDark ? Sun : Moon;
  return (
    <button
      type="button"
      aria-label={showingDark ? "Use light theme" : "Use dark theme"}
      title={showingDark ? "Use light theme" : "Use dark theme"}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/15 hover:text-white",
        wide && "w-full justify-start",
        compact && "w-full"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className={cn("hidden", wide || compact ? "xl:inline" : "sm:inline")}>{showingDark ? "Light" : "Dark"}</span>
    </button>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
  collapseLabel = false,
  badgeCount = 0
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  collapseLabel?: boolean;
  badgeCount?: number;
}) {
  const Icon = icons[item.icon];
  const danger = item.tone === "danger";
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.label}
      className={cn(
        "flex items-center gap-3 rounded-lg border-l-4 border-transparent px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white",
        danger && "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-200 dark:hover:bg-red-500/15 dark:hover:text-white",
        collapseLabel ? "justify-center xl:justify-start" : "justify-start",
        active && (danger ? "border-red-600 bg-red-50 text-red-700 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset] dark:bg-red-500/15 dark:text-red-100" : "bg-white/10 text-smart shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]")
      )}
    >
      <Icon className="h-4 w-4" />
      <span className={collapseLabel ? "hidden xl:inline" : ""}>{item.label}</span>
      {badgeCount > 0 ? (
        <span className={cn("ml-auto min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white", collapseLabel && "xl:ml-auto")}>
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function isActiveSosStatus(status: unknown) {
  return status === "open" || status === "acknowledged" || status === "responding";
}
