const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const sharp = require("sharp");
const { execFile } = require("child_process");
const Bike = require("../model/bikes");

const Booking = require("../model/bookings");
const Availability = require("../model/avalibility");
const Review = require("../model/reviews");
const User = require("../model/user");
const admin = require("../../config/firebase");
const multer = require("multer");
const { assertCanAddVehicle } = require("../utils/subscriptionLimit");

// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3(); // Initialize S3 instance

// exports.createBike = async (req, res) => {
//   try {
//     const {
//       userId,
//       bikeNumber,
//       description,
//       pricePerKm,
//       contactNumber,
//       contactName,
//       latitude,
//       longitude,
//       InsuranceNo,
//       bikeName,
//       bikeModel,
//       pickupCityCountry,
//       pickupCityState,
//       pickupCityPinCode,
//       pickupCity,
//       pickupArea,
//     } = req.body;

//     // ✅ Validate required fields
//     const requiredFields = [
//       "userId",
//       "bikeNumber",
//       "pricePerKm",
//       "contactNumber",
//       "contactName",
//       "latitude",
//       "longitude",
//       "InsuranceNo",
//       "bikeName",
//       "bikeModel",
//       "pickupCityCountry",
//       "pickupCityState",
//       "pickupCityPinCode",
//       "pickupCity",
//       "pickupArea",
//     ];

//     for (const field of requiredFields) {
//       if (!req.body[field]) {
//         return res.status(400).json({ message: `${field} is required` });
//       }
//     }

//     // ✅ Check for unique bike number
//     const existingBike = await Bike.findOne({ bikeNumber });
//     if (existingBike) {
//       return res.status(400).json({ message: "bikeNumber already exists" });
//     }

//     // ===================================================
//     // 🔹 Upload Images using /upload API
//     // ===================================================
//     let uploadedImages = [];

//     if (req.files && req.files.length > 0) {
//       try {
//         const formData = new FormData();
//         formData.append("vehicle_id", bikeNumber);

//         // Append all image files
//         req.files.forEach((file) => {
//           formData.append("images", file.buffer, {
//             filename: `${uuidv4()}-${file.originalname}`,
//             contentType: file.mimetype,
//           });
//         });

//         const uploadResponse = await axios.post("http://localhost:5000/upload", formData, {
//           headers: {
//             ...formData.getHeaders(),
//           },
//           maxBodyLength: Infinity,
//           maxContentLength: Infinity,
//         });

//         // ✅ Extract only processed_url from each result
//         if (uploadResponse.data?.results?.length > 0) {
//           uploadedImages = uploadResponse.data.results
//             .filter((r) => r.success && r.processed_url)
//             .map((r) => r.processed_url);
//         } else {
//           console.warn("⚠️ No valid processed URLs returned from upload API");
//         }
//       } catch (uploadError) {
//         console.error("❌ Image upload failed:", uploadError.message);
//         return res.status(500).json({
//           message: "Image upload failed",
//           error: uploadError.message,
//         });
//       }
//     }

//     // ===================================================
//     // 🔹 Save Bike to MongoDB
//     // ===================================================
//     const newBike = new Bike({
//       userId,
//       bikeNumber,
//       description,
//       pricePerKm,
//       contactNumber,
//       contactName,
//       latitude,
//       longitude,
//       InsuranceNo,
//       bikeName,
//       bikeModel,
//       bikeImages: uploadedImages, // ✅ Store only processed URLs
//       pickupCityCountry,
//       pickupCityState,
//       pickupCityPinCode,
//       pickupCity,
//       pickupArea,
//     });

//     await newBike.save();

//     // ===================================================
//     // ✅ Success Response
//     // ===================================================
//     res.status(201).json({
//       message: "✅ Bike registered successfully",
//       bike: newBike,
//     });
//   } catch (error) {
//     console.error("🔥 Error creating bike:", error);
//     res.status(500).json({
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

exports.createBike = async (req, res) => {
  try {
    const userId = req.userId;

    try {
      await assertCanAddVehicle(userId);
    } catch (limitError) {
      return res.status(limitError.status || 500).json({ message: limitError.message });
    }

    const {
      bikeNumber,
      description,
      pricePerKm,
      contactNumber,
      contactName,
      latitude,
      longitude,
      InsuranceNo,
      bikeName,
      bikeModel,
        pickupCityCountry,
        pickupCityState,
        pickupCityPinCode,
        pickupCity,
        pickupArea,
    } = req.body;

    // 🔸 Required fields validation
    const requiredFields = [
      "bikeNumber",
      "pricePerKm",
      "contactNumber",
      "contactName",
      "latitude",
      "longitude",
      "InsuranceNo",
      "bikeName",
      "bikeModel",
      "pickupCityCountry",
      "pickupCityState",
      "pickupCityPinCode",
      "pickupCity",
      "pickupArea",
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // 🔸 Unique bike number check
    const existingBike = await Bike.findOne({ bikeNumber });
    if (existingBike) {
      return res.status(400).json({ message: "bikeNumber already exists" });
    }

    // ✅ Upload images to S3
       const uploadedImages = [];
       if (req.files && req.files.length > 0) {
         for (const file of req.files) {
           const fileKey = `${userId}/bikes/${uuidv4()}-${file.originalname}`;
           const params = {
             Bucket: process.env.S3_BUCKET_NAME,
             Key: fileKey,
             Body: file.buffer,
             ContentType: file.mimetype,
            // ACL: "public-read",
           };
   
           const uploadResult = await s3.upload(params).promise();
           uploadedImages.push(uploadResult.Location);
         }
       }
    // const RcImages = req.files?.RcImages
    //   ? await uploadToS3(req.files.RcImages, "rc")
    //   : [];

    // 🔸 Create new Bike document
    const newBike = new Bike({
      userId,
      bikeNumber,
      description,
      pricePerKm,
      contactNumber,
      contactName,
      latitude,
      longitude,
      InsuranceNo,
      bikeName,
      bikeModel,
      bikeImages:uploadedImages,
        pickupCityCountry,
        pickupCityState,
        pickupCityPinCode,
        pickupCity,
        pickupArea,
    });

    await newBike.save();

    res
      .status(201)
      .json({ message: "Bike registered successfully", bike: newBike });
  } catch (error) {
    console.error("Error creating bike:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ===============================
// ✅ Update Bike API
// exports.updateBike = async (req, res) => {
//   try {
//     const { id } = req.params;

//     // 🔹 Check if the bike exists
//     const existingBike = await Bike.findById(id);
//     if (!existingBike) {
//       return res.status(404).json({ message: "Bike not found" });
//     }

//     // 🔹 Helper function to upload to S3
//     const uploadToS3 = async (files, folderName) => {
//       const uploadedUrls = [];
//       for (const file of files) {
//         const fileKey = `${folderName}/${uuidv4()}-${file.originalname}`;
//         const params = {
//           Bucket: process.env.S3_BUCKET_NAME,
//           Key: fileKey,
//           Body: file.buffer,
//           ContentType: file.mimetype,
//          // ACL: "public-read",
//         };
//         const result = await s3.upload(params).promise();
//         uploadedUrls.push(result.Location);
//       }
//       return uploadedUrls;
//     };

//     // 🔹 Upload new files if provided
//     if (req.files && req.files["bikeImages"]) {
//       const uploadedBikeImages = await uploadToS3(req.files["bikeImages"], "bikes");
//       existingBike.bikeImages.push(...uploadedBikeImages);
//     }

//     // if (req.files && req.files["RcImages"]) {
//     //   const uploadedRcImages = await uploadToS3(req.files["RcImages"], "rc");
//     //   existingBike.RcImages.push(...uploadedRcImages);
//     // }

//     // 🔹 Update allowed fields
//     const updatableFields = [
//       "bikeNumber",
//       "description",
//       "pricePerKm",
//       "contactNumber",
//       "contactName",
//       "latitude",
//       "longitude",
//       "InsuranceNo",
//       "bikeName",
//       "bikeModel",
//       "Available",
//         "pickupCityCountry",
//       "pickupCityState",
//       "pickupCityPinCode",
//       "pickupCity",
//       "pickupArea",

//     ];

//     for (const field of updatableFields) {
//       if (req.body[field] !== undefined && req.body[field] !== "") {
//         existingBike[field] = req.body[field];
//       }
//     }

//     await existingBike.save();

//     res.status(200).json({
//       message: "Bike updated successfully",
//       bike: existingBike,
//     });
//   } catch (error) {
//     console.error("Error updating bike:", error);
//     res.status(500).json({
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

exports.updateBike = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔹 Check if bike exists
    const existingBike = await Bike.findById(id);
    if (!existingBike) {
      return res.status(404).json({ message: "Bike not found" });
    }

    if (existingBike.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this vehicle" });
    }
    delete req.body.userId;

    // 🔹 Check unique bikeNumber (only if changed)
    if (
      req.body.bikeNumber &&
      req.body.bikeNumber !== existingBike.bikeNumber
    ) {
      const checkBike = await Bike.findOne({
        bikeNumber: req.body.bikeNumber,
      });

      if (checkBike) {
        return res
          .status(400)
          .json({ message: "bikeNumber already exists" });
      }
    }

    // -----------------------------
    // Helpers
    // -----------------------------

    // 🔹 Delete images from S3
    const deleteFromS3 = async (imageUrls) => {
      for (const url of imageUrls) {
        const key = url.split(".amazonaws.com/")[1];
        if (key) {
          await s3
            .deleteObject({
              Bucket: process.env.S3_BUCKET_NAME,
              Key: key,
            })
            .promise();
        }
      }
    };
    const userId = existingBike.userId;

    // 🔹 Upload images to S3
    const uploadToS3 = async (files) => {
      const uploadedImages = [];
      for (const file of files) {
        const fileKey = `${userId}/bikes/${uuidv4()}-${file.originalname}`;
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        };
        const result = await s3.upload(params).promise();
        uploadedImages.push(result.Location);
      }
      return uploadedImages;
    };

    // -----------------------------
    // Handle Image Update
    // -----------------------------
    // Owner may explicitly remove specific existing photos (JSON array of
    // URLs). Newly uploaded files are appended rather than replacing
    // everything — editing details or adding one photo must never silently
    // delete the rest.
    let removeImages = [];
    if (req.body.removeImages) {
      try {
        const parsed = JSON.parse(req.body.removeImages);
        if (Array.isArray(parsed)) removeImages = parsed;
      } catch (e) {
        // ignore malformed input
      }
    }

    let newImages = existingBike.bikeImages || [];

    if (removeImages.length > 0) {
      const toDelete = newImages.filter((url) => removeImages.includes(url));
      if (toDelete.length > 0) {
        await deleteFromS3(toDelete);
      }
      newImages = newImages.filter((url) => !removeImages.includes(url));
    }

    if (req.files && req.files.length > 0) {
      const uploaded = await uploadToS3(req.files);
      newImages = [...newImages, ...uploaded];
    }

    // -----------------------------
    // Updatable Fields
    // -----------------------------
    const fields = [
      "userId",
      "bikeNumber",
      "description",
      "pricePerKm",
      "contactNumber",
      "contactName",
      "latitude",
      "longitude",
      "InsuranceNo",
      "bikeName",
      "bikeModel",
      "pickupCityCountry",
      "pickupCityState",
      "pickupCityPinCode",
      "pickupCity",
      "pickupArea",
    ];

    fields.forEach((field) => {
      if (
        req.body[field] !== undefined &&
        req.body[field] !== "" &&
        req.body[field] !== null
      ) {
        existingBike[field] = req.body[field];
      }
    });

    // Assign updated images
    existingBike.bikeImages = newImages;

    // Save final update
    await existingBike.save();

    res.status(200).json({
      message: "Bike updated successfully",
      bike: existingBike,
    });
  } catch (error) {
    console.error("Error updating bike:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// ===============================
// 🟢 GET BIKE BY ID
// ===============================
exports.getBikeById = async (req, res) => {
  try {
    const { id } = req.params;
    const bike = await Bike.findById(id);

    if (!bike) {
      return res.status(404).json({ message: "Bike not found" });
    }

    res.status(200).json({ message: "Bike fetched successfully", bike });
  } catch (error) {
    console.error("Error fetching bike:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// // 🔹 Helper: Haversine Distance Function
// function getDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371; // Radius of Earth in km
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLon = ((lon2 - lon1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.sin(dLon / 2) ** 2;
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }

// // ===============================
// // 🧭 GET NEAREST BIKES
// // ===============================
// exports.getNearestBikes = async (req, res) => {
//   try {
//     const {
//       latitude,
//       longitude,
//       range = 5, // default 5 km
//       bikeModel,
//       bikeName,
//       priceMin,
//       priceMax,
//       startDate,
//       endDate,
//     } = req.query;

//     // 🔹 Validate input
//     if (!latitude || !longitude) {
//       return res.status(400).json({ message: "Latitude and Longitude are required" });
//     }

//     const lat = parseFloat(latitude);
//     const lng = parseFloat(longitude);
//     const rangeKm = parseFloat(range);
//     const start = startDate ? new Date(startDate) : null;
//     const end = endDate ? new Date(endDate) : null;

//     if (isNaN(lat) || isNaN(lng) || isNaN(rangeKm)) {
//       return res.status(400).json({ message: "Invalid coordinates or range" });
//     }

//     // 🔹 Step 1: Build MongoDB query for available bikes
//     const query = { Available: true };
//     if (bikeModel) query.description = { $regex: bikeModel, $options: "i" };
//     if (bikeName) query.bikeNumber = { $regex: bikeName, $options: "i" };

//     if (priceMin || priceMax) {
//       query.pricePerKm = {};
//       if (priceMin) query.pricePerKm.$gte = parseFloat(priceMin);
//       if (priceMax) query.pricePerKm.$lte = parseFloat(priceMax);
//     }

//     // 🔹 Step 2: Fetch bikes from DB
//     const allBikes = await Bike.find(query);

//     // 🔹 Step 3: Filter bikes within range
//     let nearbyBikes = allBikes
//       .map((bike) => {
//         const bikeLat = parseFloat(bike.latitude);
//         const bikeLng = parseFloat(bike.longitude);
//         if (isNaN(bikeLat) || isNaN(bikeLng)) return null;

//         const distance = getDistance(lat, lng, bikeLat, bikeLng);
//         if (distance <= rangeKm) {
//           return { ...bike.toObject(), distance: distance.toFixed(2) };
//         }
//         return null;
//       })
//       .filter(Boolean);

//     // 🔹 Step 4: Check availability if date range provided
//     if (start && end) {
//       const availableBikes = [];

//       for (const bike of nearbyBikes) {
//         const bikeId = bike._id.toString();

//         // Check if any booking overlaps with the requested period
//         const hasBooking = await Booking.exists({
//           VechileId: bikeId,
//           vechileType: "bike",
//           fromDate: { $lte: end },
//           toDate: { $gte: start },
//         });

//         // Check if marked unavailable
//         const isUnavailable = await Availability.exists({
//           VechileId: bikeId,
//           vechileType: "bike",
//           fromDate: { $lte: end },
//           toDate: { $gte: start },
//         });

//         if (!hasBooking && !isUnavailable) {
//           availableBikes.push(bike);
//         }
//       }

//       nearbyBikes = availableBikes;
//     }

//     // 🔹 Step 5: Sort by distance
//     nearbyBikes.sort((a, b) => a.distance - b.distance);

//     // 🔹 Step 6: Send Response
//     res.status(200).json({
//       success: true,
//       message: "Nearest bikes fetched successfully",
//       count: nearbyBikes.length,
//       bikes: nearbyBikes,
//     });
//   } catch (error) {
//     console.error("Error fetching nearest bikes:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };


// Haversine distance
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

// Combine date + time
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

// exports.getNearestBikes = async (req, res) => {
//   try {
//     const {
//       latitude,
//       longitude,
//       range = 5,
//       bikeModel,
//       bikeName,
//       priceMin,
//       priceMax,
//       fromDate,
//       toDate,
//       fromTime,
//       toTime,
//     } = req.query;

//     if (!latitude || !longitude) {
//       return res.status(400).json({ message: "Latitude and Longitude are required" });
//     }

//     const lat = parseFloat(latitude);
//     const lon = parseFloat(longitude);
//     const maxRange = parseFloat(range);
//     const start = combineDateTime(fromDate, fromTime);
//     const end = combineDateTime(toDate, toTime);

//     let bikes = await Bike.find({ Available: true });

//     if (bikeModel)
//       bikes = bikes.filter(b => b.description?.toLowerCase().includes(bikeModel.toLowerCase()));
//     if (bikeName)
//       bikes = bikes.filter(b => b.bikeNumber?.toLowerCase().includes(bikeName.toLowerCase()));
//     if (priceMin || priceMax)
//       bikes = bikes.filter(b => (priceMin ? b.pricePerKm >= priceMin : true) && (priceMax ? b.pricePerKm <= priceMax : true));

//     // Distance filter
//     let nearbyBikes = bikes
//       .map(bike => {
//         if (!bike.latitude || !bike.longitude) return null;
//         const distance = getDistance(lat, lon, parseFloat(bike.latitude), parseFloat(bike.longitude));
//         if (distance <= maxRange) return { ...bike.toObject(), distance: distance.toFixed(2) };
//         return null;
//       })
//       .filter(Boolean);

//     // Availability filter
//     if (start && end) {
//       const availableBikes = [];
//       for (const bike of nearbyBikes) {
//         const bikeId = bike._id.toString();
//         const hasBooking = await Booking.exists({ VechileId: bikeId, FromDate: { $lte: end }, ToDate: { $gte: start } });
//         const isUnavailable = await Availability.exists({ VechileId: bikeId, fromDate: { $lte: end }, toDate: { $gte: start } });
//         if (!hasBooking && !isUnavailable) availableBikes.push(bike);
//       }
//       nearbyBikes = availableBikes;
//     }

//     nearbyBikes.sort((a, b) => a.distance - b.distance);

//     return res.status(200).json({ success: true, count: nearbyBikes.length, bikes: nearbyBikes });
//   } catch (error) {
//     console.error("Error fetching nearest bikes:", error);
//     res.status(500).json({ success: false, message: "Server error", error: error.message });
//   }
// };

exports.getNearestBikes = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      range,
      bikeModel,
      bikeName,
      priceMin,
      priceMax,
      fromDate,
      toDate,
      fromTime,
      toTime,
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Latitude and Longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const maxRange = parseFloat(range);
    const start = combineDateTime(fromDate, fromTime);
    const end = combineDateTime(toDate, toTime);

    // Fetch available bikes
    // Owners never see (or book) their own listings.
    let bikes = await Bike.find({
      Available: true,
      status: "Verified",
      ...(req.userId && { userId: { $ne: req.userId } }),
    });

    // Optional filters
    if (bikeModel)
      bikes = bikes.filter(b => b.description?.toLowerCase().includes(bikeModel.toLowerCase()));
    if (bikeName)
      bikes = bikes.filter(b => b.bikeNumber?.toLowerCase().includes(bikeName.toLowerCase()));
    if (priceMin || priceMax)
      bikes = bikes.filter(b =>
        (priceMin ? b.pricePerKm >= priceMin : true) &&
        (priceMax ? b.pricePerKm <= priceMax : true)
      );

    // Filter by distance
    let nearbyBikes = bikes
      .map(bike => {
        if (!bike.latitude || !bike.longitude) return null;
        const distance = getDistance(lat, lon, parseFloat(bike.latitude), parseFloat(bike.longitude));
        if (distance <= maxRange)
          return { ...bike.toObject(), distance: distance.toFixed(2) };
        return null;
      })
      .filter(Boolean);

    const availableBikes = [];

    for (const bike of nearbyBikes) {
      const bikeId = bike._id;

      // Check bookings and availability — only meaningful when a date range
      // was actually requested (matches cars.js's behavior for consistency)
      let hasBooking = false;
      let isUnavailable = false;

      if (start && end) {
        hasBooking = await Booking.exists({
          VechileId: bikeId,
          FromDate: { $lte: end },
          ToDate: { $gte: start },
        });

        isUnavailable = await Availability.exists({
          VechileId: bikeId,
          fromDate: { $lte: end },
          toDate: { $gte: start },
        });
      }

      if (!hasBooking && !isUnavailable) {
        // Ensure correct ObjectId matching
        const ratingData = await Review.aggregate([
          { $match: { VechileId: bikeId } },
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

        availableBikes.push({
          ...bike,
          averageRating: avgRating,
          totalReviews,
        });
      }
    }

    // Sort by distance
    availableBikes.sort((a, b) => (b.boosted - a.boosted) || (a.distance - b.distance));

    return res.status(200).json({
      success: true,
      count: availableBikes.length,
      bikes: availableBikes,
    });
  } catch (error) {
    console.error("Error fetching nearest bikes:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

exports.deleteBikes = async (req, res) => {
  try {
    const BikeId = req.params.id;
    const Bikes = await Bike.findById(BikeId);
    if (!Bikes) {
      return res.status(404).json({ message: "Bike not found" });
    }
    if (Bikes.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this vehicle" });
    }
    await Bike.findByIdAndDelete(BikeId);
    res.status(200).json({ message: "Bike deleted successfully" });
  } catch (error) {
    console.error("Error deleting bike:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }     
};