"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardList, Copy, Link2, MapPin, Pencil, RefreshCw, Search, UserPlus, Users, UploadCloud, X } from "lucide-react";
import { PageHeader, QRCodeImage } from "@/components/dashboard/pages";
import { VipParkingCard } from "@/components/events/vip-parking-card";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CheckinRecord, EventRecord, Guest, GuestCategory } from "@/lib/types";
import {
  bulkCreateAppwriteGuests,
  createAppwriteGuest,
  readAppwriteAdminEvent,
  readAppwriteEventCheckins,
  readAppwriteEventGuests,
  updateAppwriteAdminEventDetails,
  updateAppwriteAdminEventStatus,
  type GuestCreateInput
} from "@/lib/appwrite/browser-data";

export function EventDetailPage({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [checkins, setCheckins] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [guestQuery, setGuestQuery] = useState("");

  async function refresh(silent = false) {
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const [eventData, guestData, checkinData] = await Promise.all([
        readAppwriteAdminEvent(eventId),
        readAppwriteEventGuests(eventId),
        readAppwriteEventCheckins(eventId).catch(() => null)
      ]);
      setEvent(eventData);
      setGuests(guestData);
      if (checkinData) setCheckins(checkinData);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "Event could not be loaded online.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(true), 8000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const checkedInCount = useMemo(() => guests.filter((guest) => guest.status === "checked-in").length, [guests]);
  const vipCount = useMemo(() => guests.filter((guest) => guest.category === "vip").length, [guests]);
  const visibleGuests = useMemo(() => {
    const query = guestQuery.trim().toLowerCase();
    if (!query) return guests;
    return guests.filter((guest) =>
      guest.fullName.toLowerCase().includes(query) ||
      (guest.phone ?? "").replace(/\D/g, "").includes(query.replace(/\D/g, "") || "\u0000") ||
      guest.code.includes(query)
    );
  }, [guests, guestQuery]);

  async function setStatus(status: EventRecord["status"]) {
    if (!event) return;
    setUpdatingStatus(true);
    try {
      setEvent(await updateAppwriteAdminEventStatus(event.id, status));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Event status could not be updated online.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading && !event) {
    return (
      <>
        <PageHeader title="Loading event..." description="Fetching event details." />
        <Card className="p-6">
          <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
        </Card>
      </>
    );
  }

  if (!event) {
    return (
      <>
        <PageHeader title="Event not found" description="This event may have been removed." />
        {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      </>
    );
  }

  return (
    <>
      <PageHeader title={event.name} description={[event.venue, event.address].filter(Boolean).join(" · ") || "No venue set yet."}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={event.status} />
          <Button type="button" variant="secondary" onClick={() => setEditing((current) => !current)}>
            <Pencil className="h-4 w-4" />
            {editing ? "Close" : "Edit"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            {loading ? "Loading" : "Refresh"}
          </Button>
          {event.status === "draft" ? (
            <Button type="button" onClick={() => void setStatus("live")} disabled={updatingStatus}>
              Go live
            </Button>
          ) : null}
          {event.status === "live" ? (
            <Button type="button" variant="secondary" onClick={() => void setStatus("ended")} disabled={updatingStatus}>
              End event
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {error ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {editing ? (
        <EditEventForm
          event={event}
          onSaved={(updated) => {
            setEvent(updated);
            setEditing(false);
          }}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total guests" value={String(guests.length)} helper="On the list" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Checked in" value={String(checkedInCount)} helper={guests.length ? `${Math.round((checkedInCount / guests.length) * 100)}% arrived` : "No guests yet"} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="VIP guests" value={String(vipCount)} helper="Category: VIP" icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Event date" value={formatEventDate(event.startAt)} helper={event.venue || "Venue not set"} icon={<MapPin className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader title="Guest list" description={`${guests.length} guest${guests.length === 1 ? "" : "s"} invited.`} />
          {guests.length > 5 ? (
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={guestQuery}
                onChange={(inputEvent) => setGuestQuery(inputEvent.target.value)}
                placeholder="Search by name, phone, or code..."
                className="pl-9"
              />
            </div>
          ) : null}
          {guests.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-300">No guests added yet. Use the form to add your first guest.</div>
          ) : visibleGuests.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-300">No guests match &quot;{guestQuery}&quot;.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-2 pr-3">Guest</th>
                    <th className="pb-2 pr-3">Category</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visibleGuests.map((guest) => (
                    <tr key={guest.id}>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-white">{guest.fullName}</p>
                        <p className="text-xs text-slate-400">{guest.phone || guest.email || "No contact"}</p>
                      </td>
                      <td className="py-2.5 pr-3 capitalize text-slate-300">{guest.category}</td>
                      <td className="py-2.5 pr-3"><StatusBadge status={guest.status} /></td>
                      <td className="py-2.5 pr-3 text-right">
                        <Button type="button" variant="secondary" onClick={() => setSelectedGuest(guest)}>
                          View pass
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid gap-6">
          <AddGuestForm eventId={eventId} onAdded={() => void refresh()} />
          <BulkImportGuests eventId={eventId} onImported={() => void refresh()} />
        </div>
      </div>

      <RsvpLinkCard eventId={eventId} eventName={event.name} />

      <VipParkingCard eventId={eventId} />

      <Card className="mt-6">
        <CardHeader title="Gate log" description="Every scan at the gate, newest first — including duplicate attempts." />
        {checkins.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-300">No scans yet. The log fills up as gate staff check guests in.</div>
        ) : (
          <div className="grid gap-2">
            {checkins.slice(0, 15).map((scan) => (
              <div key={scan.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{scan.guestName || "Unknown guest"}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatScanTime(scan.scannedAt)}{scan.gate ? ` · ${scan.gate}` : ""}
                  </p>
                </div>
                <StatusBadge status={scan.result === "duplicate" ? "duplicate scan" : "checked-in"} tone={scan.result === "duplicate" ? "yellow" : "green"} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {selectedGuest ? (
        <GuestPassModal guest={selectedGuest} event={event} onClose={() => setSelectedGuest(null)} />
      ) : null}
    </>
  );
}

function EditEventForm({ event, onSaved }: { event: EventRecord; onSaved: (updated: EventRecord) => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const { dateValue, timeValue } = splitEventStart(event.startAt);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    // React nulls currentTarget after the first await — capture it now.
    const formElement = formEvent.currentTarget;
    const form = new FormData(formElement);
    const startDate = String(form.get("startDate") ?? "");
    const startTime = String(form.get("startTime") ?? "10:00");

    setSaving(true);
    setMessage("");
    try {
      const updated = await updateAppwriteAdminEventDetails(event.id, {
        name: String(form.get("name") ?? ""),
        venue: String(form.get("venue") ?? ""),
        address: String(form.get("address") ?? ""),
        startAt: startDate ? `${startDate}T${startTime}` : event.startAt,
        gates: String(form.get("gates") ?? "")
      });
      onSaved(updated);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Event could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader title="Edit event" description="Fix the name, venue, date, or gates — guest passes stay valid." />
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Event name"><Input name="name" defaultValue={event.name} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue"><Input name="venue" defaultValue={event.venue} /></Field>
          <Field label="Address"><Input name="address" defaultValue={event.address} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event date"><Input name="startDate" type="date" defaultValue={dateValue} required /></Field>
          <Field label="Start time"><Input name="startTime" type="time" defaultValue={timeValue} /></Field>
        </div>
        <Field label="Gates (optional)"><Input name="gates" defaultValue={event.gates ?? ""} /></Field>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving changes..." : "Save changes"}
        </Button>
        {message ? <p className="text-sm text-danger">{message}</p> : null}
      </form>
    </Card>
  );
}

function splitEventStart(startAt: string) {
  const fallback = { dateValue: "", timeValue: "10:00" };
  if (!startAt) return fallback;
  const parsed = new Date(startAt);
  if (Number.isNaN(parsed.getTime())) return fallback;
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    dateValue: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    timeValue: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  };
}

function AddGuestForm({ eventId, onAdded }: { eventId: string; onAdded: () => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React nulls event.currentTarget after the first await — capture it now.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setMessage("");
    try {
      const created = await createAppwriteGuest(eventId, {
        fullName: String(form.get("fullName") ?? ""),
        phone: String(form.get("phone") ?? ""),
        email: String(form.get("email") ?? ""),
        category: (String(form.get("category") ?? "regular") as GuestCategory)
      });
      setMessage(`${created.fullName} added — code ${created.code}.`);
      formElement.reset();
      onAdded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Guest could not be saved online.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Add a guest" description="Generates a 6-digit code and QR pass." />
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Guest name"><Input name="fullName" required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone"><Input name="phone" /></Field>
          <Field label="Email"><Input name="email" type="email" /></Field>
        </div>
        <Field label="Category">
          <Select name="category" defaultValue="regular">
            <option value="regular">Regular</option>
            <option value="vip">VIP</option>
            <option value="staff">Staff</option>
          </Select>
        </Field>
        <Button type="submit" disabled={saving}>
          <UserPlus className="h-4 w-4" />
          {saving ? "Saving guest..." : "Add guest"}
        </Button>
        {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      </form>
    </Card>
  );
}

function BulkImportGuests({ eventId, onImported }: { eventId: string; onImported: () => void }) {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");

  const parsedCount = useMemo(() => parseGuestPasteText(text).length, [text]);

  function loadCsvFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setText(content.trim());
      setMessage(`Loaded ${file.name} — review the rows below, then import.`);
    };
    reader.onerror = () => setMessage("That file could not be read. Try copy-pasting the rows instead.");
    reader.readAsText(file);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guests = parseGuestPasteText(text);
    if (!guests.length) {
      setMessage("Paste at least one guest row first.");
      return;
    }

    setImporting(true);
    setMessage("");
    try {
      const result = await bulkCreateAppwriteGuests(eventId, guests);
      setMessage(
        `${result.created.length} guest${result.created.length === 1 ? "" : "s"} imported.` +
        (result.errors.length ? ` ${result.errors.length} row(s) failed: ${result.errors.join(" ")}` : "")
      );
      if (result.created.length) {
        setText("");
        onImported();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Guests could not be imported online.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Bulk import" description="Upload a CSV file or paste from Excel — one guest per line: Name, Phone, Category." />
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="CSV file (optional)">
          <Input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => loadCsvFile(event.target.files?.[0])}
          />
        </Field>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"Adaeze Okafor, 08012345678, vip\nTunde Bello, 08023456789, regular"}
          className="min-h-32"
        />
        <p className="text-xs text-slate-400">{parsedCount} guest{parsedCount === 1 ? "" : "s"} detected.</p>
        <Button type="submit" variant="secondary" disabled={importing || !parsedCount}>
          <UploadCloud className="h-4 w-4" />
          {importing ? "Importing..." : `Import ${parsedCount || ""} guest${parsedCount === 1 ? "" : "s"}`}
        </Button>
        {message ? <p className="text-sm text-slate-300">{message}</p> : null}
      </form>
    </Card>
  );
}

function RsvpLinkCard({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [copied, setCopied] = useState(false);
  const [rsvpUrl, setRsvpUrl] = useState("");

  useEffect(() => {
    setRsvpUrl(`${window.location.origin}/e/${eventId}`);
  }, [eventId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(rsvpUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable — the visible URL can be copied by hand.
    }
  }

  const shareMessage = `You're invited to ${eventName}! RSVP here to get your free entry pass: ${rsvpUrl}`;

  return (
    <Card className="mt-6">
      <CardHeader title="Public RSVP link" description="Share this link — guests register themselves and get a pass instantly." />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 truncate rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-slate-300">
          {rsvpUrl || "..."}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="secondary" onClick={() => void copyLink()} disabled={!rsvpUrl}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy"}
          </Button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noreferrer">
            <Button type="button" variant="secondary" disabled={!rsvpUrl}>
              <Link2 className="h-4 w-4" />
              WhatsApp
            </Button>
          </a>
        </div>
      </div>
    </Card>
  );
}

function parseGuestPasteText(text: string): GuestCreateInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Skip a CSV header row like "Name, Phone, Category".
  const firstLine = (lines[0] ?? "").toLowerCase();
  const hasHeader = firstLine.includes("name") && (firstLine.includes("phone") || firstLine.includes("category"));

  return (hasHeader ? lines.slice(1) : lines)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim().replace(/^"|"$/g, "").trim());
      const [fullName, phone, category] = parts;
      const normalizedCategory = (category ?? "").toLowerCase();
      return {
        fullName: fullName ?? "",
        phone: phone || undefined,
        category: normalizedCategory === "vip" || normalizedCategory === "staff" ? normalizedCategory : "regular"
      } satisfies GuestCreateInput;
    })
    .filter((guest) => guest.fullName);
}

function GuestPassModal({ guest, event, onClose }: { guest: Guest; event: EventRecord; onClose: () => void }) {
  const shareMessage = [
    `Hi ${guest.fullName}`,
    `Your pass for ${event.name} is ready.`,
    `Your check-in code: ${guest.code}`,
    event.venue ? `Venue: ${event.venue}` : "",
    `Show this code or the QR at the gate.`,
    "Powered by Corsvent"
  ].filter(Boolean).join("\n");

  const whatsappUrl = guest.phone
    ? `https://wa.me/${normalizeGuestPhone(guest.phone)}?text=${encodeURIComponent(shareMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-2xl border border-line bg-panel p-5 shadow-glow sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-base font-semibold text-white">{guest.fullName}</p>
            <p className="text-xs capitalize text-slate-400">{guest.category} guest</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="rounded-lg border border-smart/30 bg-smart/10 p-4 text-center">
          <QRCodeImage value={guest.code} />
          <p className="mt-4 font-mono text-xl font-semibold text-white">{guest.code}</p>
          <p className="mt-2 text-sm text-slate-300">Show this code or QR at the gate.</p>
        </div>
        <div className="mt-4 grid gap-2">
          <a href={whatsappUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="secondary" className="w-full">Share by WhatsApp</Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function normalizeGuestPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
}

function formatScanTime(value: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatEventDate(value: string) {
  if (!value) return "Not set";
  try {
    return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}
