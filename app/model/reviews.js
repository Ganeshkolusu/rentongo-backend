// const mongoose = require("mongoose");

// const UserSchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   vechileType: { type: String, enum: ['Auto', 'Car', 'Bike'], required: true },
//   VechileId: { type: mongoose.Schema.Types.ObjectId, required: true },
//   BookingId: { type: mongoose.Schema.Types.ObjectId, refPath: 'Booking', required: true },
//   review: { type: String, required: true },
//   rating: { type: Number, required: true, min: 1, max: 5 },
//   reviewDate: { type: Date, default: Date.now }
// }, { timestamps: true });

// module.exports = mongoose.model("Review", UserSchema);


const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // Faster user-based search
  vechileType: { type: String, enum: ['Auto', 'Car', 'Bike'], required: true, index: true }, // Filtering vehicles
  VechileId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, // Index for vehicle-based reviews
  BookingId: { type: mongoose.Schema.Types.ObjectId, refPath: 'Booking', required: true, index: true },
  review: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5, index: true }, // Index for rating filter / averages
  reviewDate: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// 📌 Compound Index – helps get reviews of a vehicle with filter
ReviewSchema.index({ vechileType: 1, VechileId: 1 });

// 📌 For fast review sorting & searching by user
ReviewSchema.index({ userId: 1, reviewDate: -1 });

// 📌 For average rating calculation & analytics
ReviewSchema.index({ VechileId: 1, rating: 1 });

module.exports = mongoose.model("Review", ReviewSchema);
