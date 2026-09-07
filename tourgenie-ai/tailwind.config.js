/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  // Wraps every `hover:` utility in `@media (hover: hover)`. Without it a tap
  // on a phone leaves the hover state stuck on the card or button until you
  // tap something else — the lift, the shadow and the colour change all stay
  // behind, which reads as "this is selected" when nothing is. Applies to the
  // ~1,000 hover: classes already written, not just new ones.
  future: {
    hoverOnlyWhenSupported: true,
  },
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
          // The two muted steps. They exist so secondary and meta text stop
          // being ink-900 at an opacity — see the note in src/index.css.
          600: "rgb(var(--tg-ink-600) / <alpha-value>)",
          500: "rgb(var(--tg-ink-500) / <alpha-value>)",
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
      // The three steps below Tailwind's `xs` (12px). They existed already —
      // as 134 arbitrary text-[9px]/[10px]/[11px] values scattered through the
      // pages, which is how a badge ends up 10px in one grid and 11px in the
      // next for no reason. Named, they're a ladder someone can pick from.
      //
      // Deliberately font-size only, no paired line-height: the arbitrary
      // values they replace didn't set one either, and adding it here would
      // re-flow every chip in the app under cover of a rename.
      fontSize: {
        "2xs": "0.6875rem", // 11px — the small-print default
        "3xs": "0.625rem", // 10px — chips and meta
        "4xs": "0.5625rem", // 9px — uppercase status pills only
        // The other end of the ladder, which the app didn't have: over 85% of
        // its type sat at 14px or below, so no page had an entry point for
        // the eye and every screen read as an administrative form regardless
        // of how good the palette was. Clamp-based, so a headline scales with
        // the viewport instead of needing three responsive variants at every
        // call site.
        //
        // The negative tracking isn't decoration. Fraunces set at default
        // tracking above ~32px reads as loose and unfinished, and the bigger
        // the step the harder it has to come in.
        "display-sm": ["clamp(1.5rem, 1.2rem + 1.2vw, 2rem)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-md": ["clamp(2rem, 1.5rem + 2.2vw, 3rem)", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2.75rem, 1.8rem + 4vw, 4.5rem)", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
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
      // Durations and easings come from the --tg-dur-*/--tg-ease-* variables in
      // src/index.css rather than being spelled out here, so the whole app's
      // timing is one edit and the reduced-motion guard has a single place to
      // flatten. Only the looping, decorative animations (dot-bounce, drift,
      // pulse-ring, shake) keep their own durations — those are character, not
      // interface timing, and reading them off the transition scale would be
      // meaningless.
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        // Modal/palette pair. Scale from 0.96 rather than something smaller —
        // a big scale on a full-width dialog reads as a zoom, not an arrival.
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-out": {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.96)" },
        },
        // Popovers and dropdowns hanging off a trigger above them.
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Side drawer. Hard-coded to the right edge: under RTL the drawer
        // itself has to flip side, and a transform can't express that — the
        // component picks the direction, these only describe it.
        "drawer-in": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "drawer-out": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        // Mirror pair, for the panels that live on the left — the mobile
        // navigation, and eventually the side drawer under RTL.
        "drawer-left-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "drawer-left-out": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        // Bottom sheet — the mobile form of every drawer and modal.
        "sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "sheet-out": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        // Draws a tick on. Needs stroke-dasharray: 24 on the path, which the
        // .check-path utility in index.css sets.
        "check-draw": {
          from: { strokeDashoffset: "24" },
          to: { strokeDashoffset: "0" },
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
        // A count arriving on the notification bell.
        shake: {
          "0%, 100%": { transform: "rotate(0)" },
          "20%": { transform: "rotate(-9deg)" },
          "40%": { transform: "rotate(7deg)" },
          "60%": { transform: "rotate(-5deg)" },
          "80%": { transform: "rotate(3deg)" },
        },
        // Expanding halo for "this is the step running right now". Spread
        // rather than scale, so it doesn't disturb the element's layout box.
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(239, 131, 84, 0.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(239, 131, 84, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(239, 131, 84, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up var(--tg-dur-slow) var(--tg-ease-out) both",
        "fade-in": "fade-in var(--tg-dur-base) var(--tg-ease-out) both",
        // Exits run at the fast step. Waiting on a dialog you've already
        // dismissed is the one place motion reads as lag.
        "fade-out": "fade-out var(--tg-dur-fast) var(--tg-ease-out) both",
        "scale-in": "scale-in var(--tg-dur-base) var(--tg-ease-out) both",
        "scale-out": "scale-out var(--tg-dur-fast) var(--tg-ease-out) both",
        "slide-down": "slide-down var(--tg-dur-base) var(--tg-ease-out) both",
        "drawer-in": "drawer-in var(--tg-dur-base) var(--tg-ease-out) both",
        "drawer-out": "drawer-out var(--tg-dur-fast) var(--tg-ease-in-out) both",
        "drawer-left-in": "drawer-left-in var(--tg-dur-base) var(--tg-ease-out) both",
        "drawer-left-out": "drawer-left-out var(--tg-dur-fast) var(--tg-ease-in-out) both",
        "sheet-in": "sheet-in var(--tg-dur-base) var(--tg-ease-out) both",
        "sheet-out": "sheet-out var(--tg-dur-fast) var(--tg-ease-in-out) both",
        "check-draw": "check-draw var(--tg-dur-base) var(--tg-ease-out) both",
        "dot-bounce": "dot-bounce 1.2s infinite ease-in-out",
        drift: "drift 6s ease-in-out infinite",
        "pop-in": "pop-in var(--tg-dur-fast) var(--tg-ease-out) both",
        shake: "shake 0.5s var(--tg-ease-in-out)",
        "pulse-ring": "pulse-ring 1.8s var(--tg-ease-out) infinite",
      },
      // Lets hand-written `transition-*` markup reach the same scale as the
      // keyframes above: `duration-base ease-tg-out`.
      transitionDuration: {
        fast: "var(--tg-dur-fast)",
        base: "var(--tg-dur-base)",
        slow: "var(--tg-dur-slow)",
      },
      transitionTimingFunction: {
        "tg-out": "var(--tg-ease-out)",
        "tg-in-out": "var(--tg-ease-in-out)",
      },
    },
  },
  plugins: [],
};
