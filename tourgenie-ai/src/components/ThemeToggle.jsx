import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// One click, two states. The three-way choice (including "follow my system")
// lives on the settings page; a toggle in the chrome should do the obvious
// thing, which is give you the opposite of what you're looking at.
//
// `tone="ink"` is for the dark-by-design surfaces — the public navbar — where
// the themed palette is pinned and the light-mode colours would vanish.
export default function ThemeToggle({ tone = "app", className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  const tones = {
    app: "bg-surface/70 border-sand text-ink-900/60 hover:text-ink-900 hover:border-teal/50",
    ink: "bg-ink-800/60 border-ink-700 text-paper/70 hover:text-paper hover:border-teal/50",
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      aria-pressed={isDark}
      className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${tones[tone]} ${className}`}
    >
      {/* Both icons are mounted and cross-faded — swapping them outright
          makes the button flicker on every press. */}
      <span className="relative w-4 h-4">
        <Sun
          className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${
            isDark ? "opacity-0 -rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
          }`}
          strokeWidth={1.75}
        />
        <Moon
          className={`absolute inset-0 w-4 h-4 transition-all duration-200 ${
            isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-75"
          }`}
          strokeWidth={1.75}
        />
      </span>
    </button>
  );
}
