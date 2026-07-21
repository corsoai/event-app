"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, MapPin, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { EventRecord } from "@/lib/types";
import { createAppwriteAdminEvent, readAppwriteAdminEvents } from "@/lib/appwrite/browser-data";

export function EventsAdminPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setEvents(await readAppwriteAdminEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Events could not be loaded online.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React nulls event.currentTarget after the first await — capture it now.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startDate = String(form.get("startDate") ?? "");
    const startTime = String(form.get("startTime") ?? "10:00");

    setCreating(true);
    setCreateMessage("");
    try {
      const created = await createAppwriteAdminEvent({
        name: String(form.get("name") ?? ""),
        venue: String(form.get("venue") ?? ""),
        address: String(form.get("address") ?? ""),
        startAt: startDate ? `${startDate}T${startTime}` : "",
        gates: String(form.get("gates") ?? "")
      });
      setCreateMessage(`"${created.name}" created. Add guests from the event page.`);
      formElement.reset();
      await refresh();
    } catch (err) {
      setCreateMessage(err instanceof Error ? err.message : "Event could not be saved online.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader title="Events" description="Create events, manage guest lists, and track check-in at the gate.">
        <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? "Loading" : "Refresh"}
        </Button>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <div>
          {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Card key={index} className="p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-white/10" />
                </Card>
              ))}
            </div>
          ) : events.length === 0 ? (
            <Card>
              <div className="p-4 text-center text-sm text-slate-300">
                No events yet. Create your first event to start building a guest list.
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {events.map((item) => (
                <Link key={item.id} href={`/admin/events/${item.id}`}>
                  <Card className="h-full cursor-pointer transition hover:border-smart/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="rounded-lg border border-smart/20 bg-smart/15 p-2.5 text-smart">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">{item.name}</p>
                    {item.venue ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {item.venue}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">{formatEventDateTime(item.startAt)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <Card>
          <CardHeader title="New event" description="Basic details — you can edit these later." />
          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Event name"><Input name="name" placeholder="e.g. Adaeze & Tunde's Wedding" required /></Field>
            <Field label="Venue"><Input name="venue" placeholder="e.g. Eko Convention Centre" /></Field>
            <Field label="Address"><Input name="address" placeholder="e.g. Victoria Island, Lagos" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Event date"><Input name="startDate" type="date" required /></Field>
              <Field label="Start time"><Input name="startTime" type="time" defaultValue="10:00" /></Field>
            </div>
            <Field label="Gates (optional)"><Input name="gates" placeholder="e.g. Main Gate, VIP Gate" /></Field>
            <Button type="submit" disabled={creating}>
              <Plus className="h-4 w-4" />
              {creating ? "Creating event..." : "Create event"}
            </Button>
            {createMessage ? <p className="text-sm text-slate-300">{createMessage}</p> : null}
          </form>
        </Card>
      </div>
    </>
  );
}

function formatEventDateTime(value: string) {
  if (!value) return "Date not set";
  try {
    return new Intl.DateTimeFormat("en-NG", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(new Date(value));
  } catch {
    return value;
  }
}
