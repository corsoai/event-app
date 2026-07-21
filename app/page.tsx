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
    "Guest passes that just work",
    "Send each guest a one-time QR code before the event. The gate confirms it in seconds — no printed lists, no arguments at the door.",
    QrCode
  ],
  [
    "VIP parking, tracked",
    "Snap a number plate at the gate and log it instantly, with photos and timestamps — handy for VIP arrivals and government convoys.",
    ScanLine
  ],
  [
    "Paid tickets, sorted",
    "Free RSVPs or paid tiers via Paystack. Payment confirms automatically and the pass goes out the same second.",
    CreditCard
  ],
  [
    "Reports ready to go",
    "Who showed up, who didn't, per gate, per hour — exportable the moment your event ends.",
    ClipboardList
  ],
  [
    "One-tap security alert",
    "Raise an alarm from any phone at the venue. Your security lead sees exactly who and where, immediately.",
    ShieldAlert
  ],
  [
    "Venue patrols you can verify",
    "QR checkpoints with GPS and time stamps prove your security team actually walked the venue — for events where it matters.",
    ShieldCheck
  ],
  [
    "Broadcasts that land",
    "Send updates to all guests, VIPs only, or ushers only — by WhatsApp or email, not a group chat nobody reads.",
    Bell
  ],
  [
    "Digital badges & credentials",
    "QR badges for staff, ushers and VIPs, verifiable at any gate in one scan.",
    IdCard
  ]
];

const steps: Array<[string, string]> = [
  [
    "Create your event",
    "Add the event, then paste or upload your guest list — name, phone, category. Takes minutes, not days."
  ],
  [
    "Your team gets access",
    "Organizers, ushers and gate staff each see only what their role needs. Phone number or email — either works."
  ],
  [
    "You run the gate from your phone",
    "Check-ins, arrivals and live counts, all on your phone. Corsvent is built mobile-first because that is where event-day work happens."
  ]
];

const audiences: Array<[string, string, LucideIcon]> = [
  [
    "Event organizers",
    "Stop juggling guest lists across WhatsApp, Excel and printed sheets. Everything is in one place, with an audit trail.",
    Building2
  ],
  [
    "Ushers & gate staff",
    "Faster check-ins, cleaner logs, verified arrivals. Your team needs a phone and nothing else.",
    ShieldCheck
  ],
  [
    "Guests",
    "Get your pass by WhatsApp, walk straight to the gate, and get scanned in — no queue, no printed ticket to lose.",
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
            <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">Corsvent</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#424245] md:flex">
            <a href="#features" className="transition hover:text-black">What it does</a>
            <a href="#how" className="transition hover:text-black">How it works</a>
            <a href="#contact" className="transition hover:text-black">Get started</a>
          </nav>
          <Link
            href="/login"
            className="rounded-full bg-[#1d1d1f] px-4 py-2 text-sm font-medium text-[#fff] transition hover:bg-black"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="px-5 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <p className="text-base font-semibold text-emerald-700">For events across Nigeria</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-[#1d1d1f] sm:text-6xl">
          Run your event without the chaos.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl leading-9 text-[#6e6e73]">
          Guest lists, digital passes, and gate check-in — in one simple app.
          Whether it&apos;s a wedding for 300 or a conference for three thousand.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-7 py-3.5 text-[15px] font-semibold text-[#fff] shadow-sm transition hover:bg-emerald-500"
          >
            Book a free demo <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[15px] font-medium text-emerald-700 transition hover:text-emerald-600"
          >
            Sign in <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-5 text-sm text-[#86868b]">No card needed to book a walkthrough.</p>

        <div className="mx-auto mt-16 max-w-3xl">
          <div className="rounded-3xl bg-[#f5f5f7] p-4 sm:p-6">
            <div className="rounded-2xl bg-white p-4 text-left shadow-[0_8px_40px_rgba(0,0,0,0.08)] sm:p-5">
              <div className="flex items-center justify-between rounded-xl bg-[#f5f5f7] px-4 py-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">Main Entrance · Today</p>
                  <p className="mt-0.5 text-sm font-semibold text-[#1d1d1f]">Check-in is live</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">Live</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  ["Checked in", "142"],
                  ["Total guests", "300"],
                  ["VIP arrived", "12"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-[#f5f5f7] p-3.5">
                    <p className="text-[11px] leading-4 text-[#86868b]">{label}</p>
                    <p className="mt-1 text-xl font-semibold text-[#1d1d1f]">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-amber-50 p-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">Guest pass</p>
                  <p className="mt-1 truncate text-[17px] font-semibold text-[#1d1d1f]">Adaeze O. — VIP · Table 4</p>
                  <p className="mt-0.5 text-xs text-[#86868b]">One-time pass · Main entrance</p>
                </div>
                <QrCode className="h-11 w-11 shrink-0 text-amber-600" />
              </div>

              <div className="mt-3 rounded-xl bg-[#f5f5f7] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b]">Check-in progress · Today</p>
                  <span className="text-[11px] font-semibold text-emerald-700">47% arrived</span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/[0.08]">
                  <div className="h-full w-[47%] rounded-full bg-emerald-500" />
                </div>
                <p className="mt-2 text-xs text-[#86868b]">158 guests still to arrive before doors close.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#f5f5f7]">
        <div className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.5rem] sm:leading-tight">
              Everything your event day needs, handled.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#6e6e73]">
              Corsvent covers the moments that make or break an event day: the gate,
              the guest list, and keeping everyone informed.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([title, body, Icon]) => (
              <div key={title} className="rounded-2xl bg-white p-6 transition hover:shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                <div className="inline-flex rounded-xl bg-emerald-100/70 p-2.5">
                  <Icon className="h-5 w-5 text-emerald-700" />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-[#6e6e73]">{body}</p>
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
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-[#fff]">
                {index + 1}
              </span>
              <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-[#6e6e73]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f5f5f7]">
        <div className="mx-auto w-full max-w-5xl px-5 py-20 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] sm:text-[2.5rem] sm:leading-tight">
              One platform. Every event.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#6e6e73]">
              Every organizer on Corsvent gets their own secure workspace — their own events,
              guest lists and reports. Nothing crosses over. Each role sees only what it needs.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {audiences.map(([title, body, Icon]) => (
              <div key={title} className="rounded-2xl bg-white p-6">
                <Icon className="h-6 w-6 text-emerald-700" />
                <h3 className="mt-4 text-[17px] font-semibold text-[#1d1d1f]">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-[#6e6e73]">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {[
              "Works on any smartphone",
              "Installs like an app, no app store needed",
              "Built and supported in Nigeria"
            ].map((point) => (
              <p key={point} className="flex items-center gap-2 text-[15px] text-[#424245]">
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
              See Corsvent at your own event.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#6e6e73]">
              Tell us a little about your event and we&apos;ll walk you through a live demo,
              answer your questions, and give you an honest picture of what setup looks like.
            </p>
            <p className="mt-6 text-[15px] leading-7 text-[#6e6e73]">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-emerald-700 hover:text-emerald-600">
                Sign in
              </Link>
              .
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
              <p className="text-sm font-semibold text-[#1d1d1f]">Corsvent</p>
              <p className="text-xs text-[#86868b]">Event management for Nigeria</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#6e6e73]">
            <a href="#features" className="hover:text-black">What it does</a>
            <a href="#how" className="hover:text-black">How it works</a>
            <Link href="/login" className="hover:text-black">Sign in</Link>
          </nav>
          <p className="text-xs text-[#86868b]">© 2026 Corsvent. Lagos, Nigeria.</p>
        </div>
      </footer>
    </main>
  );
}
