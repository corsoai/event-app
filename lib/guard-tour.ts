import type { GuardCheckpoint, GuardPatrolEvent } from "@/lib/types";

const pendingTourLogsKey = "pendingTourLogs";
const requestTimeoutMs = 12000;

export type GuardTourScanResult = {
  ok: boolean;
  offline?: boolean;
  message: string;
  checkpoint?: GuardCheckpoint;
  patrol?: GuardPatrolEvent;
  distanceMeters?: number;
  isGpsVerified?: boolean;
};

type PendingTourLog = {
  qrToken: string;
  guardId: string;
  guardName: string;
  scannedAt: string;
  deviceLatitude?: number;
  deviceLongitude?: number;
  deviceAccuracy?: number;
  isOfflineLog: boolean;
  deviceLabel: string;
};

export async function submitGuardCheckpointScan(rawValue: string): Promise<GuardTourScanResult> {
  const qrToken = normalizeCheckpointToken(rawValue);
  if (!qrToken) {
    return { ok: false, message: "Checkpoint QR token is empty." };
  }

  const position = await readCurrentPosition();
  const guard = readCurrentGuard();
  const pendingPayload: PendingTourLog = {
    qrToken,
    guardId: guard.guardId,
    guardName: guard.guardName,
    scannedAt: new Date().toISOString(),
    deviceLatitude: position.latitude,
    deviceLongitude: position.longitude,
    deviceAccuracy: position.accuracy,
    isOfflineLog: true,
    deviceLabel: navigator.userAgent ? "Mobile guard device" : "Guard device"
  };

  if (!navigator.onLine) {
    cachePendingTourLog(pendingPayload);
    return {
      ok: true,
      offline: true,
      message: "Saved Offline - Will sync automatically"
    };
  }

  try {
    const checkpoint = await fetchCheckpoint(qrToken);
    const distanceMeters = checkpoint && position.latitude !== undefined && position.longitude !== undefined && checkpoint.latitude !== undefined && checkpoint.longitude !== undefined
      ? haversineMeters(position.latitude, position.longitude, checkpoint.latitude, checkpoint.longitude)
      : undefined;
    const isGpsVerified = distanceMeters !== undefined && distanceMeters <= checkpoint.allowedRadius;
    const patrol = await postPatrolLog({
      ...pendingPayload,
      isOfflineLog: false
    });
    const savedGpsVerified = patrol.isGpsVerified === true;

    return {
      ok: savedGpsVerified,
      checkpoint,
      patrol,
      distanceMeters,
      isGpsVerified,
      message: savedGpsVerified
        ? `${checkpoint.checkpointName} verified. Distance ${distanceMeters ?? 0}m.`
        : `${checkpoint.checkpointName} saved with GPS warning. CSO can review it.`
    };
  } catch (error) {
    cachePendingTourLog(pendingPayload);
    return {
      ok: true,
      offline: true,
      message: "Saved Offline - Will sync automatically"
    };
  }
}

export function installGuardTourSync() {
  if (typeof window === "undefined") {
    return () => {};
  }

  const sync = () => {
    void syncPendingTourLogs();
  };

  window.addEventListener("online", sync);
  document.addEventListener("visibilitychange", syncWhenVisible);
  void syncPendingTourLogs();

  return () => {
    window.removeEventListener("online", sync);
    document.removeEventListener("visibilitychange", syncWhenVisible);
  };
}

export async function syncPendingTourLogs() {
  const pending = readPendingTourLogs();
  if (!pending.length || !navigator.onLine) {
    return { synced: 0, remaining: pending.length };
  }

  const remaining: PendingTourLog[] = [];
  let synced = 0;

  for (const log of pending) {
    try {
      await postPatrolLog(log);
      synced += 1;
    } catch {
      remaining.push(log);
    }
  }

  writePendingTourLogs(remaining);
  return { synced, remaining: remaining.length };
}

export function isGuardCheckpointQr(value: string) {
  return value.trim().toUpperCase().startsWith("CP_");
}

export function normalizeCheckpointToken(value: string) {
  return value.trim().replace(/^CP_/i, "").trim();
}

export function haversineMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const startLatitude = toRadians(latitudeA);
  const endLatitude = toRadians(latitudeB);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function fetchCheckpoint(qrToken: string) {
  const response = await fetchWithTimeout(`/api/appwrite/security/checkpoints?qrToken=${encodeURIComponent(qrToken)}`, {
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as { checkpoints?: GuardCheckpoint[]; error?: string } | null;
  const checkpoint = payload?.checkpoints?.[0];

  if (!response.ok || !checkpoint) {
    throw new Error(payload?.error ?? "Checkpoint was not found.");
  }

  return checkpoint;
}

async function postPatrolLog(payload: PendingTourLog) {
  const response = await fetchWithTimeout("/api/appwrite/security/patrols", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null) as { patrol?: GuardPatrolEvent; error?: string } | null;

  if (!response.ok || !result?.patrol) {
    throw new Error(result?.error ?? "Patrol log could not be saved.");
  }

  return result.patrol;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export type GpsReadiness = {
  ready: boolean;
  accuracy?: number;
  reason?: "denied" | "timeout" | "unavailable" | "unsupported";
};

/**
 * Warms up the GPS chip and reports whether this device can share its
 * location. Call on page open so the browser permission prompt appears
 * before the guard scans, and the fix is already warm at scan time.
 */
export async function checkGpsReadiness(): Promise<GpsReadiness> {
  const position = await readCurrentPosition();
  if (position.latitude !== undefined && position.longitude !== undefined) {
    return { ready: true, accuracy: position.accuracy };
  }
  return { ready: false, reason: position.error ?? "unavailable" };
}

async function readCurrentPosition() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { error: "unsupported" as const };
  }

  return new Promise<{
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    error?: "denied" | "timeout" | "unavailable" | "unsupported";
  }>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : undefined
      }),
      (error) => resolve({
        error: error.code === error.PERMISSION_DENIED
          ? "denied"
          : error.code === error.TIMEOUT
            ? "timeout"
            : "unavailable"
      }),
      {
        // 20s tolerates cold GPS starts under a roof; a fix from the last 20s
        // (e.g. the page-open warm-up) is accepted so scans stay fast.
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 20000
      }
    );
  });
}

function syncWhenVisible() {
  if (document.visibilityState === "visible") {
    void syncPendingTourLogs();
  }
}

function cachePendingTourLog(log: PendingTourLog) {
  const pending = readPendingTourLogs();
  pending.push(log);
  writePendingTourLogs(pending);
}

function readPendingTourLogs(): PendingTourLog[] {
  try {
    const rawValue = localStorage.getItem(pendingTourLogsKey);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingTourLogs(logs: PendingTourLog[]) {
  if (!logs.length) {
    localStorage.removeItem(pendingTourLogsKey);
    return;
  }

  localStorage.setItem(pendingTourLogsKey, JSON.stringify(logs));
}

function readCurrentGuard() {
  try {
    const rawUser = localStorage.getItem("corso_user");
    const user = rawUser ? JSON.parse(rawUser) as { id?: string; name?: string; email?: string } : null;
    return {
      guardId: user?.id || user?.email || "local-guard",
      guardName: user?.name || "Security Guard"
    };
  } catch {
    return {
      guardId: "local-guard",
      guardName: "Security Guard"
    };
  }
}
