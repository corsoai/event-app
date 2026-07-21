"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, ClipboardList, MapPin, RefreshCw, UserPlus, Users, UploadCloud, X } from "lucide-react";
import { PageHeader, QRCodeImage } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { EventRecord, Guest, GuestCategory } from "@/lib/types";
import {
  bulkCreateAppwriteGuests,
  createAppwriteGuest,
  readAppwriteAdminEvent,
  readAppwriteEventGuests,
  updateAppwriteAdminEventStatus,
  type GuestCreateInput
} from "@/lib/appwrite/browser-data";

export function EventDetailPage({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [eventData, guestData] = await Promise.all([
        readAppwriteAdminEvent(eventId),
        readAppwriteEventGuests(eventId)
      ]);
      setEvent(eventData);
      setGuests(guestData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Event could not be loaded online.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const checkedInCount = useMemo(() => guests.filter((guest) => guest.status === "checked-in").length, [guests]);
  const vipCount = useMemo(() => guests.filter((guest) => guest.category === "vip").length, [guests]);

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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total guests" value={String(guests.length)} helper="On the list" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Checked in" value={String(checkedInCount)} helper={guests.length ? `${Math.round((checkedInCount / guests.length) * 100)}% arrived` : "No guests yet"} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="VIP guests" value={String(vipCount)} helper="Category: VIP" icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Event date" value={formatEventDate(event.startAt)} helper={event.venue || "Venue not set"} icon={<MapPin className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Card>
          <CardHeader title="Guest list" description={`${guests.length} guest${guests.length === 1 ? "" : "s"} invited.`} />
          {guests.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-300">No guests added yet. Use the form to add your first guest.</div>
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
                  {guests.map((guest) => (
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

      {selectedGuest ? (
        <GuestPassModal guest={selectedGuest} event={event} onClose={() => setSelectedGuest(null)} />
      ) : null}
    </>
  );
}

function AddGuestForm({ eventId, onAdded }: { eventId: string; onAdded: () => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
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
      <CardHeader title="Bulk import" description="Paste from Excel/CSV — one guest per line: Name, Phone, Category." />
      <form className="grid gap-4" onSubmit={submit}>
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

function parseGuestPasteText(text: string): GuestCreateInput[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((part) => part.trim());
      const [fullName, phone, category] = parts;
      return {
        fullName: fullName ?? "",
        phone: phone || undefined,
        category: category === "vip" || category === "staff" ? category : "regular"
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
      <div className="w-full max-w-sm rounded-t-2xl bg-slate-900 p-5 sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
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

function formatEventDate(value: string) {
  if (!value) return "Not set";
  try {
    return new Intl.DateTimeFormat("en-NG", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return value;
  }
}
