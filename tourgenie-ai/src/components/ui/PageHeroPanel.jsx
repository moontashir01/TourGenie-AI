// The dark panel that opens a page — Dashboard's next departure, the trip
// snapshot beside the itinerary, the "how the AI plans this" note on Plan
// Trip. It was built three times, and the ink glow and the radius had already
// started to drift apart between them.
//
// `theme-ink` pins the subtree to the light-mode values, because this surface
// is dark *by design*: without it the panel inverts to a pale card exactly
// when the rest of the app goes dark.

export default function PageHeroPanel({
  as: Tag = "div",
  // The dotted flight path. On at page scale, off in a sidebar, where it
  // would be behind the text rather than beside it.
  art = false,
  className = "",
  children,
}) {
  return (
    <Tag className={`theme-ink bg-ink-900 bg-ink-glow rounded-3xl relative overflow-hidden ${className}`}>
      {art && (
        <svg
          className="absolute right-0 top-0 h-full w-1/2 opacity-25"
          viewBox="0 0 300 150"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 120 Q 100 40, 200 90 T 300 60"
            fill="none"
            stroke="#EF8354"
            strokeWidth="2"
            strokeDasharray="1 9"
            strokeLinecap="round"
          />
          <circle cx="8" cy="118" r="4" fill="#EF8354" />
          <path d="M300 60 L288 53 L288 67 Z" fill="#EF8354" />
        </svg>
      )}
      <div className="relative z-10">{children}</div>
    </Tag>
  );
}
