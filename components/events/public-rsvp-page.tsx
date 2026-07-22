"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, MapPin } from "lucide-react";
import { QRCodeImage } from "@/components/dashboard/pages";
import { ForceLightTheme } from "@/components/theme/force-light";

type PublicEvent = {
  id: string;
  name: string;
  venue: string;
  address: string;
  startAt: string;
  status: "draft" | "live" | "ended";
};

type IssuedPass = {
  fullName: string;
  code: string;
  category: string;
};

export function PublicRsvpPage({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pass, setPass] = useState<IssuedPass | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`/api/public/events/${encodeURIComponent(eventId)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as { event?: PublicEvent; error?: string };
        if (!response.ok || !payload.event) {
          throw new Error(payload.error ?? "This event could not be loaded.");
        }
        if (active) setEvent(payload.event);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "This event could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [eventId]);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    // React nulls currentTarget after the first await — capture it now.
    const formElement = formEvent.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setFormError("");
    try {
      const response = await fetch(`/api/public/events/${encodeURIComponent(eventId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(form.get("fullName") ?? ""),
          phone: String(form.get("phone") ?? "")
        })
      });
      const payload = await response.json().catch(() => ({})) as { guest?: IssuedPass; error?: string };
      if (!response.ok || !payload.guest) {
        throw new Error(payload.error ?? `Your RSVP could not be saved (HTTP ${response.status}).`);
      }
      setPass(payload.guest);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Your RSVP could not be saved.");
    } finally {
      setSubmitting(false);
    }
  }

  const shareMessage = pass && event
    ? [
        `My pass for ${event.name}`,
        `Name: ${pass.fullName}`,
        `Check-in code: ${pass.code}`,
        event.venue ? `Venue: ${event.venue}` : "",
        "Show this code or the QR at the gate.",
        "Powered by Corsvent"
      ].filter(Boolean).join("\n")
    : "";

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-x-hidden bg-[#f5f5f7] px-4 py-10">
      <ForceLightTheme />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.10),transparent_45%),radial-gradient(circle_at_90%_100%,rgba(251,191,36,0.07),transparent_45%)]" />
      <div className="relative z-10 w-full max-w-md">
        <p className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.25em] text-emerald-700">Corsvent</p>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-slate-200" />
          </div>
        ) : error || !event ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-900">Event not available</p>
            <p className="mt-2 text-sm text-slate-600">{error || "This event could not be loaded."}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">{event.name}</h1>
            <div className="mt-3 grid gap-1.5 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" />
                {formatPublicDate(event.startAt)}
              </p>
              {event.venue || event.address ? (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-700" />
                  {[event.venue, event.address].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>

            {pass ? (
              <div className="mt-6">
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  You&apos;re on the list, {pass.fullName}!
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                  <QRCodeImage value={pass.code} />
                  <p className="mt-4 font-mono text-2xl font-semibold tracking-widest text-slate-900">{pass.code}</p>
                  <p className="mt-2 text-sm text-slate-600">Show this code or QR at the gate. Screenshot it now.</p>
                </div>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block w-full rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Save to WhatsApp
                </a>
              </div>
            ) : event.status === "ended" ? (
              <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                RSVP for this event has closed.
              </p>
            ) : (
              <form className="mt-6 grid gap-4" onSubmit={submit}>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Full name
                  <input
                    name="fullName"
                    required
                    minLength={2}
                    maxLength={160}
                    placeholder="e.g. Adaeze Okafor"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-emerald-500"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                  Phone number
                  <input
                    name="phone"
                    required
                    inputMode="tel"
                    placeholder="e.g. 08012345678"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-emerald-500"
                  />
                </label>
                {formError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? "Getting your pass..." : "RSVP — get my free pass"}
                </button>
                <p className="text-center text-xs text-slate-500">
                  Already RSVP&apos;d? Enter the same phone number to see your pass again.
                </p>
              </form>
            )}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">Event passes by Corsvent · corso.ng</p>
      </div>
    </main>
  );
}

function formatPublicDate(value: string) {
  if (!value) return "Date to be announced";
  try {
    return new Intl.DateTimeFormat("en-NG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(new Date(value));
  } catch {
    return value;
  }
}
