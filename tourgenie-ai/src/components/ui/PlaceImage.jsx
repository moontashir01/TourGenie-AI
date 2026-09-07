import { useState } from "react";

// The picture box on every card that has a place attached — a destination, a
// hotel, an attraction.
//
// The gradient-and-icon block is not a placeholder for a feature that hasn't
// shipped. Images are an enrichment path like every other provider in this
// app: with `hero_image` / `image_url` unset on the whole catalogue, every
// card still renders and still reads as a card. That is also why a broken URL
// falls back rather than showing the browser's torn-image glyph — a dead link
// in seeded data must not leave a hole in the grid.
//
// The aspect box is fixed before anything loads. Without it a grid reflows as
// each image arrives and the row you were about to click moves out from under
// the pointer.

const RATIOS = {
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "21/9": "aspect-[21/9]",
};

// Two grounds, matching the two accents the cards already use: teal for
// places and facts, sunset for anything the app is recommending.
const TONES = {
  teal: "from-teal-light via-teal-light to-teal/25 text-teal-dark",
  sunset: "from-sunset-light via-sunset-light to-sunset/25 text-sunset-dark",
};

export default function PlaceImage({
  src,
  alt = "",
  icon: Icon,
  ratio = "16/9",
  tone = "teal",
  // Sits over the top-right of the box in both states — a rating, a badge, a
  // remove button.
  corner,
  // Rendered over a bottom-anchored scrim, and only when there is a real
  // image to darken: the same white title over the light gradient fallback
  // would be invisible.
  overlay,
  className = "",
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`relative overflow-hidden ${RATIOS[ratio] || RATIOS["16/9"]} ${
        showImage ? "bg-sand/40" : `bg-gradient-to-br ${TONES[tone] || TONES.teal}`
      } ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        Icon && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Icon
              className="w-8 h-8 transition-transform duration-base group-hover:scale-110"
              strokeWidth={1.5}
              aria-hidden
            />
          </span>
        )
      )}

      {showImage && overlay && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-fixed/75 to-transparent px-4 pt-8 pb-3">
          {overlay}
        </div>
      )}

      {corner && <div className="absolute top-2 right-2 z-10">{corner}</div>}
    </div>
  );
}
