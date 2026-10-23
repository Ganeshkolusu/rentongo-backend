// const mongoose = require("mongoose");

// const SupportTicketSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     vehicleType: {
//       type: String,
//       enum: ["Auto", "Car", "Bike"],
//       required: true,
//     },
//     vehicleId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Vehicle",
//       required: true,
//     },
//     bookingId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Booking",
//       required: true,
//     },
//     subject: {
//       type: String,
//       required: true,
//     },
//     description: {
//       type: String,
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["Open", "In Progress", "Resolved", "Closed"],
//       default: "Open",
//     },
//     priority: {
//       type: String,
//       enum: ["Low", "Medium", "High"],
//       default: "Medium",
//     },
//     review: {
//       type: String,
//       default: "",
//     },
//     rating: {
//       type: Number,
//       min: 1,
//       max: 5,
//     },
//     reviewDate: {
//       type: Date,
//       default: Date.now,
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("SupportTicket", SupportTicketSchema);


const mongoose = require("mongoose");

const SupportTicketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,  // Fast user-based queries
    },
    vehicleType: {
      type: String,
      enum: ["Auto", "Car", "Bike"],
      required: true,
      index: true, // Important for filtering
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true, // Filter tickets of a specific vehicle
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
      index: true, // Fast filtering by status
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
      index: true, // High priority tickets 🔥
    },
    review: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      index: true, // Get avg rating easily
    },
    reviewDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for more speed ⚡
SupportTicketSchema.index({ userId: 1, status: 1 });
SupportTicketSchema.index({ vehicleId: 1, status: 1 });
SupportTicketSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model("SupportTicket", SupportTicketSchema);

