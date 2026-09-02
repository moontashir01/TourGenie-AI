// Cancelling a ticket, in one place.
//
// The traveller cancels their own booking and an admin cancels it on their
// behalf; both have to release the seats the same way. Writing
// `status = "cancelled"` from the admin side would leave the schedule's
// counter holding seats nobody is sitting in, which is the drift this
// accounting was fixed to prevent.
import TransportOption from "../models/TransportOption.js";

/**
 * Marks the booking cancelled and gives the schedule back exactly what the
 * booking took. Returns how many seats were released.
 *
 * The caller is responsible for having loaded (and authorised) the booking.
 */
export async function releaseBooking(booking) {
  booking.status = "cancelled";
  booking.cancelled_at = new Date();
  await booking.save();

  // `??`, not `||`: a booking that legitimately held zero gives back zero.
  // Only bookings made before the field existed fall back to a seat count.
  const released = booking.inventory_held ?? (booking.seats?.length || booking.passengers.length);

  await TransportOption.collection.updateOne({ _id: booking.transport_id }, [
    {
      $set: {
        seats_available: {
          $min: [
            { $add: ["$seats_available", released] },
            { $ifNull: ["$total_seats", { $add: ["$seats_available", released] }] },
          ],
        },
      },
    },
  ]);

  return released;
}
