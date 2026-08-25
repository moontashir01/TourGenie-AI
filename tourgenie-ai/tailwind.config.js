/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0B1F2E",
          800: "#123244",
          700: "#1A4358",
        },
        paper: "#F7F2E7",
        teal: {
          DEFAULT: "#1C8C82",
          dark: "#146560",
          light: "#DCEFEC",
        },
        sunset: {
          DEFAULT: "#EF8354",
          dark: "#D96B3B",
          light: "#FCE3D3",
        },
        gold: "#D9A441",
        sand: "#E4D9C4",
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
