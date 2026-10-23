// const mongoose = require("mongoose");

// const notificationSchema = new mongoose.Schema(
//   {
//    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//    type:{type:String,default:""},
//    bookingId:{type:mongoose.Schema.Types.ObjectId,ref:"Booking"},
//    title:{
//       type: String,
//       required: true,
//       },
//     messages:{
//       type: String,
//       required: true,
//       },
//     seen:{type:Boolean,default:false},
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("notification", notificationSchema);


const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, default: "", index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", index: true },
    vehicleType: { type: String, default: "", index: true },  
    vehicleName: { type: String, default: "" },
    vehiclefuelType: { type: String, default: "" },
    vehicleTransmission: { type: String, default: "" },
    vehicleseatingCapacity: { type: Number, default: 0 },
    title: { type: String, required: true },
    messages: { type: String, required: true },
    seen: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound Index – Faster filter of unseen messages
notificationSchema.index({ userId: 1, seen: 1 });

module.exports = mongoose.model("notification", notificationSchema);
