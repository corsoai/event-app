import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#000000",
        panel: "#0A0A0A",
        panelSoft: "#656565",
        line: "#656565",
        smart: "#C0FF6B",
        sky: "#D5D5D5",
        gold: "#C0FF6B",
        warn: "#D5D5D5",
        danger: "#FF3B30"
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
