// FR-14 — Travel Document Storage. Proposal fields (§4.1.9) unchanged;
// the additions are the metadata the document cards render (title, size,
// expiry badge) and the trip link so documents can be filtered per journey.
import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    // — proposal §4.1.9 —
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["passport", "visa", "id", "insurance", "ticket", "hotel", "other"],
      required: true,
    },
    file_url: { type: String, required: true },
    expiry_date: { type: Date, default: null },

    // — additive —
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
    title: { type: String, default: "" }, // "Passport — Quazi Md Sadman"
    file_name: { type: String, default: "" },
    mime_type: { type: String, default: "" },
    size_bytes: { type: Number, default: 0 },
    thumbnail_url: { type: String, default: null },
    cloudinary_public_id: { type: String, default: null }, // needed to delete the asset
    document_number: { type: String, default: "" },
    issued_by: { type: String, default: "" },
    issue_date: { type: Date, default: null },
    notes: { type: String, default: "" },
    is_archived: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

documentSchema.index({ user_id: 1, type: 1 });
documentSchema.index({ trip_id: 1 });
documentSchema.index({ expiry_date: 1 }); // drives the expiry notification sweep

export default mongoose.model("Document", documentSchema);
