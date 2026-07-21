"use client";

import { useEffect } from "react";

// The auth screens are designed light-only, but the app's Light/Dark toggle
// persists `data-theme="dark"` on <html>. Without this, signing out of a
// dark-mode dashboard leaves the login page washed out until a manual
// refresh. Style-only — no auth logic here.
export function ForceLightTheme() {
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);

  return null;
}
