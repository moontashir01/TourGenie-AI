// Loading placeholders shaped like the real layout, so pages feel like
// they're arriving rather than popping in after a spinner.

export default function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Grid card matching the trip/hotel/attraction card layout. */
export function CardSkeleton({ media = true }) {
  return (
    <div className="card overflow-hidden" aria-hidden>
      {media && <Skeleton className="h-28 rounded-none" />}
      <div className="p-5 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-4 w-24 mt-2" />
      </div>
    </div>
  );
}

/** Collapsed itinerary day-card row. */
export function DayCardSkeleton() {
  return (
    <div className="card px-5 py-4 flex items-center justify-between" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
    </div>
  );
}

/** Stat/summary panel. */
export function PanelSkeleton({ lines = 4 }) {
  return (
    <div className="card p-6 space-y-3" aria-hidden>
      <Skeleton className="h-3.5 w-28" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}
