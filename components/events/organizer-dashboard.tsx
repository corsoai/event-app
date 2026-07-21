"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, MapPin, Plus, RefreshCw, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { EventRecord, Guest } from "@/lib/types";
import { readAppwriteAdminEvents, readAppwriteEventGuests } from "@/lib/appwrite/browser-data";

const LIVE_REFRESH_MS = 8000;

export function OrganizerDashboard() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      setEvents(await readAppwriteAdminEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Events could not be loaded online.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const featuredEvent = useMemo(() => pickFeaturedEvent(events), [events]);
  const liveCount = events.filter((item) => item.status === "live").length;

  return (
    <>
      <PageHeader title="Organizer dashboard" description="Create events, send guest passes, and watch arrivals in real time.">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            {loading ? "Loading" : "Refresh"}
          </Button>
          <Link href="/admin/events">
            <Button>
              <Plus className="h-4 w-4" />
              New event
            </Button>
          </Link>
        </div>
      </PageHeader>

      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <StatCard label="Events" value={loading ? "..." : String(events.length)} helper="All events in this workspace" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Live now" value={loading ? "..." : String(liveCount)} helper="Events checking guests in" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Next event" value={loading ? "..." : featuredEvent ? shortEventDate(featuredEvent.startAt) : "—"} helper={featuredEvent?.name ?? "Create your first event"} icon={<MapPin className="h-5 w-5" />} />
      </div>

      {featuredEvent ? <FeaturedEventArrivals event={featuredEvent} /> : null}

      <Card className="mt-6">
        <CardHeader title="Your events" description="Tap an event to manage its guest list and passes." />
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="rounded-xl border border-line p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-300">
            No events yet. Create your first event to start building a guest list.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.slice(0, 6).map((item) => (
              <Link key={item.id} href={`/admin/events/${item.id}`}>
                <div className="h-full cursor-pointer rounded-xl border border-line bg-white/[0.03] p-4 transition hover:border-smart/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.venue ? (
                    <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.venue}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">{shortEventDate(item.startAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function FeaturedEventArrivals({ event }: { event: EventRecord }) {
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
        // Non-fatal — the arrivals card just keeps its last numbers.
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
  const total = guests.length;
  const percent = total ? Math.round((arrived / total) * 100) : 0;

  return (
    <Card className="mt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {event.status === "live" ? "Live arrivals" : "Arrivals"} · {event.name}
          </p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {loaded ? `${arrived} of ${total}` : "…"}
            <span className="ml-2 text-base font-normal text-slate-300">guests arrived</span>
          </p>
        </div>
        <Link href={`/admin/events/${event.id}`}>
          <Button type="button" variant="secondary">
            <Users className="h-4 w-4" />
            Manage guest list
          </Button>
        </Link>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-smart transition-all duration-700" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {loaded ? `${percent}% of the guest list has checked in. Updates automatically.` : "Loading guest list..."}
      </p>
    </Card>
  );
}

function pickFeaturedEvent(events: EventRecord[]) {
  if (!events.length) return null;
  const live = events.filter((item) => item.status === "live");
  if (live.length) return live[0];
  const upcoming = [...events]
    .filter((item) => item.status !== "ended")
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
  return upcoming[0] ?? events[0];
}

function shortEventDate(value: string) {
  if (!value) return "TBA";
  try {
    return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}
