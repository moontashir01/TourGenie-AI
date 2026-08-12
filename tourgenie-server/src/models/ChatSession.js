// FR-05 — AI Chat Assistant. Conversation history per trip, with messages
// embedded rather than in their own collection: a session is always read and
// written whole, and a chat that outgrows the 16 MB document limit isn't a
// scenario this platform has.
import mongoose from "mongoose";
import { TIMESTAMPS } from "./_shared.js";

const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },

    // Which ChatIntent matched (when answered from the database) or which
    // provider produced the reply (when an LLM key was configured).
    intent_code: { type: String, default: null },
    source: { type: String, enum: ["database", "groq", "claude", "openai"], default: "database" },

    // What the assistant actually did to the itinerary, so the UI can show
    // "3 activities updated" and the change is auditable.
    applied_changes: {
      type: {
        action: { type: String, default: "" }, // add_day, reduce_budget, swap_activity…
        items_added: { type: Number, default: 0 },
        items_removed: { type: Number, default: 0 },
        items_updated: { type: Number, default: 0 },
        cost_delta: { type: Number, default: 0 },
      },
      default: null,
    },

    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const chatSessionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    trip_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
    title: { type: String, default: "New conversation" },
    messages: { type: [chatMessageSchema], default: [] },
    last_message_at: { type: Date, default: Date.now },
    is_archived: { type: Boolean, default: false },
  },
  TIMESTAMPS
);

chatSessionSchema.index({ user_id: 1, last_message_at: -1 });
chatSessionSchema.index({ trip_id: 1 });

export default mongoose.model("ChatSession", chatSessionSchema);
