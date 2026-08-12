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
    },
  },
  plugins: [],
};
