"use client";

import { useEffect, useState } from "react";
import { Camera, Car, CheckCircle2, RefreshCw } from "lucide-react";
import { PageHeader, PlateScannerPanel } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { EventRecord, VipPlate } from "@/lib/types";
import {
  markAppwriteVipArrival,
  readAppwriteGateEvents,
  readAppwriteVipPlates
} from "@/lib/appwrite/browser-data";

const LIVE_REFRESH_MS = 8000;

export function VipParkingGatePage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingEvents(true);
      try {
        const list = await readAppwriteGateEvents();
        setEvents(list);
        const live = list.find((item) => item.status === "live") ?? list[0];
        if (live) setSelectedEventId(live.id);
      } catch (err) {
        setEventsError(err instanceof Error ? err.message : "Events could not be loaded online.");
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader title="VIP Parking" description="Log expected VIP vehicles as they arrive at the car gate." />

      {eventsError ? <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{eventsError}</p> : null}

      {loadingEvents ? (
        <Card className="p-4"><div className="h-4 w-1/2 animate-pulse rounded bg-white/10" /></Card>
      ) : events.length === 0 ? (
        <Card><div className="p-4 text-center text-sm text-slate-300">No events available yet. Ask the organizer to create one.</div></Card>
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
          {selectedEventId ? <VipGatePanel eventId={selectedEventId} /> : null}
        </>
      )}
    </>
  );
}

function VipGatePanel({ eventId }: { eventId: string }) {
  const [plates, setPlates] = useState<VipPlate[]>([]);
  const [loading, setLoading] = useState(true);
  const [plateInput, setPlateInput] = useState("");
  const [gateName, setGateName] = useState("Car gate");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [logging, setLogging] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      setPlates(await readAppwriteVipPlates(eventId));
    } catch {
      // Non-fatal — the list keeps its last state.
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(true), LIVE_REFRESH_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const arrived = plates.filter((plate) => plate.status === "arrived").length;

  async function submitPlate() {
    const cleaned = plateInput.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!cleaned) {
      setMessage("Enter the vehicle's plate number.");
      setTone("error");
      return;
    }

    setLogging(true);
    setMessage("Logging arrival...");
    setTone("ok");
    try {
      const plate = await markAppwriteVipArrival(eventId, cleaned, gateName);
      setMessage(`${plate.plate} arrived${plate.label ? ` — ${plate.label}` : ""}.`);
      setTone("ok");
      setPlateInput("");
      void refresh(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "VIP arrival could not be logged.");
      setTone("error");
    } finally {
      setLogging(false);
    }
  }

  function handleScanResult(plate: string) {
    const cleaned = plate.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
    setScannerOpen(false);
    if (!cleaned) {
      setMessage("Could not read the plate - try again or type it in.");
      setTone("error");
      return;
    }
    setPlateInput(cleaned);
    setMessage(`Plate read: ${cleaned}. Confirm the plate, then tap Log arrival.`);
    setTone("ok");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
      <Card>
        <CardHeader title="Log a vehicle" description="Type the plate as it arrives — letters and digits only." />
        <Field label="Gate name"><Input value={gateName} onChange={(event) => setGateName(event.target.value)} /></Field>
        <div className="mt-4">
          <Field label="Plate number">
            <Input
              value={plateInput}
              onChange={(event) => setPlateInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitPlate();
              }}
              placeholder="ABC123DE"
              className="text-center font-mono text-2xl tracking-[0.2em]"
              autoCapitalize="characters"
            />
          </Field>
        </div>
        <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => setScannerOpen(true)} disabled={logging}>
          <Camera className="h-4 w-4" />
          Scan plate with camera
        </Button>
        <Button type="button" className="mt-4 w-full" onClick={() => void submitPlate()} disabled={logging || !plateInput}>
          <Car className="h-4 w-4" />
          {logging ? "Logging..." : "Log arrival"}
        </Button>
        {message ? (
          <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${tone === "ok" ? "border-smart/30 bg-smart/10 text-smart" : "border-danger/30 bg-danger/10 text-danger"}`}>
            {message}
          </p>
        ) : null}
        <PlateScannerPanel
          active={scannerOpen}
          onResult={handleScanResult}
          onClose={() => setScannerOpen(false)}
        />
      </Card>

      <div className="grid gap-4">
        <StatCard
          label="Vehicles arrived"
          value={loading ? "…" : String(arrived)}
          helper={loading ? "Loading" : `of ${plates.length} expected`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <Card>
          <CardHeader title="Expected vehicles" description="Updates automatically." />
          {plates.length === 0 ? (
            <p className="p-2 text-sm text-slate-300">{loading ? "Loading..." : "No VIP plates registered for this event."}</p>
          ) : (
            <div className="grid max-h-96 gap-2 overflow-y-auto">
              {plates.map((plate) => (
                <div key={plate.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-white">{plate.plate}</p>
                    {plate.label ? <p className="truncate text-xs text-slate-400">{plate.label}</p> : null}
                  </div>
                  <StatusBadge status={plate.status} tone={plate.status === "arrived" ? "green" : "yellow"} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          {loading ? "Loading" : "Refresh list"}
        </Button>
      </div>
    </div>
  );
}
