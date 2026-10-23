const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", OtpSchema);
