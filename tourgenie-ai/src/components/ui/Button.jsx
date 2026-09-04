import { Loader2 } from "lucide-react";

// The app had two button classes (.btn-primary, .btn-secondary) used in 15
// files, and 133 places that rebuilt a pill from scratch because they needed
// a third variant, a smaller size, or a spinner. This is that third variant
// and the other ten.
//
// `loading` is the reason this is a component and not another CSS class: a
// button that swaps its label for a spinner changes width mid-click, so the
// row it sits in jumps. Here the label stays and the icon slot becomes the
// spinner, which keeps the box the same size.

const VARIANTS = {
  // The page's one real call to action.
  primary: "bg-sunset hover:bg-sunset-dark text-ink-fixed shadow-sm hover:shadow-glow",
  secondary: "bg-surface border border-sand hover:border-teal text-ink-900 hover:shadow-soft",
  // Confirmations and anything affirmative that isn't the page's main CTA.
  teal: "bg-teal hover:bg-teal-dark text-paper-fixed shadow-sm",
  // The palette has no red by design — sunset is this app's warning colour,
  // so danger reads as primary with a heavier ring rather than a new hue.
  danger: "bg-sunset hover:bg-sunset-dark text-ink-fixed ring-1 ring-sunset-dark/40 shadow-sm",
  // Toolbar and inline actions, where a filled pill would shout.
  ghost: "text-ink-900/70 hover:text-ink-900 hover:bg-sand/50",
};

const SIZES = {
  // text-xs on a control this small; anything smaller stops being tappable.
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-5 py-2.5 gap-2",
  lg: "text-base px-6 py-3 gap-2",
};

const ICON_SIZES = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" };

export default function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  fullWidth = false,
  disabled = false,
  className = "",
  children,
  ...rest
}) {
  const iconClass = ICON_SIZES[size] || ICON_SIZES.md;
  const isButton = Tag === "button";
  const inert = disabled || loading;

  return (
    <Tag
      // A <Link> or <a> has no disabled attribute, so the guard has to be
      // both: the attribute where it exists, aria + pointer-events where it
      // doesn't.
      {...(isButton ? { type: rest.type || "button", disabled: inert } : {})}
      aria-busy={loading || undefined}
      aria-disabled={!isButton && inert ? true : undefined}
      className={[
        "inline-flex items-center justify-center font-semibold rounded-full",
        "transition duration-fast ease-tg-out active:scale-[0.98]",
        "disabled:opacity-60 disabled:shadow-none disabled:active:scale-100",
        !isButton && inert ? "opacity-60 pointer-events-none" : "",
        fullWidth ? "w-full" : "",
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin shrink-0`} aria-hidden />
      ) : (
        Icon && <Icon className={`${iconClass} shrink-0`} aria-hidden />
      )}
      {children}
      {IconRight && !loading && <IconRight className={`${iconClass} shrink-0`} aria-hidden />}
    </Tag>
  );
}

/** Square icon-only button — the close/menu/kebab shape, with a label the
 *  screen reader can actually announce. */
export function IconButton({ icon: Icon, label, size = "md", variant = "ghost", className = "", ...rest }) {
  const box = size === "sm" ? "w-8 h-8" : "w-9 h-9";
  const glyph = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        box,
        "rounded-lg inline-flex items-center justify-center shrink-0",
        "transition duration-fast ease-tg-out active:scale-95 disabled:opacity-50",
        VARIANTS[variant] || VARIANTS.ghost,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <Icon className={glyph} aria-hidden />
    </button>
  );
}
