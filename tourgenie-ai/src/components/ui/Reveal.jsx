import useInView from "../../hooks/useInView";

// Reveals a block the first time it scrolls into view. For the marketing
// pages, where the whole point is that the page unfolds as you read it — and
// deliberately not for the app, where content arriving late is content you
// were waiting for.
//
// `stagger` hands the job to the CSS ladder in index.css so a grid's children
// arrive one after another rather than as one slab.
export default function Reveal({ as: Tag = "div", stagger = false, className = "", children, ...rest }) {
  const { ref, inView } = useInView();

  return (
    <Tag
      ref={ref}
      className={[
        // invisible, not opacity-0: an unrevealed block should not be a
        // click target sitting transparently over the one above it.
        inView ? (stagger ? "stagger" : "animate-fade-up") : "invisible",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Tag>
  );
}
