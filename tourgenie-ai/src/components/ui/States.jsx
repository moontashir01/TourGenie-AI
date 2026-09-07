import { Link } from "react-router-dom";
import { Map, RefreshCw, TriangleAlert } from "lucide-react";
import Button from "./Button";

// Empty, error and no-trip-selected — the three things a page can show
// instead of content. They were being rebuilt per page, which is why the
// wording drifted: some empties explain what would fill them and some are
// four words on a dashed box. An empty state is the only instruction a new
// traveller gets, so it takes a sentence they can act on, not a label.

/** Nothing here yet — and what would put something here. */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  // `inline` drops the dashed box for empties that sit inside a card that
  // already has a border of its own.
  inline = false,
  className = "",
}) {
  return (
    <div
      className={[
        "text-center animate-fade-in",
        inline ? "py-8" : "bg-surface border border-dashed border-sand rounded-2xl p-12",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {Icon && (
        <span className="relative inline-flex items-center justify-center w-24 h-14 mb-3" aria-hidden>
          {/* The same dotted route line the landing hero and the trip panel
              use, so an empty page still looks like this product. */}
          <svg className="absolute inset-0 w-full h-full text-sand" viewBox="0 0 96 56" fill="none">
            <path
              d="M6 40 Q 30 12, 48 28 T 90 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="1 7"
            />
            <circle cx="6" cy="40" r="3" fill="currentColor" />
            <circle cx="90" cy="18" r="3" fill="currentColor" />
          </svg>
          <span className="relative w-11 h-11 rounded-xl bg-paper border border-sand inline-flex items-center justify-center">
            <Icon className="w-5 h-5 text-ink-500" strokeWidth={1.75} />
          </span>
        </span>
      )}
      {title && <p className="font-display text-lg text-ink-900 mb-1">{title}</p>}
      {description && <p className="text-sm text-ink-600 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** A request failed. Distinct from empty: something is wrong and there is
 *  something to try. Never swallow the message — the API writes sentences a
 *  traveller can act on, and "Something went wrong" throws that away. */
export function ErrorState({ message, onRetry, inline = false, className = "" }) {
  if (inline) {
    return (
      <div
        role="alert"
        className={`flex items-start gap-2.5 bg-sunset/10 border border-sunset/30 text-sunset-dark text-sm rounded-lg px-4 py-3 ${className}`}
      >
        <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
        <span className="flex-1">{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="font-semibold underline underline-offset-2 hover:no-underline shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`text-center bg-surface border border-sunset/30 rounded-2xl p-12 animate-fade-in ${className}`}
    >
      <span className="w-11 h-11 rounded-xl bg-sunset-light inline-flex items-center justify-center mb-3">
        <TriangleAlert className="w-5 h-5 text-sunset-dark" strokeWidth={1.75} aria-hidden />
      </span>
      <p className="font-display text-lg text-ink-900 mb-1">That didn't load</p>
      <p className="text-sm text-ink-600 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

/** Seven pages are trip-scoped and say the same thing without one. */
export function NoTripState({ what = "This page" }) {
  return (
    <EmptyState
      icon={Map}
      title="No trip selected"
      description={`${what} works on one trip at a time. Open a trip and it will fill in.`}
      action={
        <Button as={Link} to="/dashboard" variant="secondary" size="sm">
          Go to your trips
        </Button>
      }
    />
  );
}
