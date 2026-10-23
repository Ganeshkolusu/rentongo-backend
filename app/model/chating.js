// const mongoose = require("mongoose");

// const messageSchema = new mongoose.Schema({
//   senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//   message: { type: String },
//   files: [{ type: String }], // S3 file URLs
//   seen: { type: Boolean, default: false },
//   timestamp: { type: Date, default: Date.now },
// });

// const chatSchema = new mongoose.Schema(
//   {
//     bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
//     messages: [messageSchema],
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Chatings", chatSchema);


const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // Indexed
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, // Indexed
  message: { type: String },
  files: [{ type: String }],
  seen: { type: Boolean, default: false, index: true }, // Index for unread messages
  timestamp: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    messages: [messageSchema],
  },
  { timestamps: true }
);

// Compound Index for fast search
chatSchema.index({ bookingId: 1, "messages.senderId": 1 });

module.exports = mongoose.model("Chatings", chatSchema);
