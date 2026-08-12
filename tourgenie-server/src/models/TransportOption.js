// Backs FR-08 (mock ticket booking) and FR-22 (admin transport management).
//
// Proposal fields (§4.1.8) unchanged. Added: the operating-days and seat-map
// detail a booking needs to assign seats, and the class/fare breakdown that
// makes the mock booking screen look like a real one.
import mongoose from "mongoose";

const transportOptionSchema = new mongoose.Schema(
  {
    // — proposal §4.1.8 —
    operator: { type: String, required: true },
    mode: { type: String, enum: ["bus", "train", "launch"], required: true },
    from_city: { type: String, required: true },
    to_city: { type: String, required: true },
    depart_time: { type: String, required: true }, // "07:00"
    arrive_time: { type: String, required: true },
    fare: { type: Number, required: true }, // per passenger in currency
    currency: { type: String, default: "BDT", uppercase: true },

    // — additive —
    code: { type: String, sparse: true, unique: true }, // GL-701, SUB-771
    service_class: { type: String, default: "" }, // AC Business, Shovan Chair, Cabin
    coach_type: { type: String, default: "" }, // Hyundai Universe, Scania

    duration_min: { type: Number, default: null },
    arrives_next_day: { type: Boolean, default: false },
    boarding_point: { type: String, default: "" }, // Saidabad Terminal
    dropping_point: { type: String, default: "" },
    via: { type: [String], default: [] }, // towns on the way

    from_destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },
    to_destination_id: { type: mongoose.Schema.Types.ObjectId, ref: "Destination", default: null },

    // 0 = Sunday … 6 = Saturday.
    days_of_week: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },

    total_seats: { type: Number, default: 40 },
    seats_available: { type: Number, default: 40 },
    seat_layout: { type: String, default: "2-2" }, // 2-2, 1-2, 2-1
    seat_prefix: { type: String, default: "A" }, // seat labels: A1, A2…

    has_ac: { type: Boolean, default: true },
    amenities: { type: [String], default: [] }, // WiFi, Blanket, Water, Toilet
    cancellation_policy: { type: String, default: "" },

    rating: { type: Number, min: 0, max: 5, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

transportOptionSchema.index({ from_city: 1, to_city: 1, mode: 1 });
transportOptionSchema.index({ mode: 1, fare: 1 });
transportOptionSchema.index({ is_active: 1, depart_time: 1 });

export default mongoose.model("TransportOption", transportOptionSchema);
