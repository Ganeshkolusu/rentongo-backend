const Auto = require("../model/auto");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const Booking = require("../model/bookings");
const Availability = require("../model/avalibility");
const Review = require("../model/reviews");
const { assertCanAddVehicle } = require("../utils/subscriptionLimit");

// ===============================
// 🔹 AWS CONFIGURATION
// ===============================
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// ===============================
// ➕ CREATE AUTO
// ===============================
exports.createAuto = async (req, res) => {
  try {
    const userId = req.userId;

    try {
      await assertCanAddVehicle(userId);
    } catch (limitError) {
      return res.status(limitError.status || 500).json({ success: false, message: limitError.message });
    }

    const {
      AutoNumber,
      description,
      pricePerKm,
      contactNumber,
      contactName,
      latitude,
      longitude,
    } = req.body;

    // ✅ Required fields validation
    const requiredFields = [
      "AutoNumber",
      "pricePerKm",
      "contactNumber",
      "contactName",
      "latitude",
      "longitude",
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ success: false, message: `${field} is required` });
      }
    }

    // ✅ Unique AutoNumber check for same user
    const existingAuto = await Auto.findOne({ AutoNumber, userId });
    if (existingAuto) {
      return res.status(400).json({
        success: false,
        message: "AutoNumber already exists for this user",
      });
    }

    // ✅ Upload images to S3
    const uploadToS3 = async (files) => {
      const uploaded = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileKey = `autos/${uuidv4()}-${file.originalname}`;
          const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
         
          };
          const result = await s3.upload(params).promise();
          uploaded.push(result.Location);
        }
      }
      return uploaded;
    };

    const autoImages = await uploadToS3(req.files || []);

    // ✅ Create new Auto
    const newAuto = new Auto({
      userId,
      AutoNumber,
      description,
      pricePerKm,
      contactNumber,
      contactName,
      latitude,
      longitude,
      autoImages,
    });

    await newAuto.save();

    return res.status(201).json({
      success: true,
      message: "Auto created successfully",
      data: newAuto,
    });
  } catch (error) {
    console.error("Error creating auto:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===============================
// ✏️ UPDATE AUTO
// ===============================
exports.updateAuto = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Find auto
    const auto = await Auto.findById(id);
    if (!auto) {
      return res.status(404).json({ success: false, message: "Auto not found" });
    }

    if (auto.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You do not own this vehicle" });
    }

    const {
      AutoNumber,
      description,
      pricePerKm,
      contactNumber,
      contactName,
      latitude,
      longitude,
      Available,
    } = req.body;

    // ✅ AutoNumber uniqueness check if changed
    if (AutoNumber && AutoNumber !== auto.AutoNumber) {
      const existingAuto = await Auto.findOne({ AutoNumber, userId: auto.userId });
      if (existingAuto) {
        return res.status(400).json({
          success: false,
          message: "AutoNumber already exists for this user",
        });
      }
      auto.AutoNumber = AutoNumber;
    }

    // ✅ Upload new images if present
    const uploadToS3 = async (files) => {
      const uploaded = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileKey = `autos/${uuidv4()}-${file.originalname}`;
          const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
          };
          const result = await s3.upload(params).promise();
          uploaded.push(result.Location);
        }
      }
      return uploaded;
    };

    // ✅ Add new images (append, don’t replace)
    const newImages = await uploadToS3(req.files || []);
    if (newImages.length > 0) {
      auto.autoImages.push(...newImages);
    }

    // ✅ Update text fields
    const updatableFields = [
      "description",
      "pricePerKm",
      "contactNumber",
      "contactName",
      "latitude",
      "longitude",
      "Available",
    ];
    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        auto[field] = req.body[field];
      }
    });

    await auto.save();

    return res.json({
      success: true,
      message: "Auto updated successfully",
      data: auto,
    });
  } catch (error) {
    console.error("Error updating auto:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ❌ Delete Auto
exports.deleteAuto = async (req, res) => {
  try {
    const { id } = req.params;

    const auto = await Auto.findById(id);
    if (!auto) {
      return res.status(404).json({ success: false, message: "Auto not found" });
    }

    if (auto.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You do not own this vehicle" });
    }

    // ✅ Delete images from S3 if they exist
    if (auto.autoImages && auto.autoImages.length > 0) {
      const deleteParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Delete: {
          Objects: auto.autoImages.map((url) => ({
            Key: url.split(".amazonaws.com/")[1], // extract key from URL
          })),
          Quiet: true,
        },
      };

      try {
        await s3.deleteObjects(deleteParams).promise();
      } catch (err) {
        console.warn("Error deleting images from S3:", err.message);
      }
    }

    // ✅ Delete auto from DB
    await auto.deleteOne();

    res.json({ success: true, message: "Auto deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Distance
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Date + time
function combineDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const normalizedTime = timeStr.replace(".", ":").replace(/\s/g, "").toUpperCase();
  const match = normalizedTime.match(/^(\d{1,2}):?(\d{2})?(AM|PM)$/);
  let hours = 0, minutes = 0;
  if (match) {
    hours = parseInt(match[1]);
    minutes = parseInt(match[2]) || 0;
    const period = match[3];
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  }
  const time24 = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
  return new Date(`${dateStr}T${time24}`);
}

// exports.getNearbyAutos = async (req, res) => {
//   try {
//     const { latitude, longitude, range = 5, fromDate, toDate, fromTime, toTime } = req.query;

//     if (!latitude || !longitude) {
//       return res.status(400).json({ message: "Latitude and Longitude are required" });
//     }

//     const lat = parseFloat(latitude);
//     const lon = parseFloat(longitude);
//     const maxRange = parseFloat(range);
//     const start = combineDateTime(fromDate, fromTime);
//     const end = combineDateTime(toDate, toTime);

//     const autos = await Auto.find({ Available: true });

//     let nearbyAutos = autos
//       .map(auto => {
//         if (!auto.latitude || !auto.longitude) return null;
//         const distance = getDistance(lat, lon, parseFloat(auto.latitude), parseFloat(auto.longitude));
//         if (distance <= maxRange) return { ...auto.toObject(), distance: distance.toFixed(2) };
//         return null;
//       })
//       .filter(Boolean);

//     if (start && end) {
//       const availableAutos = [];
//       for (const auto of nearbyAutos) {
//         const autoId = auto._id.toString();
//         const hasBooking = await Booking.exists({ VechileId: autoId, FromDate: { $lte: end }, ToDate: { $gte: start } });
//         const isUnavailable = await Availability.exists({ VechileId: autoId, fromDate: { $lte: end }, toDate: { $gte: start } });
//         if (!hasBooking && !isUnavailable) availableAutos.push(auto);
//       }
//       nearbyAutos = availableAutos;
//     }

//     nearbyAutos.sort((a, b) => a.distance - b.distance);

//     return res.status(200).json({ success: true, count: nearbyAutos.length, autos: nearbyAutos });
//   } catch (error) {
//     console.error("Error fetching nearby autos:", error);
//     res.status(500).json({ success: false, message: "Server error", error: error.message });
//   }
// };


// exports.getNearbyAutos = async (req, res) => {
//   try {
//     const { latitude, longitude, range = 5, startDate, endDate } = req.query;

//     // 🔹 Validate input
//     if (!latitude || !longitude) {
//       return res.status(400).json({ message: "latitude and longitude are required" });
//     }

//     const userLat = parseFloat(latitude);
//     const userLng = parseFloat(longitude);
//     const maxDistance = parseFloat(range);
//     const start = startDate ? new Date(startDate) : null;
//     const end = endDate ? new Date(endDate) : null;

//     if (isNaN(userLat) || isNaN(userLng) || isNaN(maxDistance)) {
//       return res.status(400).json({ message: "Invalid coordinates or range" });
//     }

//     // 🔹 Step 1: Fetch autos within range using MongoDB aggregation (optimized)
//     const autos = await Auto.aggregate([
//       {
//         $addFields: {
//           latitudeNum: { $toDouble: "$latitude" },
//           longitudeNum: { $toDouble: "$longitude" },
//         },
//       },
//       {
//         $addFields: {
//           distance: {
//             $multiply: [
//               6371, // Earth's radius in km
//               {
//                 $acos: {
//                   $add: [
//                     {
//                       $multiply: [
//                         { $sin: { $degreesToRadians: userLat } },
//                         { $sin: { $degreesToRadians: "$latitudeNum" } },
//                       ],
//                     },
//                     {
//                       $multiply: [
//                         { $cos: { $degreesToRadians: userLat } },
//                         { $cos: { $degreesToRadians: "$latitudeNum" } },
//                         {
//                           $cos: {
//                             $subtract: [
//                               { $degreesToRadians: "$longitudeNum" },
//                               { $degreesToRadians: userLng },
//                             ],
//                           },
//                         },
//                       ],
//                     },
//                   ],
//                 },
//               },
//             ],
//           },
//         },
//       },
//       {
//         $match: {
//           distance: { $lte: maxDistance },
//           Available: true,
//         },
//       },
//       {
//         $sort: { distance: 1 }, // nearest first
//       },
//     ]);

//     let nearbyAutos = autos;

//     // 🔹 Step 2: If date range provided, filter by availability
//     if (start && end) {
//       const availableAutos = [];

//       for (const auto of nearbyAutos) {
//         const autoId = auto._id.toString();

//         // Check overlapping bookings
//         const hasBooking = await Booking.exists({
//           VechileId: autoId,
//           vechileType: "auto",
//           fromDate: { $lte: end },
//           toDate: { $gte: start },
//         });

//         // Check if owner marked unavailable
//         const isUnavailable = await Availability.exists({
//           VechileId: autoId,
//           vechileType: "auto",
//           fromDate: { $lte: end },
//           toDate: { $gte: start },
//         });

//         if (!hasBooking && !isUnavailable) {
//           availableAutos.push(auto);
//         }
//       }

//       nearbyAutos = availableAutos;
//     }

//     // 🔹 Step 3: Respond
//     res.status(200).json({
//       success: true,
//       message: "Nearby autos fetched successfully",
//       count: nearbyAutos.length,
//       autos: nearbyAutos,
//     });
//   } catch (error) {
//     console.error("Error fetching nearby autos:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

exports.getNearbyAutos = async (req, res) => {
  try {
    const { latitude, longitude, range = 10, fromDate, toDate, fromTime, toTime } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Latitude and Longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const maxRange = parseFloat(range);
    const start = combineDateTime(fromDate, fromTime);
    const end = combineDateTime(toDate, toTime);

    // Fetch available autos
    // Owners never see (or book) their own listings.
    const autos = await Auto.find({
      Available: true,
      status: "Verified",
      ...(req.userId && { userId: { $ne: req.userId } }),
    });

    // Filter by distance
    let nearbyAutos = autos
      .map(auto => {
        if (!auto.latitude || !auto.longitude) return null;
        const distance = getDistance(lat, lon, parseFloat(auto.latitude), parseFloat(auto.longitude));
        if (distance <= maxRange)
          return { ...auto.toObject(), distance: distance.toFixed(2) };
        return null;
      })
      .filter(Boolean);

    const availableAutos = [];

    for (const auto of nearbyAutos) {
      const autoId = auto._id;

      // Check availability (Bookings + Custom Availability) — only
      // meaningful when a date range was actually requested (matches
      // cars.js's behavior for consistency)
      let hasBooking = false;
      let isUnavailable = false;

      if (start && end) {
        hasBooking = await Booking.exists({
          VechileId: autoId,
          FromDate: { $lte: end },
          ToDate: { $gte: start },
        });

        isUnavailable = await Availability.exists({
          VechileId: autoId,
          fromDate: { $lte: end },
          toDate: { $gte: start },
        });
      }

      if (!hasBooking && !isUnavailable) {
        // Aggregate rating for this vehicle
        const ratingData = await Review.aggregate([
          { $match: { VechileId: autoId } },
          {
            $group: {
              _id: null,
              averageRating: { $avg: "$rating" },
              totalReviews: { $sum: 1 },
            },
          },
        ]);

        const avgRating = ratingData.length ? ratingData[0].averageRating.toFixed(1) : "0.0";
        const totalReviews = ratingData.length ? ratingData[0].totalReviews : 0;

        availableAutos.push({
          ...auto,
          averageRating: avgRating,
          totalReviews,
        });
      }
    }

    // Sort by distance
    availableAutos.sort((a, b) => (b.boosted - a.boosted) || (a.distance - b.distance));

    return res.status(200).json({
      success: true,
      count: availableAutos.length,
      autos: availableAutos,
    });
  } catch (error) {
    console.error("Error fetching nearby autos:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


exports.getAutobyId = async (req, res) => {
  try {
    const { id } = req.params;
    const auto = await Auto.findById(id);

    if (!auto) {
      return res.status(404).json({ message: "Auto not found" });
    }

    res.status(200).json(auto);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving auto", error: error.message });
  }
};

// exports.getAutoAvalibility=async(req,res)=>{
  
// }


