"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Car, Plus, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { VipPlate } from "@/lib/types";
import {
  addAppwriteVipPlate,
  readAppwriteVipPlates,
  readDisabledEstateModules,
  removeAppwriteVipPlate
} from "@/lib/appwrite/browser-data";

/**
 * Organizer-side VIP Parking card on the event detail page.
 * Renders nothing when the workspace has the plate_capture module off.
 */
export function VipParkingCard({ eventId }: { eventId: string }) {
  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [plates, setPlates] = useState<VipPlate[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    let active = true;
    readDisabledEstateModules()
      .then((disabled) => {
        if (active) setModuleEnabled(!disabled.includes("plate_capture"));
      })
      .catch(() => {
        if (active) setModuleEnabled(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    try {
      setPlates(await readAppwriteVipPlates(eventId));
    } catch {
      // Non-fatal — list keeps its last state.
    }
  }

  useEffect(() => {
    if (!moduleEnabled) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, moduleEnabled]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React nulls event.currentTarget after the first await — capture it now.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setMessage("");
    try {
      const created = await addAppwriteVipPlate(
        eventId,
        String(form.get("plate") ?? ""),
        String(form.get("label") ?? "")
      );
      setMessage(`Plate ${created.plate} added to the VIP list.`);
      formElement.reset();
      void refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "VIP plate could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(plate: VipPlate) {
    setRemovingId(plate.id);
    setMessage("");
    try {
      await removeAppwriteVipPlate(eventId, plate.id);
      setMessage(`Plate ${plate.plate} removed.`);
      void refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "VIP plate could not be removed.");
    } finally {
      setRemovingId("");
    }
  }

  if (!moduleEnabled) return null;

  const arrivedCount = plates.filter((plate) => plate.status === "arrived").length;

  return (
    <Card className="mt-6">
      <CardHeader
        title="VIP Parking"
        description={plates.length ? `${arrivedCount} of ${plates.length} expected vehicles have arrived.` : "Register expected VIP plates for the car gate."}
      />
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={submit}>
        <Field label="Plate number"><Input name="plate" placeholder="e.g. ABC123DE" required /></Field>
        <Field label="Owner (optional)"><Input name="label" placeholder="e.g. Chief Adeyemi" /></Field>
        <div className="flex items-end">
          <Button type="submit" disabled={saving}>
            <Plus className="h-4 w-4" />
            {saving ? "Adding..." : "Add plate"}
          </Button>
        </div>
      </form>
      {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
      {plates.length ? (
        <div className="mt-4 grid gap-2">
          {plates.map((plate) => (
            <div key={plate.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <Car className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-white">{plate.plate}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {plate.label || "Unnamed"}{plate.status === "arrived" && plate.arrivedAt ? ` · arrived ${formatPlateTime(plate.arrivedAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={plate.status} tone={plate.status === "arrived" ? "green" : "yellow"} />
                <button
                  type="button"
                  onClick={() => void remove(plate)}
                  disabled={removingId === plate.id}
                  className="rounded-lg p-1 text-slate-400 hover:text-danger"
                  aria-label={`Remove plate ${plate.plate}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function formatPlateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
  } catch {
    return value;
  }
}
