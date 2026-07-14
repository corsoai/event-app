import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  IdCard,
  QrCode,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Users
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { DemoRequestForm } from "@/components/landing/demo-request-form";

const features: Array<[string, string, LucideIcon]> = [
  [
    "Visitor passes that work",
    "Residents send a one-time code ahead of their guest. The gate confirms it in seconds — no gate-pass books, no arguments at the barrier.",
    QrCode
  ],
  [
    "Plate capture at the gate",
    "Guards snap a number plate and the vehicle is logged instantly, with photos and timestamps your security lead can review anytime.",
    ScanLine
  ],
  [
    "Service charge, tracked",
    "Set charges per unit, record payments, and see who has paid, part-paid or is owing — with debtor and credit reports ready for your next EXCO meeting.",
    CreditCard
  ],
  [
    "Maintenance that gets done",
    "Log faults, assign work orders with due dates, and spot overdue jobs before residents start calling to complain.",
    ClipboardList
  ],
  [
    "One-tap SOS",
    "A resident in trouble raises an alarm from their phone. Security sees who it is and which unit, immediately.",
    ShieldAlert
  ],
  [
    "Patrols you can verify",
    "QR checkpoints with GPS and time stamps prove night patrols actually happened — no more taking anyone's word for it.",
    ShieldCheck
  ],
  [
    "Announcements that land",
    "Send notices to owners only, tenants only, or security only. Nothing gets buried in a group chat again.",
    Bell
  ],
  [
    "Digital estate IDs",
    "QR-ready IDs for residents, domestic staff and vendors, verifiable at the gate in one scan.",
    IdCard
  ]
];

const steps: Array<[string, string]> = [
  [
    "We set up your estate",
    "Your resident list, units and outstanding balances are imported from whatever records you have today — even a spreadsheet."
  ],
  [
    "Your people get their logins",
    "Admins, security guards, and residents each see only what their role needs. Phone number or email — either works."
  ],
  [
    "You run it from your phone",
    "Gate activity, payments, complaints and reports, all live. Corso is built mobile-first because that is where estate work happens."
  ]
];

const audiences: Array<[string, string, LucideIcon]> = [
  [
    "Estate managers & EXCOs",
    "Stop chasing payments and paperwork across WhatsApp, Excel and notebooks. Everything is in one place, with an audit trail.",
    Building2
  ],
  [
    "Security teams",
    "Faster gates, cleaner logs, verified patrols. Guards need a phone and nothing else.",
    ShieldCheck
  ],
  [
    "Residents",
    "Invite visitors, pay dues, report faults, and get estate news — without knocking on the estate office door.",
    Users
  ]
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0c1315] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0c1315]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-white">
            <BrandMark className="h-9 w-9" />
            <span className="text-lg font-semibold tracking-tight">Corso</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-white">What it does</a>
            <a href="#how" className="transition hover:text-white">How it works</a>
            <a href="#contact" className="transition hover:text-white">Get started</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="relative border-b border-white/10">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60rem 28rem at 85% -10%, rgba(52, 211, 153, 0.14), transparent 60%), radial-gradient(40rem 22rem at 0% 110%, rgba(251, 191, 36, 0.08), transparent 60%)"
          }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Running daily operations in Lagos estates
            </p>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              Run your estate without the chaos
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
              Corso puts gate security, visitor passes, service charge, maintenance and resident records
              into one simple app. Built for gated communities and residential estates in Nigeria —
              whether you manage twenty homes or two thousand.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-[#0c1315] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Book a free demo <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Try the demo estate
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-500">
              No card needed. The demo estate is open — tap in and look around.
            </p>
          </div>

          <div className="relative min-w-0">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/40 sm:p-5">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">Main Gate · Today</p>
                  <p className="mt-1 text-sm font-semibold text-white">Gate activity is live</p>
                </div>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  On duty
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  ["Visitors in", "24"],
                  ["Vehicles logged", "61"],
                  ["Open faults", "3"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                    <p className="text-[11px] leading-4 text-slate-400">{label}</p>
                    <p className="mt-1.5 text-xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] p-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-amber-200/90">Visitor code</p>
                  <p className="mt-1.5 truncate text-lg font-semibold text-white">Adaeze O. — expected 4pm</p>
                  <p className="mt-0.5 text-xs text-slate-400">One-time pass · Block C</p>
                </div>
                <QrCode className="h-12 w-12 shrink-0 text-amber-200/90" />
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">Service charge · This quarter</p>
                  <span className="text-[11px] font-semibold text-emerald-300">78% collected</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
                </div>
                <p className="mt-2.5 text-xs text-slate-400">Debtor list ready for the next EXCO meeting.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-emerald-300">What it does</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            The everyday work of an estate, handled
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Corso covers the jobs that eat your week: the gate, the money, the maintenance,
            and keeping residents informed.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, body, Icon]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-400/30 hover:bg-white/[0.05]"
            >
              <div className="inline-flex rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-2.5">
                <Icon className="h-5 w-5 text-emerald-300" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-amber-300">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Live in days, not months
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(([title, body], index) => (
              <div key={title} className="relative rounded-2xl border border-white/10 bg-[#0c1315] p-6">
                <span className="text-sm font-semibold text-amber-300">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-emerald-300">Who it&apos;s for</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            One platform. Every estate. Each role sees its own world.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-400">
            Every estate on Corso gets its own secure space — its own residents, gates, billing and reports.
            Nothing crosses over.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {audiences.map(([title, body, Icon]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <Icon className="h-6 w-6 text-emerald-300" />
              <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
          {[
            "Works on any smartphone",
            "Installs like an app, no app store needed",
            "Built and supported in Nigeria"
          ].map((point) => (
            <p key={point} className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {point}
            </p>
          ))}
        </div>
      </section>

      <section id="contact" className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold text-amber-300">Get started</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              See Corso on your own estate
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Tell us a little about your community and we&apos;ll walk you through a live demo,
              answer your questions, and give you an honest picture of what setup looks like.
            </p>
            <p className="mt-6 text-sm leading-7 text-slate-400">
              Prefer to look around first?{" "}
              <Link href="/demo" className="font-semibold text-emerald-300 hover:text-emerald-200">
                Open the demo estate
              </Link>{" "}
              — no signup required.
            </p>
          </div>
          <DemoRequestForm />
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-5 py-10 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8" />
            <div>
              <p className="text-sm font-semibold text-white">Corso</p>
              <p className="text-xs text-slate-500">Estate management for African communities</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <a href="#features" className="hover:text-white">What it does</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <Link href="/demo" className="hover:text-white">Demo</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
          <p className="text-xs text-slate-500">© 2026 Corso. Lagos, Nigeria.</p>
        </div>
      </footer>
    </main>
  );
}
