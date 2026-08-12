import TransportOption from "../models/TransportOption.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getTransportOptions = asyncHandler(async (req, res) => {
  const { from_destination_id, to_destination_id, from, to, mode } = req.query;
  const filter = { is_active: true };
  if (from_destination_id) filter.from_destination_id = from_destination_id;
  if (to_destination_id) filter.to_destination_id = to_destination_id;
  if (from) filter.from_city = new RegExp(`^${from}$`, "i");
  if (to) filter.to_city = new RegExp(`^${to}$`, "i");
  if (mode) filter.mode = mode;

  const options = await TransportOption.find(filter).sort({ depart_time: 1 });
  res.json({ options });
});
