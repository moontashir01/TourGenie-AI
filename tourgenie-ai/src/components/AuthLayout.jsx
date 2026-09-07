import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import RouteLine from "./RouteLine";

// The shell behind Log in, Register and Forgot password. The three screens
// were the same forty lines of markup three times over, each with its own
// decorative circle in a different corner and its own copy of the brand link.
//
// Splitting it also does the one thing a centred card can't: it makes the
// product's promise to somebody who has no account yet and therefore no other
// way to see what this is.
//
// The left half is hidden below lg rather than stacked above the form. On a
// phone the form is the entire job, and a brand panel in front of it is a
// screenful of scrolling between the visitor and the password field.
export default function AuthLayout({ headline, sub, children }) {
  return (
    <div className="theme-ink min-h-screen bg-ink-900 lg:grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-ink-glow border-r border-ink-700 p-12 relative overflow-hidden">
        <svg
          className="absolute -bottom-24 -left-24 w-[28rem] h-[28rem] opacity-20"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="90" fill="none" stroke="#1C8C82" strokeWidth="1" strokeDasharray="1 8" />
        </svg>

        <Link to="/" className="flex items-center gap-2 relative z-10 w-fit">
          <Compass className="w-7 h-7 text-sunset" strokeWidth={1.75} />
          <span className="font-display text-xl text-paper">
            TourGenie <span className="text-sunset">AI</span>
          </span>
        </Link>

        <div className="relative z-10">
          <h2 className="font-display text-display-md text-paper max-w-md">{headline}</h2>
          {/* The best piece of custom art in the app, and the one thing on
              this panel that says "journey" without a stock photograph. */}
          <RouteLine className="w-full max-w-md h-4 mt-8" color="#EF8354" />
          {sub && <p className="text-paper/50 text-sm mt-8 max-w-sm leading-relaxed">{sub}</p>}
        </div>

        <p className="text-2xs text-paper/30 relative z-10">
          Itinerary, route, hotels and budget in one place.
        </p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 relative overflow-hidden">
        <svg
          className="lg:hidden absolute -bottom-10 -left-10 w-72 h-72 opacity-20"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="90" fill="none" stroke="#1C8C82" strokeWidth="1" strokeDasharray="1 8" />
        </svg>

        <div className="w-full max-w-sm relative z-10">
          <Link to="/" className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <Compass className="w-7 h-7 text-sunset" strokeWidth={1.75} />
            <span className="font-display text-xl text-paper">
              TourGenie <span className="text-sunset">AI</span>
            </span>
          </Link>

          <div className="bg-ink-800 border border-ink-700 rounded-3xl p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
