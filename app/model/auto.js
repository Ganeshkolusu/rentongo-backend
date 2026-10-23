const mongoose = require("mongoose");

const AutoSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
 AutoNumber: { type: String, required: true, unique: true },
 description: String,
 pricePerKm: { type: Number, required: true },
 contactNumber: { type: String, required: true },
 contactName: { type: String, required: true },
 latitude: { type: String, required: true },
 longitude: { type: String, required: true },
 autoImages: [String],
 Available: { type: Boolean, default: true },
 status:{ type: String, default: 'Pending' },
 boosted: { type: Boolean, default: false, index: true }, // Pro-plan owner: priority placement in search

}, { timestamps: true });

module.exports = mongoose.model("Auto", AutoSchema);
