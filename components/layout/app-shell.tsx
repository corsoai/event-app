"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
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
import { cn } from "@/lib/utils";

const icons = {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
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

export type NavItem = {
  label: string;
  href: string;
  icon: keyof typeof icons;
};

export function AppShell({
  roleLabel,
  navItems,
  children,
  bottomNav = false
}: {
  roleLabel: string;
  navItems: NavItem[];
  children: ReactNode;
  bottomNav?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const dashboardHref = navItems[0]?.href ?? "/";

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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

  function logout() {
    localStorage.removeItem("corso_user");
    document.cookie = "corso_role=; Max-Age=0; path=/";
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link href={dashboardHref} className="flex items-center gap-2 font-semibold text-white" aria-label={`${roleLabel} dashboard`}>
            <BrandMark className="h-9 w-9" />
            Corso
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
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href}
                onNavigate={() => setOpen(false)}
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

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/10 bg-black/40 px-3 py-5 shadow-[10px_0_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl lg:flex">
        <div className="shrink-0">
          <Link href={dashboardHref} className="flex items-center gap-3 px-2 text-white">
            <BrandMark className="h-11 w-11" />
            <span>
              <span className="block text-base font-semibold">Corso</span>
              <span className="text-xs text-slate-400">{roleLabel}</span>
            </span>
          </Link>
          <div className="mt-4 grid grid-cols-2 gap-2 px-1">
            <ThemeToggleButton theme={theme} onToggle={() => setTheme((value) => value === "dark" ? "light" : "dark")} compact />
            <button
              onClick={logout}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-slate-100 transition hover:bg-white/15 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
        <nav className="mt-6 grid flex-1 gap-1 overflow-y-auto overscroll-contain pr-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
      </aside>

      <main className={cn("px-4 pb-24 pt-20 lg:ml-64 lg:px-5 lg:py-7 xl:px-6", bottomNav && "pb-28")}>
        {children}
      </main>

      {bottomNav ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-black/55 px-2 py-2 backdrop-blur-2xl lg:hidden">
          {navItems.slice(0, 5).map((item) => {
            const Icon = icons[item.icon];
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "grid min-h-14 place-items-center gap-1 rounded-lg text-[11px] font-medium text-slate-400",
                  active && "bg-white/10 text-smart"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
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
      <span className={cn("hidden", wide || compact ? "lg:inline" : "sm:inline")}>{showingDark ? "Light" : "Dark"}</span>
    </button>
  );
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = icons[item.icon];
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white",
        active && "bg-white/10 text-smart shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
