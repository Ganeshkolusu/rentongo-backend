const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema(
  {
    planId: { type: String, required: true, unique: true }, // 'free' | 'pro' | future tiers
    label: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    durationDays: { type: Number, default: 30 },
    maxVehicles: { type: Number, default: null }, // null = unlimited
    priority: { type: Boolean, default: false }, // priority placement in nearby-vehicle search
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", PlanSchema);
