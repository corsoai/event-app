"use client";

import { useEffect } from "react";

export function AppWarmup() {
  useEffect(() => {
    const controller = new AbortController();

    void fetch(`/api/ping?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache"
      },
      signal: controller.signal
    }).catch(() => {
      // Warmup is best-effort and must never block the UI.
    });

    return () => controller.abort();
  }, []);

  return null;
}
