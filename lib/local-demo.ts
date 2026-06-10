"use client";

export function isLocalDemoEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.toLowerCase();
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  return isLocalHost && process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO === "true";
}
