"use client";

import { useEffect, useState } from "react";

const STALE_ASSET_RELOAD_KEY = "corso-stale-asset-reload";

function isStaleAssetError(value: unknown) {
  const message = value instanceof Error
    ? `${value.name} ${value.message}`
    : typeof value === "string"
      ? value
      : value && typeof value === "object" && "message" in value
        ? String((value as { message?: unknown }).message ?? "")
        : "";

  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("/_next/static/chunks/") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

async function clearRuntimeCaches() {
  if ("caches" in window) {
    await caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined);
  }

  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => undefined);
  }
}

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const clearReloadGuard = window.setTimeout(() => {
      sessionStorage.removeItem(STALE_ASSET_RELOAD_KEY);
    }, 10_000);

    const recoverFromStaleAssets = () => {
      if (sessionStorage.getItem(STALE_ASSET_RELOAD_KEY) === "1") {
        return;
      }

      sessionStorage.setItem(STALE_ASSET_RELOAD_KEY, "1");
      void clearRuntimeCaches().finally(() => {
        window.location.reload();
      });
    };

    const handleError = (event: ErrorEvent) => {
      if (isStaleAssetError(event.error) || isStaleAssetError(event.message) || isStaleAssetError(event.filename)) {
        event.preventDefault();
        recoverFromStaleAssets();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isStaleAssetError(event.reason)) {
        event.preventDefault();
        recoverFromStaleAssets();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.clearTimeout(clearReloadGuard);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

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
