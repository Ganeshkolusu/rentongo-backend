const mongoose = require("mongoose");

const CallSchema = new mongoose.Schema(
  {
    // 🔹 Caller and receiver references
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔹 Call type: audio or video
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },

    // 🔹 Call status tracking
    status: {
      type: String,
      enum: ["ringing", "accepted", "rejected", "missed", "ended"],
      default: "ringing",
    },

    // 🔹 Socket IDs (for real-time connections)
    callerSocketId: { type: String },
    receiverSocketId: { type: String },

    // 🔹 WebRTC offer/answer/ICE candidate data
    offer: { type: Object, default: null },
    answer: { type: Object, default: null },
    iceCandidates: { type: Array, default: [] },

    // 🔹 Call timing
    startedAt: { type: Date },
    endedAt: { type: Date },

    // 🔹 Duration (in seconds)
    duration: { type: Number, default: 0 },

    // 🔹 Optional: store call recording URL (if you add this later)
    recordingUrl: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Call", CallSchema);
