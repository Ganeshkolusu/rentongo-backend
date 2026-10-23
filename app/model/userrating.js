// const mongoose = require("mongoose");

// const userratingSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   BookingId: { type: mongoose.Schema.Types.ObjectId, refPath: 'Booking', required: true },
//   review: { type: String, required: true },
//   rating: { type: Number, required: true, min: 1, max: 5 },
//   reviewDate: { type: Date, default: Date.now }
// }, { timestamps: true });

// module.exports = mongoose.model("userrating", userratingSchema);


const mongoose = require("mongoose");

const userratingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Fast lookup of ratings by user
    },

    BookingId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "Booking",
      required: true,
      index: true, // Quick lookup of rating per booking
    },

    review: { type: String, required: true },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      index: true, // Enable AVG rating calculations
    },

    reviewDate: {
      type: Date,
      default: Date.now,
      index: true, // For sorting reviews by latest
    },
  },
  { timestamps: true }
);

// Compound Index – fast queries like: get all ratings by a user for a booking
userratingSchema.index({ userId: 1, BookingId: 1 }, { unique: true });

// For analytics: fetch ratings & sort by date
userratingSchema.index({ rating: 1, reviewDate: -1 });

module.exports = mongoose.model("userrating", userratingSchema);
