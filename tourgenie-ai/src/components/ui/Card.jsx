// Thin wrapper over the existing .card / .card-hover classes. It earns its
// place by making `interactive` a decision rather than a habit: a card only
// gets the lift-on-hover if it actually does something when clicked, and
// half the grids in the app were lifting cards that go nowhere.

export default function Card({
  as: Tag = "div",
  interactive = false,
  padded = false,
  className = "",
  children,
  ...rest
}) {
  return (
    <Tag
      className={[
        "card",
        interactive ? "card-hover" : "",
        padded ? "p-5" : "",
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
