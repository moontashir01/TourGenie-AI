// FR-19 — Review & Community, the attraction-review side. Proposal fields
// (§4.1.12) unchanged. A post-save hook keeps Attraction.rating and
// review_count current so the attraction list doesn't need an aggregation.
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  // — proposal §4.1.12 —
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  attraction_id: { type: mongoose.Schema.Types.ObjectId, ref: "Attraction", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true },
  photo_url: { type: String, default: null },
  created_at: { type: Date, default: Date.now },

  // — already in use by the app —
  is_hidden: { type: Boolean, default: false },

  // — additive —
  trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
  title: { type: String, default: "" },
  photo_urls: { type: [String], default: [] },
  visited_on: { type: Date, default: null },
  helpful_count: { type: Number, default: 0 },
  helpful_by: { type: [mongoose.Schema.Types.ObjectId], default: [], ref: "User" },
  moderation_status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved",
  },
  moderated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  moderated_at: { type: Date, default: null },
});

// One review per user per attraction.
reviewSchema.index({ user_id: 1, attraction_id: 1 }, { unique: true });
reviewSchema.index({ attraction_id: 1, is_hidden: 1, created_at: -1 });
reviewSchema.index({ moderation_status: 1 });

// Recompute the attraction's average whenever a visible review changes.
async function refreshAttractionRating(attractionId) {
  if (!attractionId) return;
  const Review = mongoose.model("Review");
  const Attraction = mongoose.model("Attraction");
  const [agg] = await Review.aggregate([
    { $match: { attraction_id: attractionId, is_hidden: false } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  await Attraction.findByIdAndUpdate(attractionId, {
    rating: agg ? Math.round(agg.avg * 10) / 10 : 0,
    review_count: agg ? agg.count : 0,
  });
}

reviewSchema.post("save", function afterSave(doc) {
  refreshAttractionRating(doc.attraction_id).catch(() => {});
});
reviewSchema.post("findOneAndUpdate", function afterUpdate(doc) {
  if (doc) refreshAttractionRating(doc.attraction_id).catch(() => {});
});
reviewSchema.post("findOneAndDelete", function afterDelete(doc) {
  if (doc) refreshAttractionRating(doc.attraction_id).catch(() => {});
});

export default mongoose.model("Review", reviewSchema);
