"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {
          // Development cleanup is best-effort.
        });

      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch(() => {
            // Cache cleanup is best-effort.
          });
      }

      return;
    }

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) {
        return;
      }

      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const notifyUpdateReady = (worker: ServiceWorker | null | undefined) => {
      if (!worker) {
        return;
      }

      setWaitingWorker(worker);
      setUpdateReady(true);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        notifyUpdateReady(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) {
            return;
          }

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateReady(installingWorker);
            }
          });
        });

        void registration.update();
      })
      .catch(() => {
        // Registration failures are non-blocking. The app remains usable online.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  if (!updateReady) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[10000] flex h-10 items-center justify-center gap-3 bg-[#1a7c4a] px-3 text-sm font-semibold text-white shadow-lg">
      <span>New version available</span>
      <button
        type="button"
        className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/30"
        onClick={() => {
          waitingWorker?.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        }}
      >
        Tap to update
      </button>
    </div>
  );
}
