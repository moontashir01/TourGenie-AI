/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // The palette below switches on this class; `dark:` utilities are
  // available too for the few places a variable can't express the change.
  darkMode: "class",
  theme: {
    extend: {
      // Every colour that changes between light and dark is a CSS variable
      // rather than a hex, so the ~1,300 palette classes already written
      // across the app switch theme without being touched. The channels are
      // bare numbers ("11 31 46") so Tailwind's opacity modifiers — the
      // text-ink-900/60 the app leans on constantly — keep working.
      //
      // src/index.css holds the two value sets, plus `.theme-ink`, which pins
      // a subtree to the light-mode values so surfaces that are *meant* to be
      // dark (the auth screens, the landing hero) don't inverse into light
      // ones when the rest of the app goes dark.
      colors: {
        ink: {
          900: "rgb(var(--tg-ink-900) / <alpha-value>)",
          800: "rgb(var(--tg-ink-800) / <alpha-value>)",
          700: "rgb(var(--tg-ink-700) / <alpha-value>)",
          // Never themed: text sitting on a brand colour (the sunset CTA,
          // the teal brand mark) needs the same dark ink in both themes.
          fixed: "#0B1F2E",
        },
        paper: {
          DEFAULT: "rgb(var(--tg-paper) / <alpha-value>)",
          fixed: "#F7F2E7",
        },
        // Cards and panels — what `bg-white` used to mean.
        surface: "rgb(var(--tg-surface) / <alpha-value>)",
        teal: {
          DEFAULT: "#1C8C82",
          dark: "rgb(var(--tg-teal-dark) / <alpha-value>)",
          light: "rgb(var(--tg-teal-light) / <alpha-value>)",
        },
        sunset: {
          DEFAULT: "#EF8354",
          dark: "rgb(var(--tg-sunset-dark) / <alpha-value>)",
          light: "rgb(var(--tg-sunset-light) / <alpha-value>)",
        },
        gold: "#D9A441",
        sand: "rgb(var(--tg-sand) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(11, 31, 46, 0.04), 0 4px 16px rgba(11, 31, 46, 0.06)",
        lift: "0 6px 16px rgba(11, 31, 46, 0.08), 0 16px 40px rgba(11, 31, 46, 0.10)",
        glow: "0 0 0 1px rgba(239, 131, 84, 0.25), 0 8px 32px rgba(239, 131, 84, 0.18)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "dot-bounce": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "40%": { transform: "translateY(-4px)", opacity: "1" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85) translateY(-4px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
        "dot-bounce": "dot-bounce 1.2s infinite ease-in-out",
        drift: "drift 6s ease-in-out infinite",
        "pop-in": "pop-in 0.16s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
