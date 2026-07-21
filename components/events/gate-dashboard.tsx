"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, QrCode, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { EventRecord, Guest } from "@/lib/types";
import { readAppwriteEventGuests, readAppwriteGateEvents } from "@/lib/appwrite/browser-data";

const LIVE_REFRESH_MS = 8000;

export function GateDashboard() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingEvents(true);
      try {
        const list = await readAppwriteGateEvents();
        setEvents(list);
      } catch (err) {
        setEventsError(err instanceof Error ? err.message : "Events could not be loaded online.");
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, []);

  const activeEvent = events.find((item) => item.status === "live") ?? events[0] ?? null;

  return (
    <>
      <PageHeader title="Gate dashboard" description="Check guests in and watch arrivals for your event." />

      {eventsError ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{eventsError}</p> : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/security/checkin"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-smart/40 bg-smart/15 p-5 text-center shadow-[0_18px_40px_rgba(192,255,107,0.16)] transition active:scale-[0.98]"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-smart text-ink">
            <QrCode className="h-6 w-6" />
          </span>
          <span className="text-sm font-semibold leading-tight text-white">Guest Check-in</span>
        </Link>
        <Link
          href="/security/sos-alerts"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] p-5 text-center transition active:scale-[0.98]"
        >
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-white">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <span className="text-sm font-semibold leading-tight text-white">Event SOS</span>
        </Link>
      </div>

      {loadingEvents ? (
        <Card className="mt-4 p-4"><div className="h-4 w-1/2 animate-pulse rounded bg-white/10" /></Card>
      ) : activeEvent ? (
        <ActiveEventPanel event={activeEvent} />
      ) : (
        <Card className="mt-4">
          <div className="p-4 text-center text-sm text-slate-300">No events available yet. Ask the organizer to create one.</div>
        </Card>
      )}
    </>
  );
}

function ActiveEventPanel({ event }: { event: EventRecord }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const list = await readAppwriteEventGuests(event.id);
        if (active) {
          setGuests(list);
          setLoaded(true);
        }
      } catch {
        // Non-fatal — the panel keeps its last numbers.
      }
    }

    setLoaded(false);
    void load();
    const interval = window.setInterval(load, LIVE_REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [event.id]);

  const arrived = guests.filter((guest) => guest.status === "checked-in").length;
  const recentArrivals = guests
    .filter((guest) => guest.status === "checked-in")
    .sort((left, right) => new Date(right.checkedInAt ?? 0).getTime() - new Date(left.checkedInAt ?? 0).getTime())
    .slice(0, 4);

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{event.name}</p>
          <p className="mt-0.5 text-xs text-slate-400">{event.venue || "Venue not set"}</p>
        </div>
        <StatusBadge status={event.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StatCard label="Arrived" value={loaded ? String(arrived) : "…"} helper={loaded ? `of ${guests.length} guests` : "Loading"} icon={<CheckCircle2 className="h-5 w-5" />} href="/security/checkin" />
        <StatCard label="Still expected" value={loaded ? String(Math.max(0, guests.length - arrived)) : "…"} helper="Not yet arrived" icon={<Users className="h-5 w-5" />} href="/security/checkin" />
      </div>
      <Card className="mt-4">
        <CardHeader title="Latest arrivals" description="Most recent guests through the gate. Updates automatically." />
        <div className="grid gap-3">
          {recentArrivals.length ? recentArrivals.map((guest) => (
            <div key={guest.id} className="rounded-lg border border-line bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{guest.fullName}</p>
                  <p className="mt-1 text-xs capitalize text-slate-400">{guest.category} guest{guest.checkedInAt ? ` · ${formatArrivalTime(guest.checkedInAt)}` : ""}</p>
                </div>
                <StatusBadge status={guest.status} />
              </div>
            </div>
          )) : (
            <p className="rounded-lg border border-line bg-white/[0.03] p-3 text-sm text-slate-300">No guests checked in yet.</p>
          )}
        </div>
      </Card>
    </>
  );
}

function formatArrivalTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
  } catch {
    return value;
  }
}
