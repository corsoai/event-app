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
    "Set charges per unit, record payments, and see who has paid, part-paid or is owing — with reports ready for your next EXCO meeting.",
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
    <main className="min-h-screen overflow-x-hidden bg-white text-[#1d1d1f] antialiased">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark className="h-8 w-8" />
            <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Corso</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] text-[#424245] md:flex">
            <a href="#features" className="transition hover:text-black">What it does</a>
            <a href="#how" className="transition hover:text-black">How it works</a>
            <a href="#contact" className="transition hover:text-black">Get started</a>
          </nav>
          <Link
            href="/login"
            className="rounded-full bg-[#1d1d1f] px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-black"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="px-5 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <p className="text-[15px] font-semibold text-emerald-700">For gated communities and estates</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-[#1d1d1f] sm:text-6xl">
          Run your estate without the chaos.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#6e6e73]">
          Gate security, visitor passes, service charge, maintenance and resident records —
          in one simple app. Whether you manage twenty homes or two thousand.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-7 py-3.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-emerald-500"
          >
            Book a free demo <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 text-[15px] font-medium text-emerald-700 transition hover:text-emerald-600"
          >
            Try the demo estate <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-5 text-[13px] text-[#86868b]">No card needed. The demo estate is open — tap in and look around.</p>

        <div className="mx-auto mt-16 max-w-3xl">
          <div className="rounded-3xl bg-[#f5f5f7] p-4 sm:p-6">
            <div className="rounded-2xl bg-white p-4 text-left shadow-[0_8px_40px_rgba(0,0,0,0.08)] sm:p-5">
              <div className="flex items-center justify-between rounded-xl bg-[#f5f5f7] px-4 py-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">Main Gate · Today</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#1d1d1f]">Gate activity is live</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">On duty</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  ["Visitors in", "24"],
                  ["Vehicles logged", "61"],
                  ["Open faults", "3"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#f5f5f7] p-3.5">
                    <p className="text-[11px] leading-4 text-[#86868b]">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-[#1d1d1f]">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-amber-50 p-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">Visitor code</p>
                  <p className="mt-1 truncate text-[17px] font-semibold text-[#1d1d1f]">Adaeze O. — expected 4pm</p>
                  <p className="mt-0.5 text-xs text-[#86868b]">One-time pass · Block C</p>
                </div>
                <QrCode className="h-11 w-11 shrink-0 text-amber-600" />
              </div>

              <div className="mt-3 rounded-xl bg-[#f5f5f7] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">Service charge · This quarter</p>
                  <span className="text-[11px] font-semibold text-emerald-700">78% collected</span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/[0.08]">
                  <div className="h-full w-[78%] rounded-full bg-emerald-500" />
                </div>
                <p className="mt-2 text-xs text-[#86868b]">Debtor list ready for the next EXCO meeting.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#f5f5f7]">
        <div className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.5rem] sm:leading-tight">
              The everyday work of an estate, handled.
            </h2>
            <p className="mt-4 text-[17px] leading-7 text-[#6e6e73]">
              Corso covers the jobs that eat your week: the gate, the money, the maintenance,
              and keeping residents informed.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([title, body, Icon]) => (
              <div key={title} className="rounded-2xl bg-white p-6 transition hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                <div className="inline-flex rounded-xl bg-emerald-100/70 p-2.5">
                  <Icon className="h-5 w-5 text-emerald-700" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-[#1d1d1f]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.5rem]">
            Live in days, not months.
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map(([title, body], index) => (
            <div key={title} className="rounded-2xl bg-[#f5f5f7] p-6">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f5f5f7]">
        <div className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.5rem] sm:leading-tight">
              One platform. Every estate.
            </h2>
            <p className="mt-4 text-[17px] leading-7 text-[#6e6e73]">
              Every estate on Corso gets its own secure space — its own residents, gates, billing and reports.
              Nothing crosses over. Each role sees only its own world.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {audiences.map(([title, body, Icon]) => (
              <div key={title} className="rounded-2xl bg-white p-6">
                <Icon className="h-6 w-6 text-emerald-700" />
                <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {[
              "Works on any smartphone",
              "Installs like an app, no app store needed",
              "Built and supported in Nigeria"
            ].map((point) => (
              <p key={point} className="flex items-center gap-2 text-sm text-[#424245]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {point}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.5rem] sm:leading-tight">
              See Corso on your own estate.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#6e6e73]">
              Tell us a little about your community and we&apos;ll walk you through a live demo,
              answer your questions, and give you an honest picture of what setup looks like.
            </p>
            <p className="mt-6 text-[15px] leading-7 text-[#6e6e73]">
              Prefer to look around first?{" "}
              <Link href="/demo" className="font-medium text-emerald-700 hover:text-emerald-600">
                Open the demo estate
              </Link>{" "}
              — no signup required.
            </p>
          </div>
          <DemoRequestForm />
        </div>
      </section>

      <footer className="border-t border-black/[0.06] bg-[#f5f5f7]">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 px-5 py-10 sm:px-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <BrandMark className="h-7 w-7" />
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">Corso</p>
              <p className="text-xs text-[#86868b]">Estate management for African communities</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-[#6e6e73]">
            <a href="#features" className="hover:text-black">What it does</a>
            <a href="#how" className="hover:text-black">How it works</a>
            <Link href="/demo" className="hover:text-black">Demo</Link>
            <Link href="/login" className="hover:text-black">Sign in</Link>
          </nav>
          <p className="text-xs text-[#86868b]">© 2026 Corso. Lagos, Nigeria.</p>
        </div>
      </footer>
    </main>
  );
}
