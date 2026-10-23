const mongoose = require("mongoose");

const CarSchema = new mongoose.Schema({
 userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
 CarName: { type: String, required: true },
 CarModel: { type: String, required: true },
 CarNumber: { type: String, required: true, unique: true },
 Carseater:{type:String},
 gps: { type: Boolean, default: false },
 fuelType: { type: String, required: true },
 transmissionType: { type: String, required: true },
 kmDriven: { type: Number, required: true },
 Ac_available: { type: Boolean, default: true },
 description: String,
 RentPerHour: { type: Number, required: true },
 RentPerDay: { type: Number, required: true },
 contactNumber: { type: String, required: true },
 contactName: { type: String, required: true },
 drivingLicenseRequired: { type: Boolean, default: true },
 AadharCardRequired: { type: Boolean, default: true },
 DepositAmount: { type: Number, required: true },
 DepositVehicle: { type: Boolean, default: true },
 pickupLatitude: { type: String, required: true },
 pickupLongitude: { type: String, required: true },
 pickupArea: { type: String, required: true },
 pickupCity: { type: String, required: true },
 pickupCityPinCode: { type: String, required: true },
 pickupCityState: { type: String, required: true },
 pickupCityCountry: { type: String, required: true },
 carImages: [String],
 Available: { type: Boolean, default: true },
  status:{ type: String, default: 'Pending' },
  boosted: { type: Boolean, default: false, index: true }, // Pro-plan owner: priority placement in search
  driverAvailable: { type: Boolean, default: false }, // owner offers a with-driver option for this car
  driverFee: { type: Number, default: 0 }, // per-day extra charge if the customer books with driver


}, { timestamps: true });

module.exports = mongoose.model("Car", CarSchema);


// const mongoose = require("mongoose");

// const CarSchema = new mongoose.Schema(
//   {
//     userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     CarName: { type: String, required: true, index: true }, // 🔹 Index added
//     CarModel: { type: String, required: true, index: true }, // 🔹 Index added
//     CarNumber: { type: String, required: true, unique: true },
//     Carseater: { type: String },
//     gps: { type: Boolean, default: false },
//     fuelType: { type: String, required: true, index: true }, // 🔹 Index added
//     transmissionType: { type: String, required: true, index: true }, // 🔹 Index added

//     kmDriven: { type: Number, required: true },
//     Ac_available: { type: Boolean, default: true },
//     description: String,
//     RentPerHour: { type: Number, required: true, index: true },
//     RentPerDay: { type: Number, required: true, index: true },

//     contactNumber: { type: String, required: true },
//     contactName: { type: String, required: true },
//     drivingLicenseRequired: { type: Boolean, default: true },
//     AadharCardRequired: { type: Boolean, default: true },
//     DepositAmount: { type: Number, required: true },
//     DepositVehicle: { type: Boolean, default: true },

//     pickupLatitude: { type: String, required: true, index: true },  // 🔹 INDEX ADDED
//     pickupLongitude: { type: String, required: true, index: true }, // 🔹 INDEX ADDED

//     pickupArea: { type: String, required: true, index: true },
//     pickupCity: { type: String, required: true, index: true },
//     pickupCityPinCode: { type: String, required: true },
//     pickupCityState: { type: String, required: true, index: true },
//     pickupCityCountry: { type: String, required: true, index: true },

//     carImages: [String],
//     Available: { type: Boolean, default: true, index: true },
//     status: { type: String, default: "Pending", index: true },
//   },
//   { timestamps: true }
// );

// // 🔹 COMPOUND INDEX (FAST FILTERING)
// CarSchema.index({ pickupLatitude: 1, pickupLongitude: 1 });
// CarSchema.index({ pickupCity: 1, pickupArea: 1 });
// CarSchema.index({ fuelType: 1, transmissionType: 1 });
// CarSchema.index({ Available: 1, status: 1 });

// module.exports = mongoose.model("Car", CarSchema);
