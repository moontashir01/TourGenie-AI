// Notes an admin leaves on a traveller or a trip, for the next admin.
//
// Moderators can write them: answering a support question is most of what
// they do, and a note is the cheapest way to hand that answer on. Editing and
// deleting are limited to the note's author and to owners, so nobody quietly
// rewrites somebody else's account of what happened.
import AdminNote from "../models/AdminNote.js";
import User from "../models/User.js";
import Trip from "../models/Trip.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../services/auditLog.js";

const TARGETS = {
  user: { Model: User, label: (u) => u.email, missing: "That traveller no longer exists" },
  trip: { Model: Trip, label: (t) => `${t.origin} → ${t.destination}`, missing: "That trip no longer exists" },
};

export const listNotes = asyncHandler(async (req, res) => {
  const { target_type, target_id } = req.query;
  if (!TARGETS[target_type] || !target_id) {
    return res.status(400).json({ message: "Ask for notes on a user or a trip, by id." });
  }

  const notes = await AdminNote.find({ target_type, target_id })
    .sort({ pinned: -1, created_at: -1 })
    .lean();
  res.json({ notes });
});

export const createNote = asyncHandler(async (req, res) => {
  const { target_type, target_id, body, pinned } = req.body || {};
  const target = TARGETS[target_type];
  if (!target || !target_id) {
    return res.status(400).json({ message: "A note has to be about a user or a trip." });
  }
  if (!String(body || "").trim()) {
    return res.status(400).json({ message: "Write something before saving the note." });
  }

  // The label is resolved once, at write time — that is what makes the note
  // still readable after the account or trip it describes is deleted.
  const subject = await target.Model.findById(target_id).lean();
  if (!subject) return res.status(404).json({ message: target.missing });

  const note = await AdminNote.create({
    target_type,
    target_id,
    target_label: target.label(subject),
    body: String(body).trim(),
    pinned: Boolean(pinned),
    author_id: req.user._id,
    author_email: req.user.email,
    author_name: req.user.name,
  });

  // Recorded, but without the note's text: the trail should say a note was
  // added, not duplicate what may be personal detail about a traveller.
  await recordAudit(req, {
    action: "note.create",
    entity_type: "AdminNote",
    entity_id: note._id,
    entity_label: `${target_type}: ${note.target_label}`,
    after: { pinned: note.pinned, length: note.body.length },
  });

  res.status(201).json({ note });
});

/** The author, or an owner. Nobody else rewrites somebody's account of events. */
function mayEdit(note, user) {
  return String(note.author_id) === String(user._id) || user.role === "owner";
}

export const updateNote = asyncHandler(async (req, res) => {
  const note = await AdminNote.findById(req.params.id);
  if (!note) return res.status(404).json({ message: "Note not found" });
  if (!mayEdit(note, req.user)) {
    return res.status(403).json({ message: "Only the admin who wrote a note can change it." });
  }

  if (req.body.body !== undefined) {
    if (!String(req.body.body).trim()) {
      return res.status(400).json({ message: "A note can't be emptied — delete it instead." });
    }
    note.body = String(req.body.body).trim();
  }
  if (req.body.pinned !== undefined) note.pinned = Boolean(req.body.pinned);
  await note.save();

  res.json({ note });
});

export const deleteNote = asyncHandler(async (req, res) => {
  const note = await AdminNote.findById(req.params.id);
  if (!note) return res.status(404).json({ message: "Note not found" });
  if (!mayEdit(note, req.user)) {
    return res.status(403).json({ message: "Only the admin who wrote a note can delete it." });
  }

  await AdminNote.deleteOne({ _id: note._id });
  await recordAudit(req, {
    action: "note.delete",
    entity_type: "AdminNote",
    entity_id: note._id,
    entity_label: `${note.target_type}: ${note.target_label}`,
    reason: req.body?.reason,
  });

  res.json({ message: "Note removed" });
});

export default { listNotes, createNote, updateNote, deleteNote };
