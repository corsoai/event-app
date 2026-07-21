"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, RefreshCw, UserX, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CheckinRecord, EventRecord, Guest } from "@/lib/types";
import {
  readAppwriteAdminEvents,
  readAppwriteEventCheckins,
  readAppwriteEventGuests
} from "@/lib/appwrite/browser-data";

export function EventReportsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingEvents(true);
      try {
        const list = await readAppwriteAdminEvents();
        setEvents(list);
        const preferred = list.find((item) => item.status === "live") ?? list.find((item) => item.status === "ended") ?? list[0];
        if (preferred) setSelectedEventId(preferred.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Events could not be loaded online.");
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, []);

  const selectedEvent = events.find((item) => item.id === selectedEventId) ?? null;

  return (
    <>
      <PageHeader title="Attendance reports" description="Who came, who didn't — per event, exportable as CSV." />

      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {loadingEvents ? (
        <Card className="p-4"><div className="h-4 w-1/2 animate-pulse rounded bg-white/10" /></Card>
      ) : events.length === 0 ? (
        <Card><div className="p-4 text-center text-sm text-slate-300">No events yet. Reports appear once you create an event and add guests.</div></Card>
      ) : (
        <>
          <Card className="mb-6">
            <Field label="Event">
              <Select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>{event.name} — {event.status}</option>
                ))}
              </Select>
            </Field>
          </Card>
          {selectedEvent ? <EventAttendanceReport event={selectedEvent} /> : null}
        </>
      )}
    </>
  );
}

function EventAttendanceReport({ event }: { event: EventRecord }) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [guestData, checkinData] = await Promise.all([
        readAppwriteEventGuests(event.id),
        readAppwriteEventCheckins(event.id).catch(() => [] as CheckinRecord[])
      ]);
      setGuests(guestData);
      setCheckins(checkinData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report data could not be loaded online.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const arrived = useMemo(() => guests.filter((guest) => guest.status === "checked-in"), [guests]);
  const noShows = useMemo(
    () => guests.filter((guest) => guest.status === "invited"),
    [guests]
  );
  const vipArrived = arrived.filter((guest) => guest.category === "vip").length;
  const attendanceRate = guests.length ? Math.round((arrived.length / guests.length) * 100) : 0;

  function downloadCsv(scope: "all" | "no-shows") {
    const source = scope === "all" ? guests : noShows;
    const rows = [
      ["Name", "Phone", "Email", "Category", "Status", "Checked in at", "Gate"],
      ...source.map((guest) => [
        guest.fullName,
        guest.phone || "",
        guest.email || "",
        guest.category,
        guest.status,
        guest.checkedInAt ?? "",
        guest.checkedInGate ?? ""
      ])
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(event.name)}-${scope === "all" ? "attendance" : "no-shows"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <>
      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Guest list" value={loading ? "..." : String(guests.length)} helper="Invited in total" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Arrived" value={loading ? "..." : String(arrived.length)} helper={`${attendanceRate}% attendance`} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="No-shows" value={loading ? "..." : String(noShows.length)} helper="Never scanned in" icon={<UserX className="h-5 w-5" />} />
        <StatCard label="VIPs arrived" value={loading ? "..." : String(vipArrived)} helper={`${checkins.length} total gate scans`} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? "Loading" : "Refresh"}
        </Button>
        <Button type="button" onClick={() => downloadCsv("all")} disabled={loading || !guests.length}>
          <Download className="h-4 w-4" />
          Export full list (CSV)
        </Button>
        <Button type="button" variant="secondary" onClick={() => downloadCsv("no-shows")} disabled={loading || !noShows.length}>
          <Download className="h-4 w-4" />
          Export no-shows (CSV)
        </Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Arrivals" description="Guests who checked in, most recent first." />
          {arrived.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-300">{loading ? "Loading..." : "No guests have checked in yet."}</div>
          ) : (
            <div className="grid gap-2">
              {[...arrived]
                .sort((left, right) => new Date(right.checkedInAt ?? 0).getTime() - new Date(left.checkedInAt ?? 0).getTime())
                .slice(0, 20)
                .map((guest) => (
                  <div key={guest.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{guest.fullName}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatReportTime(guest.checkedInAt)}{guest.checkedInGate ? ` · ${guest.checkedInGate}` : ""}
                      </p>
                    </div>
                    <span className="text-xs capitalize text-slate-300">{guest.category}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="No-shows" description="Invited guests who never arrived." />
          {noShows.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-300">{loading ? "Loading..." : "Everyone on the list arrived."}</div>
          ) : (
            <div className="grid gap-2">
              {noShows.slice(0, 20).map((guest) => (
                <div key={guest.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{guest.fullName}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{guest.phone || guest.email || "No contact"}</p>
                  </div>
                  <StatusBadge status={guest.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function formatReportTime(value?: string) {
  if (!value) return "Time unknown";
  try {
    return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
  } catch {
    return value;
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "event";
}
