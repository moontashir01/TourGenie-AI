// FR-07 — a live nightly rate for one hotel, for one specific stay.
//
// `Hotel.price_per_night` is a single representative figure: it is what the
// browse cards and the budget estimator use before a trip has dates. It
// cannot answer "what does this room cost for 3–7 October for 4 people",
// because a hotel has a different price for every date range and occupancy.
// That answer lives here, one document per (hotel, stay, occupancy).
//
// This collection is also what stops a free-tier API quota evaporating. The
// hotel controller asks it first and only calls the provider when nothing
// fresh is stored, so repeated visits to the Hotels page are free. A search
// that legitimately returned no hotels still writes one marker row with
// `hotel_id: null`, otherwise an empty city would re-hit the provider on
// every single page load — the exact case a quota is least able to survive.
import mongoose from "mongoose";

const hotelRateSchema = new mongoose.Schema(
  {
    // Null marks "this search ran and found nothing" — see above.
    hotel_id: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", default: null },

    // The search key. Dates are stored date-only (midnight UTC) so that two
    // requests for the same day always hit the same cached row.
    city: { type: String, required: true },
    check_in: { type: Date, required: true },
    check_out: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1 },
    rooms: { type: Number, required: true, min: 1 },

    nights: { type: Number, required: true, min: 1 },
    // Both are stored: the per-night figure is what the UI shows and what the
    // budget multiplies, the total is what the provider actually quoted.
    // Deriving one from the other at read time is how a stay total ends up
    // being multiplied by the nights a second time.
    price_per_night: { type: Number, default: null },
    total_price: { type: Number, default: null },
    currency: { type: String, default: "BDT", uppercase: true },

    source: { type: String, default: "stayapi" },
    fetched_at: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// The cache lookup: "anything fresh for this exact search?"
hotelRateSchema.index({ city: 1, check_in: 1, check_out: 1, guests: 1, rooms: 1, fetched_at: -1 });
// The per-hotel upsert key.
hotelRateSchema.index({ hotel_id: 1, check_in: 1, check_out: 1, guests: 1, rooms: 1 });

export default mongoose.model("HotelRate", hotelRateSchema);
