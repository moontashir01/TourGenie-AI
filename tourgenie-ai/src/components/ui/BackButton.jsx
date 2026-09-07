import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconButton } from "./Button";

/**
 * Is there an in-app page behind this one?
 *
 * React Router stamps an index onto `history.state` for every entry it pushes,
 * and sets it to 0 for the entry a fresh load starts on. So 0 means this tab
 * opened straight onto this page — a pasted link, a new tab, a bookmark — and
 * `navigate(-1)` would walk out of the site rather than up it.
 */
export function canGoBack() {
  return (window.history.state?.idx ?? 0) > 0;
}

/**
 * Back, one page. Falls back to a sensible in-app page when there is nothing
 * behind this one, so a deep link never bounces the traveller off the site.
 *
 * The fallback replaces rather than pushes: a Back that adds to history gives
 * you a Back button that can't undo itself.
 */
export default function BackButton({ fallbackTo = "/dashboard", label = "Back", className = "" }) {
  const navigate = useNavigate();
  // Re-reading history.state on every navigation is the whole point — the
  // index changes underneath us, and useLocation is what re-renders us.
  useLocation();

  return (
    <IconButton
      icon={ArrowLeft}
      label={label}
      variant="secondary"
      onClick={() => (canGoBack() ? navigate(-1) : navigate(fallbackTo, { replace: true }))}
      className={className}
    />
  );
}
