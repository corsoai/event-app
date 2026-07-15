"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellOff, Siren } from "lucide-react";
import type { SecurityIncident } from "@/lib/types";

const POLL_INTERVAL_MS = 20000;
const SILENCED_KEY = "corso_sos_silenced";

function isActiveSosStatus(status: SecurityIncident["status"]) {
  return status === "open" || status === "acknowledged" || status === "responding";
}

function readSilencedIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SILENCED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeSilencedIds(ids: string[]) {
  try {
    localStorage.setItem(SILENCED_KEY, JSON.stringify(ids.slice(-100)));
  } catch {
    // storage unavailable — alarm still works for this session
  }
}

function sosTimeLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos"
  }).format(date);
}

/**
 * Watches for active SOS incidents while a security user is logged in.
 * Plays a continuous siren (Web Audio) + vibration until the guard taps
 * "Silence". New incidents re-trigger the alarm even after silencing.
 */
export function SosAlarmWatcher() {
  const [alarmIncidents, setAlarmIncidents] = useState<SecurityIncident[]>([]);
  const [activeIncidents, setActiveIncidents] = useState<SecurityIncident[]>([]);
  const [needsTap, setNeedsTap] = useState(false);
  const audioRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode; sweep: number } | null>(null);
  const vibrateRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const response = await fetch("/api/appwrite/admin/sos", { cache: "no-store" });
        const payload = await response.json().catch(() => null) as { incidents?: SecurityIncident[] } | null;
        if (!mounted || !response.ok) return;
        const active = (payload?.incidents ?? [])
          .filter((incident) => isActiveSosStatus(incident.status))
          .sort((left, right) => String(left.openedAt ?? "").localeCompare(String(right.openedAt ?? "")));
        const silenced = new Set(readSilencedIds());
        setActiveIncidents(active);
        setAlarmIncidents(active.filter((incident) => !silenced.has(incident.id)));
      } catch {
        // network hiccup — keep last known state
      }
    }

    void poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (alarmIncidents.length) {
      startAlarm();
    } else {
      stopAlarm();
    }
    return stopAlarm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alarmIncidents.length > 0]);

  function startAlarm() {
    startVibration();
    if (audioRef.current) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 650;
      gain.gain.value = 0.18;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      let high = false;
      const sweep = window.setInterval(() => {
        high = !high;
        osc.frequency.setValueAtTime(high ? 950 : 650, ctx.currentTime);
      }, 450);
      audioRef.current = { ctx, osc, gain, sweep };

      if (ctx.state === "suspended") {
        setNeedsTap(true);
        const resume = () => {
          void ctx.resume().then(() => setNeedsTap(false));
          window.removeEventListener("pointerdown", resume);
        };
        window.addEventListener("pointerdown", resume);
      }
    } catch {
      setNeedsTap(true);
    }
  }

  function stopAlarm() {
    const audio = audioRef.current;
    if (audio) {
      window.clearInterval(audio.sweep);
      try {
        audio.osc.stop();
        void audio.ctx.close();
      } catch {
        // already closed
      }
      audioRef.current = null;
    }
    if (vibrateRef.current) {
      window.clearInterval(vibrateRef.current);
      vibrateRef.current = null;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(0);
    }
    setNeedsTap(false);
  }

  function startVibration() {
    if (vibrateRef.current || typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate([400, 200, 400]);
    vibrateRef.current = window.setInterval(() => navigator.vibrate([400, 200, 400]), 1400);
  }

  function silenceAlarm() {
    const silenced = new Set(readSilencedIds());
    for (const incident of activeIncidents) silenced.add(incident.id);
    writeSilencedIds([...silenced]);
    setAlarmIncidents([]);
    stopAlarm();
  }

  if (!activeIncidents.length) return null;

  const newest = activeIncidents[activeIncidents.length - 1];
  const sounding = alarmIncidents.length > 0;

  return (
    <div className="fixed inset-x-3 bottom-24 z-50 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96">
      <div className={`rounded-2xl border p-4 shadow-2xl backdrop-blur ${sounding ? "animate-pulse border-red-500 bg-red-600/95" : "border-red-500/50 bg-red-950/90"}`}>
        <div className="flex items-start gap-3">
          <Siren className="mt-0.5 h-6 w-6 shrink-0 text-[#fff]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold uppercase tracking-wide text-[#fff]">
              Panic alert{activeIncidents.length > 1 ? ` (${activeIncidents.length} active)` : ""}
            </p>
            <p className="mt-1 truncate text-sm text-red-100">
              {newest.residentName || "Resident"}{newest.unitCode ? ` · ${newest.unitCode}` : ""}{newest.openedAt ? ` · ${sosTimeLabel(newest.openedAt)}` : ""}
            </p>
            {needsTap && sounding ? (
              <p className="mt-1 text-xs font-semibold text-amber-200">Tap anywhere to enable the siren sound.</p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href="/security/sos-alerts"
            className="flex-1 rounded-lg bg-[#fff] px-3 py-2.5 text-center text-sm font-bold text-red-700"
          >
            View alerts
          </Link>
          {sounding ? (
            <button
              type="button"
              onClick={silenceAlarm}
              className="flex-1 rounded-lg border border-white/50 px-3 py-2.5 text-sm font-semibold text-[#fff]"
            >
              <span className="inline-flex items-center gap-1.5"><BellOff className="h-4 w-4" />Silence</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
