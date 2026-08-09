export default function RouteLine({ className = "", color = "#1C8C82" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 24"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="5" fill={color} />
      <line
        x1="14"
        y1="12"
        x2="386"
        y2="12"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="1 9"
        strokeLinecap="round"
      />
      <path
        d="M386 12 L378 7 L378 17 Z"
        fill={color}
      />
    </svg>
  );
}
