const mongoose = require("mongoose");

const TrackingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bookings",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: {
      type: String,
      enum: ["renterApp", "driverApp", "device"],
      required: true,
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TrackingSchema.index({ bookingId: 1, recordedAt: -1 });

module.exports = mongoose.model("Tracking", TrackingSchema);
