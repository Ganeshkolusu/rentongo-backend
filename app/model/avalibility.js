// const mongoose = require("mongoose");

// const AvailabilitySchema = new mongoose.Schema({
 
//   vechileType: { 
//     type: String, 
//     enum: ["Auto", "Car", "Bike"], 
//     required: true 
//   },
//   VechileId: { 
//     type: String, 
//     required: true, 
    
//   },
//   fromDate: { 
//     type: Date, 
//     required: true 
//   },
//   toDate: { 
//     type: Date, 
//     required: true 
//   },
//   fromTime: { 
//     type: String, 
//     required: true, 
//   },
//   toTime: { 
//     type: String, 
//     required: true, 
//   },
//   isNotAvailable: { 
//     type: Boolean, 
//     default: true 
//   },
// }, { timestamps: true });

// module.exports = mongoose.model("Availability", AvailabilitySchema);


// 🔹 Import mongoose
const mongoose = require("mongoose");

const AvailabilitySchema = new mongoose.Schema({
  vechileType: { 
    type: String, 
    enum: ["Auto", "Car", "Bike"], 
    required: true 
  },
  VechileId: { 
    type: String, 
    required: true, 
    // can apply reference later if needed
  },
  fromDate: { 
    type: Date, 
    required: true 
  },
  toDate: { 
    type: Date, 
    required: true 
  },
  fromTime: { 
    type: String, 
    required: true, 
  },
  toTime: { 
    type: String, 
    required: true, 
  },
  isNotAvailable: { 
    type: Boolean, 
    default: true 
  },
}, { timestamps: true });


// 🔍 **Indexes for Better Query Performance**
AvailabilitySchema.index({ vechileType: 1 });
AvailabilitySchema.index({ VechileId: 1 });
AvailabilitySchema.index({ isNotAvailable: 1 });     // filter faster
AvailabilitySchema.index({ fromDate: 1, toDate: 1 }); // date range search
AvailabilitySchema.index({ fromTime: 1, toTime: 1 }); // time-based check



module.exports = mongoose.model("Availability", AvailabilitySchema);
