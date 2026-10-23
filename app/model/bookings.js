// const mongoose = require("mongoose");

// const BookingSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     ownerId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     vechileType: {
//       type: String,
//       enum: ["Auto", "Car", "Bike"],
//       required: true,
//     },
//     VechileId: {
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//       refPath: "vechileType", // dynamically reference different models if you later create Bike/Car models
//     },
//     pricePerKm: { type: Number, default: 0 },
//     pricePerHour: { type: Number, default: 0 },
//     pricePerDay: { type: Number, default: 0 },

//     contactNumber: { type: String, required: true },
//     contactName: { type: String, required: true },
//     latitude: { type: String, required: true },
//     longitude: { type: String, required: true },

//     FromDate: { type: Date, required: true },
//     ToDate: { type: Date, required: true },
//     FromTime: { type: String, required: true },
//     ToTime: { type: String, required: true },

//     totalHours: { type: Number, required: true },
//     totalPrice: { type: Number, required: true },

//     // Optional status field for tracking booking lifecycle
//     status: {
//       type: String,
//       enum: ["Pending", "Confirmed", "Cancelled", "Completed","AutoCancelled"],
//       default: "Pending",
//     },
//   },  
//   { timestamps: true }
// );

// // Optional index for fast date-range and vehicle queries
// BookingSchema.index({ VechileId: 1, FromDate: 1, ToDate: 1 });

// module.exports = mongoose.model("Bookings", BookingSchema);


const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vechileType: {
      type: String,
      enum: ["Auto", "Car", "Bike"],
      required: true,
    },
    VechileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "vechileType",
    },
    pricePerKm: { type: Number, default: 0 },
    pricePerHour: { type: Number, default: 0 },
    pricePerDay: { type: Number, default: 0 },

    contactNumber: { type: String, required: true },
    contactName: { type: String, required: true },
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },

    FromDate: { type: Date, required: true },
    ToDate: { type: Date, required: true },
    FromTime: { type: String, required: true },
    ToTime: { type: String, required: true },

    totalHours: { type: Number, required: true },
    totalPrice: { type: Number, required: true },

    // Cars only — customer's choice of who drives. driverFee is the total
    // driver charge for the whole trip (the car's per-day rate × trip days),
    // snapshotted at booking time so later edits to the car's rate don't
    // retroactively change past bookings.
    withDriver: { type: Boolean, default: false },
    driverFee: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Cancelled", "Completed", "AutoCancelled"],
      default: "Pending",
    },
    expireAt: { type: Date,
    },
  },
  { timestamps: true }
);



BookingSchema.index({ VechileId: 1, FromDate: 1, ToDate: 1 });


BookingSchema.index({ userId: 1 });
BookingSchema.index({ ownerId: 1 });
BookingSchema.index({ status: 1 });
BookingSchema.index({ vechileType: 1 });


BookingSchema.index({ FromDate: 1 });
BookingSchema.index({ ToDate: 1 });


BookingSchema.index({ latitude: 1, longitude: 1 });

module.exports = mongoose.model("Bookings", BookingSchema);
