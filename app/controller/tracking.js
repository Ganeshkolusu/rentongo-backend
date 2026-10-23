const Tracking = require("../model/tracking");
const Booking = require("../model/bookings");

exports.recordLocation = async ({ bookingId, userId, source, latitude, longitude }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new Error("Booking not found");
  }

  return Tracking.create({ bookingId, userId, source, latitude, longitude });
};

exports.updateLocation = async (req, res) => {
  try {
    const { bookingId, userId, source, latitude, longitude } = req.body;

    if (!bookingId || !userId || !source || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        message: "bookingId, userId, source, latitude and longitude are required",
      });
    }

    const point = await exports.recordLocation({ bookingId, userId, source, latitude, longitude });

    res.status(201).json({ message: "Location updated", point });
  } catch (error) {
    console.error("Error updating location:", error);
    const status = error.message === "Booking not found" ? 404 : 500;
    res.status(status).json({ message: error.message || "Server error" });
  }
};

exports.getLatestLocation = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const point = await Tracking.findOne({ bookingId }).sort({ recordedAt: -1 });
    if (!point) {
      return res.status(404).json({ message: "No location updates yet for this booking" });
    }

    res.status(200).json({ point });
  } catch (error) {
    console.error("Error fetching latest location:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getLocationHistory = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const points = await Tracking.find({ bookingId }).sort({ recordedAt: 1 });
    res.status(200).json({ count: points.length, points });
  } catch (error) {
    console.error("Error fetching location history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
