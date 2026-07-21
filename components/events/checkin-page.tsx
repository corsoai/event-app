"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, QrCode, RefreshCw, Users, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import type { EventRecord, Guest } from "@/lib/types";
import {
  checkInAppwriteGuestByCode,
  readAppwriteEventGuests,
  readAppwriteGateEvents
} from "@/lib/appwrite/browser-data";

const LIVE_REFRESH_MS = 8000;

export function CheckInPage() {
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
      <PageHeader title="Guest check-in" description="Pick an event, then scan or type each guest's code at the gate." />

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
          {selectedEventId ? <EventCheckIn eventId={selectedEventId} /> : null}
        </>
      )}
    </>
  );
}

function EventCheckIn({ eventId }: { eventId: string }) {
  const [code, setCode] = useState("");
  const [gateName, setGateName] = useState("Main gate");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "error">("ok");
  const [checking, setChecking] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  async function refreshGuests(silent = false) {
    if (!silent) setLoadingGuests(true);
    try {
      setGuests(await readAppwriteEventGuests(eventId));
    } catch {
      // Non-fatal — the counter just won't update; check-in itself still works.
    } finally {
      if (!silent) setLoadingGuests(false);
    }
  }

  useEffect(() => {
    void refreshGuests();
    const interval = window.setInterval(() => void refreshGuests(true), LIVE_REFRESH_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const checkedInCount = guests.filter((guest) => guest.status === "checked-in").length;

  async function submitCode(rawCode: string) {
    const targetCode = rawCode.replace(/\D/g, "").slice(0, 6);
    setCode(targetCode);
    if (targetCode.length !== 6) {
      setMessage("Enter the full 6-digit guest code.");
      setTone("error");
      return;
    }

    setChecking(true);
    setMessage("Checking guest in...");
    setTone("ok");
    try {
      const guest = await checkInAppwriteGuestByCode(eventId, targetCode, gateName);
      setMessage(`${guest.fullName} checked in — ${guest.category} guest.`);
      setTone("ok");
      setCode("");
      void refreshGuests(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Guest code could not be verified online.");
      setTone("error");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
      <Card>
        <CardHeader title="Scan or type code" description="Scan the QR on the guest's pass with the camera, or type their 6-digit code." />
        {scannerOpen ? (
          <QrCodeScanner
            onDetected={(value) => {
              setScannerOpen(false);
              void submitCode(value);
            }}
            onClose={() => setScannerOpen(false)}
          />
        ) : (
          <Button type="button" variant="secondary" className="w-full" onClick={() => setScannerOpen(true)}>
            <Camera className="h-4 w-4" />
            Scan QR with camera
          </Button>
        )}
        <div className="mt-4">
          <Field label="Gate name"><Input value={gateName} onChange={(event) => setGateName(event.target.value)} /></Field>
        </div>
        <div className="mt-4">
          <Field label="Guest code">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitCode(code);
              }}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="text-center font-mono text-2xl tracking-[0.3em]"
            />
          </Field>
        </div>
        <Button type="button" className="mt-4 w-full" onClick={() => void submitCode(code)} disabled={checking || code.length !== 6}>
          <QrCode className="h-4 w-4" />
          {checking ? "Checking in..." : "Check in"}
        </Button>
        {message ? (
          <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${tone === "ok" ? "border-smart/30 bg-smart/10 text-smart" : "border-danger/30 bg-danger/10 text-danger"}`}>
            {message}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4">
        <StatCard
          label="Checked in"
          value={loadingGuests ? "…" : String(checkedInCount)}
          helper={loadingGuests ? "Loading" : `of ${guests.length} total guests`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Still expected"
          value={loadingGuests ? "…" : String(Math.max(0, guests.length - checkedInCount))}
          helper="Not yet arrived"
          icon={<Users className="h-5 w-5" />}
        />
        <Button type="button" variant="secondary" onClick={() => void refreshGuests()} disabled={loadingGuests}>
          <RefreshCw className="h-4 w-4" />
          {loadingGuests ? "Loading" : "Refresh count"}
        </Button>
      </div>
    </div>
  );
}

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function QrCodeScanner({ onDetected, onClose }: { onDetected: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scannerError, setScannerError] = useState("");

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let intervalId: number | null = null;

    async function start() {
      const DetectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!DetectorCtor) {
        setScannerError("Camera scanning isn't supported in this browser — type the code below instead.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError("Camera access isn't available here — type the code below instead.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
      } catch {
        setScannerError("Camera permission was denied — type the code below instead.");
        return;
      }

      if (!active || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        // Autoplay hiccups are non-fatal; detection below still retries.
      }

      const detector = new DetectorCtor({ formats: ["qr_code"] });
      intervalId = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const results = await detector.detect(video);
          const raw = results[0]?.rawValue ?? "";
          const digits = raw.replace(/\D/g, "").slice(0, 6);
          if (digits.length === 6 && active) {
            if (intervalId !== null) window.clearInterval(intervalId);
            intervalId = null;
            onDetected(digits);
          }
        } catch {
          // Ignore detection errors and keep trying.
        }
      }, 350);
    }

    void start();

    return () => {
      active = false;
      if (intervalId !== null) window.clearInterval(intervalId);
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="relative bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} playsInline muted className="mx-auto aspect-square w-full max-w-sm object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-40 w-40 rounded-2xl border-2 border-smart/80" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
          aria-label="Close camera"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="px-3 py-2 text-center text-xs text-slate-300">
        {scannerError || "Point the camera at the guest's QR pass."}
      </p>
    </div>
  );
}
