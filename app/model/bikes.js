// const mongoose = require("mongoose");

// const BikeSchema = new mongoose.Schema({
//  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//  bikeNumber: { type: String, required: true, unique: true },
//  bikeName:{type:String,required:true},
//  bikeModel:{type:String,required:true},
//  description: String,
//  pricePerKm: { type: Number, required: true },
//  contactNumber: { type: String, required: true },
//  contactName: { type: String, required: true },
//  latitude: { type: String, required: true },
//  longitude: { type: String, required: true },
//  pickupArea: { type: String, required: true },
//  pickupCity: { type: String, required: true },
//  pickupCityPinCode: { type: String, required: true },
//  pickupCityState: { type: String, required: true },
//  pickupCityCountry: { type: String, required: true },
//  bikeImages: [String],
//  InsuranceNo: String,
//  gps: { type: Boolean, default: false },
//  Available: { type: Boolean, default: true },
//  status:{ type: String, default: 'Pending' }

// }, { timestamps: true });

// module.exports = mongoose.model("Bike", BikeSchema);

const mongoose = require("mongoose");

const BikeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bikeNumber: { type: String, required: true, unique: true },
  bikeName: { type: String, required: true },
  bikeModel: { type: String, required: true },
  description: String,
  pricePerKm: { type: Number, required: true },
  contactNumber: { type: String, required: true },
  contactName: { type: String, required: true },
  latitude: { type: String, required: true },
  longitude: { type: String, required: true },
  pickupArea: { type: String, required: true },
  pickupCity: { type: String, required: true },
  pickupCityPinCode: { type: String, required: true },
  pickupCityState: { type: String, required: true },
  pickupCityCountry: { type: String, required: true },
  bikeImages: [String],
  InsuranceNo: String,
  gps: { type: Boolean, default: false },
  Available: { type: Boolean, default: true },
  status: { type: String, default: 'Pending' },
  boosted: { type: Boolean, default: false, index: true }, // Pro-plan owner: priority placement in search
}, { timestamps: true });

// 🔹 Apply Indexes
BikeSchema.index({ bikeNumber: 1 }, { unique: true });
BikeSchema.index({ pickupCity: 1 });
BikeSchema.index({ pickupCityPinCode: 1 });
BikeSchema.index({ status: 1 });
BikeSchema.index({ Available: 1 });
BikeSchema.index({ userId: 1 });
BikeSchema.index({ latitude: 1, longitude: 1 });  // OK for now (String)

module.exports = mongoose.model("Bike", BikeSchema);
