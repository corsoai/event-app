import { checkInAppwriteGuestByCode } from "@/lib/appwrite/browser-data";

/**
 * Offline queue for gate check-in scans (architecture rule 6B).
 * Mirrors the lib/guard-tour.ts patrol queue pattern exactly: a localStorage
 * queue, flushed on `online`/`visibilitychange`, batch-POSTing to our own
 * API route when connectivity returns. No new storage libraries.
 */

const pendingCheckinsKey = "corsvent_pending_checkins";

export type PendingCheckin = {
  eventId: string;
  code: string;
  gateName: string;
  capturedAt: string;
};

export type CheckinSyncResult = {
  synced: number;
  duplicates: number;
  rejected: number;
  remaining: number;
};

export function cachePendingCheckin(entry: PendingCheckin) {
  const pending = readPendingCheckins();
  pending.push(entry);
  writePendingCheckins(pending);
  return pending.length;
}

export function readPendingCheckins(): PendingCheckin[] {
  try {
    const rawValue = localStorage.getItem(pendingCheckinsKey);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingCheckins(entries: PendingCheckin[]) {
  if (!entries.length) {
    localStorage.removeItem(pendingCheckinsKey);
    return;
  }

  localStorage.setItem(pendingCheckinsKey, JSON.stringify(entries));
}

/**
 * Server answers that mean "retrying will never succeed" — the entry leaves
 * the queue instead of retrying forever. "already checked in" counts as a
 * duplicate (the guest arrived; another gate got them first).
 */
function isPermanentRejection(message: string) {
  return message.includes("No guest found")
    || message.includes("cancelled")
    || message.includes("valid 6-digit")
    || message.includes("cannot")
    || message.includes("Only ");
}

export async function syncPendingCheckins(): Promise<CheckinSyncResult> {
  const pending = readPendingCheckins();
  if (!pending.length || !navigator.onLine) {
    return { synced: 0, duplicates: 0, rejected: 0, remaining: pending.length };
  }

  const remaining: PendingCheckin[] = [];
  let synced = 0;
  let duplicates = 0;
  let rejected = 0;

  for (const entry of pending) {
    try {
      await checkInAppwriteGuestByCode(entry.eventId, entry.code, entry.gateName, entry.capturedAt);
      synced += 1;
    } catch (error) {
      if (error instanceof TypeError) {
        // Network-level failure — still offline, keep for the next flush.
        remaining.push(entry);
        continue;
      }
      const message = error instanceof Error ? error.message : "";
      if (message.includes("already checked in")) {
        duplicates += 1;
      } else if (isPermanentRejection(message)) {
        rejected += 1;
      } else {
        remaining.push(entry);
      }
    }
  }

  writePendingCheckins(remaining);
  return { synced, duplicates, rejected, remaining: remaining.length };
}

export function installGateCheckinSync(onSync: (result: CheckinSyncResult) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let disposed = false;

  const sync = () => {
    void syncPendingCheckins().then((result) => {
      if (!disposed && (result.synced || result.duplicates || result.rejected)) {
        onSync(result);
      }
    });
  };

  const syncWhenVisible = () => {
    if (document.visibilityState === "visible") {
      sync();
    }
  };

  window.addEventListener("online", sync);
  document.addEventListener("visibilitychange", syncWhenVisible);
  sync();

  return () => {
    disposed = true;
    window.removeEventListener("online", sync);
    document.removeEventListener("visibilitychange", syncWhenVisible);
  };
}
