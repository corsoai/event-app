import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  IdCard,
  QrCode,
  ShieldCheck
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { DemoRequestForm } from "@/components/landing/demo-request-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features: Array<[string, string, LucideIcon]> = [
  ["Visitor access control", "Residents create time-bound visitor codes. Security verifies at the gate.", QrCode],
  ["Digital estate billing", "Admins create service charges and track unpaid, partial, paid, and overdue bills.", CreditCard],
  ["Complaints and maintenance", "Residents report issues while estate managers assign and update status.", ClipboardList],
  ["Digital resident ID", "Residents, staff, vendors, and guards can carry QR-ready IDs.", IdCard],
  ["Estate announcements", "Target owners, tenants, security, residents, and vendors.", Bell],
  ["Admin analytics", "Track residents, visitors, payments, complaints, and activity logs.", BadgeCheck]
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-ink text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-white">
            <BrandMark className="h-10 w-10" />
            <span className="font-semibold">Corso</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#demo" className="hover:text-white">Demo</a>
            <a href="#contact" className="hover:text-white">Contact</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/signup" className="hidden text-sm font-semibold text-slate-200 hover:text-smart sm:inline">
              Request Access
            </Link>
            <Link href="/login" className="text-sm font-semibold text-smart">Login</Link>
          </div>
        </div>
      </header>

      <section className="estate-photo-bg relative overflow-hidden border-b border-white/10">
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div className="min-w-0">
            <p className="max-w-xl text-sm font-semibold uppercase leading-7 tracking-[0.2em] text-smart">Smart access. Secure estates. Total control.</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Corso
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-100/90">
              A mobile-first estate management platform for security teams, residents, visitor access, billing, complaints, announcements, digital IDs, and admin reports.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup">
                <Button className="w-full sm:w-auto">Create Resident Account <ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" className="w-full sm:w-auto">Sign In</Button>
              </Link>
            </div>
          </div>
          <div id="demo" className="relative min-w-0">
            <div className="rounded-lg border border-white/15 bg-black/35 p-4 shadow-glow backdrop-blur-2xl">
              <div className="grid gap-4 md:grid-cols-3">
                {["Main Gate A", "Visitors", "Payments"].map((label, index) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
                    <p className="text-xs text-slate-300">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{["08", "24", "NGN 2.1m"][index]}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-smart/30 bg-smart/15 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-smart">Verified visitor</p>
                    <p className="mt-2 text-xl font-semibold text-white">Guest Access</p>
                    <p className="text-sm text-slate-300">One-time code - Family visit</p>
                  </div>
                  <QrCode className="h-16 w-16 text-smart" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 rounded-lg border border-white/10 bg-black/35 p-4 backdrop-blur-xl">
                <BrandMark className="h-16 w-16" />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-smart">Corso</p>
                  <p className="mt-1 text-sm text-slate-300">Estate security, visitor management, access logs, and connected daily operations.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Card className="shadow-none">
                  <Building2 className="h-5 w-5 text-smart" />
                  <p className="mt-4 font-semibold text-white">LBS View Estate</p>
                  <p className="mt-2 text-sm text-slate-400">Residents, dues, gates, IDs, and maintenance in one secure dashboard.</p>
                </Card>
                <Card className="shadow-none">
                  <ShieldCheck className="h-5 w-5 text-smart" />
                  <p className="mt-4 font-semibold text-white">Security guard mode</p>
                  <p className="mt-2 text-sm text-slate-400">Fast code lookup, check-in, checkout, and ID status verification.</p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-smart">MVP focus</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Core estate operations without heavy version 2 scope</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(([title, body, Icon]) => (
            <Card key={title}>
              <Icon className="h-6 w-6 text-smart" />
              <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="contact" className="border-t border-white/10 bg-white/[0.04]">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-smart">Request Demo</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Deploy a smarter estate workflow</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Use this MVP as a foundation for a secure Corso estate product with managed auth, role-based dashboards, and mobile-ready access.
            </p>
          </div>
          <DemoRequestForm />
        </div>
      </section>
    </main>
  );
}

