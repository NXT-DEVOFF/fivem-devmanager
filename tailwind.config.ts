import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#080A0F",
        surface: "#0F131B",
        card: "#141A24",
        elevated: "#1A2130",
        border: "#232B39",
        "border-strong": "#33405A",
        fg: "#F8FAFC",
        muted: "#94A3B8",
        primary: {
          DEFAULT: "#5865F2",
          50: "#EEF0FE",
          100: "#DDE1FD",
          300: "#A6AEF9",
          400: "#8189F6",
          500: "#5865F2",
          600: "#4450E0",
          700: "#3742B8",
          800: "#2B348F",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#38BDF8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(88,101,242,0.35), 0 8px 30px -12px rgba(88,101,242,0.55)",
        panel:
          "0 1px 0 0 rgba(255,255,255,0.035) inset, 0 24px 48px -34px rgba(0,0,0,0.95)",
        lift: "0 18px 40px -26px rgba(0,0,0,0.95), 0 1px 0 0 rgba(255,255,255,0.04) inset",
        pop: "0 32px 70px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(51,64,90,0.6)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(34,197,94,0.5)" },
          "70%": { boxShadow: "0 0 0 8px rgba(34,197,94,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(34,197,94,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-ring": "pulse-ring 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
