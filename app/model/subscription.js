const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    plan: { type: String, enum: ["free", "pro"], default: "free" },
    status: { type: String, enum: ["active", "expired"], default: "active" },
    startedAt: { type: Date },
    expiresAt: { type: Date, index: true },
    cashfreeOrderId: { type: String },
    lastPaymentAmount: { type: Number },
    // Set once an expiry-reminder notification has been sent for the
    // *current* expiresAt, so the reminder cron doesn't re-notify the owner
    // every run. Cleared whenever expiresAt changes (a renewal/new payment).
    expiryReminderSentAt: { type: Date },
    history: [
      {
        orderId: String,
        plan: String,
        amount: Number,
        paidAt: Date,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
