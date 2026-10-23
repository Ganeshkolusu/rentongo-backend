const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  images: [
    {
      type: String,
      trim: true,
    },
  ],
  videos: [
    {
      type: String,
      trim: true,
    },
  ],
});

const vehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vehicleType: {
      type: String,
      enum: ["Auto", "Car", "Bike"],
      required: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    // ✅ Media before the trip starts
    beforeTrip: {
      type: mediaSchema,
      default: () => ({}),
    },

    // ✅ Media after the trip ends
    afterTrip: {
      type: mediaSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BookingImages", vehicleSchema);
