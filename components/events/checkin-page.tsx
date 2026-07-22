"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, QrCode, RefreshCw, Search, Users, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/pages";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import type { EventRecord, Guest } from "@/lib/types";
import {
  checkInAppwriteGuestByCode,
  readAppwriteEventGuests,
  readAppwriteGateEvents
} from "@/lib/appwrite/browser-data";
import { cachePendingCheckin, installGateCheckinSync, readPendingCheckins } from "@/lib/gate-offline";

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
  const [tone, setTone] = useState<"ok" | "error" | "offline">("ok");
  const [checking, setChecking] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [guestQuery, setGuestQuery] = useState("");

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

  useEffect(() => {
    setPendingCount(readPendingCheckins().length);
    const uninstall = installGateCheckinSync((result) => {
      setPendingCount(result.remaining);
      const parts = [];
      if (result.synced) parts.push(`${result.synced} offline scan${result.synced === 1 ? "" : "s"} synced`);
      if (result.duplicates) parts.push(`${result.duplicates} already checked in elsewhere`);
      if (result.rejected) parts.push(`${result.rejected} rejected`);
      if (parts.length) {
        setMessage(`${parts.join(", ")}.`);
        setTone("ok");
      }
      void refreshGuests(true);
    });
    return uninstall;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkedInCount = guests.filter((guest) => guest.status === "checked-in").length;
  const trimmedQuery = guestQuery.trim().toLowerCase();
  const matchedGuests = trimmedQuery.length >= 2
    ? guests.filter((guest) => guest.fullName.toLowerCase().includes(trimmedQuery)).slice(0, 8)
    : [];

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
      // Rule 6B: a scan that can't reach the server is queued locally and
      // synced automatically when connectivity returns.
      const isNetworkFailure = err instanceof TypeError || !navigator.onLine;
      if (isNetworkFailure) {
        const queued = cachePendingCheckin({
          eventId,
          code: targetCode,
          gateName: gateName.trim() || "Main gate",
          capturedAt: new Date().toISOString()
        });
        setPendingCount(queued);
        setMessage(`Saved offline — will sync automatically. ${queued} scan${queued === 1 ? "" : "s"} waiting.`);
        setTone("offline");
        setCode("");
      } else {
        setMessage(err instanceof Error ? err.message : "Guest code could not be verified online.");
        setTone("error");
      }
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
          <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${tone === "ok" ? "border-smart/30 bg-smart/10 text-smart" : tone === "offline" ? "border-gold/40 bg-gold/10 text-gold" : "border-danger/30 bg-danger/10 text-danger"}`}>
            {message}
          </p>
        ) : null}
        {pendingCount > 0 ? (
          <p className="mt-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
            {pendingCount} offline scan{pendingCount === 1 ? "" : "s"} waiting to sync — they upload automatically when the network returns.
          </p>
        ) : null}

        <div className="mt-6 border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium text-white">Lost code? Find the guest by name</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={guestQuery}
              onChange={(event) => setGuestQuery(event.target.value)}
              placeholder="Type at least 2 letters of the name..."
              className="pl-9"
            />
          </div>
          {trimmedQuery.length >= 2 ? (
            matchedGuests.length ? (
              <div className="mt-3 grid gap-2">
                {matchedGuests.map((guest) => (
                  <div key={guest.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{guest.fullName}</p>
                      <p className="mt-0.5 text-xs capitalize text-slate-400">{guest.category} guest</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={guest.status} />
                      {guest.status === "invited" ? (
                        <Button
                          type="button"
                          onClick={() => {
                            setGuestQuery("");
                            void submitCode(guest.code);
                          }}
                          disabled={checking}
                        >
                          Check in
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No guest name matches &quot;{guestQuery.trim()}&quot;.</p>
            )
          ) : null}
        </div>
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

    function handleDigits(raw: string) {
      const digits = raw.replace(/\D/g, "").slice(0, 6);
      if (digits.length === 6 && active) {
        if (intervalId !== null) window.clearInterval(intervalId);
        intervalId = null;
        onDetected(digits);
        return true;
      }
      return false;
    }

    async function start() {
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

      const DetectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (DetectorCtor) {
        // Fast path: native BarcodeDetector (Chrome/Android).
        const detector = new DetectorCtor({ formats: ["qr_code"] });
        intervalId = window.setInterval(async () => {
          const video = videoRef.current;
          if (!video || video.readyState < 2) return;
          try {
            const results = await detector.detect(video);
            handleDigits(results[0]?.rawValue ?? "");
          } catch {
            // Ignore detection errors and keep trying.
          }
        }, 350);
        return;
      }

      // Fallback path (iPhone Safari and other non-Chromium browsers): decode
      // frames on a canvas with the jsqr package (Stanley-approved dependency).
      // Dynamic import so the decoder only downloads when actually needed.
      let decodeQr: ((data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }) => { data: string } | null) | null = null;
      try {
        const module = await import("jsqr");
        decodeQr = module.default;
      } catch {
        setScannerError("The QR decoder could not load — type the code below instead.");
        return;
      }

      const canvas = document.createElement("canvas");
      const canvasContext = canvas.getContext("2d", { willReadFrequently: true });
      if (!canvasContext) {
        setScannerError("Camera scanning isn't supported in this browser — type the code below instead.");
        return;
      }

      const MAX_SCAN_SIZE = 480;
      intervalId = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !video.videoWidth || !decodeQr) return;
        try {
          const scale = Math.min(1, MAX_SCAN_SIZE / Math.max(video.videoWidth, video.videoHeight));
          const width = Math.max(1, Math.round(video.videoWidth * scale));
          const height = Math.max(1, Math.round(video.videoHeight * scale));
          canvas.width = width;
          canvas.height = height;
          canvasContext.drawImage(video, 0, 0, width, height);
          const imageData = canvasContext.getImageData(0, 0, width, height);
          const result = decodeQr(imageData.data, width, height, { inversionAttempts: "dontInvert" });
          if (result?.data) handleDigits(result.data);
        } catch {
          // Ignore decode errors and keep trying.
        }
      }, 450);
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
