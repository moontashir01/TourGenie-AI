import Document from "../models/Document.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// FR-14 — Travel Document Storage
// NOTE: for real file uploads, add multer + the Cloudinary SDK here and
// upload the file before saving file_url. This assumes the client already
// has a hosted file_url (e.g. uploaded directly to Cloudinary from the
// frontend using an unsigned upload preset).
export const addDocument = asyncHandler(async (req, res) => {
  const { type, file_url, expiry_date } = req.body;
  if (!type || !file_url) {
    return res.status(400).json({ message: "type and file_url are required" });
  }
  const doc = await Document.create({
    user_id: req.user._id,
    type,
    file_url,
    expiry_date: expiry_date || null,
  });
  res.status(201).json({ document: doc });
});

export const getMyDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ user_id: req.user._id }).sort({ created_at: -1 });
  res.json({ documents });
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findOneAndDelete({ _id: req.params.id, user_id: req.user._id });
  if (!doc) return res.status(404).json({ message: "Document not found" });
  res.json({ message: "Document deleted" });
});
