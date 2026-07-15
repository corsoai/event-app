import type { Config } from "tailwindcss";

const config: Config = {
  // The app has its own Light/Dark toggle (data-theme on <html>). Without this,
  // `dark:` classes followed the phone's system setting and made text invisible
  // when system-dark met app-light.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        panel: "rgb(var(--color-panel) / <alpha-value>)",
        panelSoft: "rgb(var(--color-panel-soft) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        smart: "rgb(var(--color-smart) / <alpha-value>)",
        sky: "rgb(var(--color-sky) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        warn: "rgb(var(--color-warn) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)"
      },
      boxShadow: {
        glow: "0 22px 60px rgba(0, 0, 0, 0.38), 0 1px 0 rgba(213,213,213,0.12) inset"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
