const Car = require("../model/car");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const AWS = require("aws-sdk");
const Booking = require("../model/bookings");
const Availability = require("../model/avalibility");
const Review = require("../model/reviews");
const { assertCanAddVehicle } = require("../utils/subscriptionLimit");


// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3(); // Initialize S3 instance

// ----------------- Create Car -----------------
exports.createCar = async (req, res) => {
  try {
    const userId = req.userId;

    try {
      await assertCanAddVehicle(userId);
    } catch (limitError) {
      return res.status(limitError.status || 500).json({ message: limitError.message });
    }

    const {
      CarName,
      CarModel,
      CarNumber,
      Carseater,
      fuelType,
      transmissionType,
      kmDriven,
      Ac_available,
      description,
      RentPerHour,
      RentPerDay,
      contactNumber,
      contactName,
      drivingLicenseRequired,
      AadharCardRequired,
      DepositAmount,
      DepositVehicle,
      pickupLatitude,
      pickupLongitude,
      pickupArea,
      pickupCity,
      pickupCityPinCode,
      pickupCityState,
      pickupCityCountry,
      driverAvailable,
      driverFee,
    } = req.body;

    // ✅ Required Fields Validation
    const requiredFields = [
      "CarName",
      "CarModel",
      "CarNumber",
      "fuelType",
      "Carseater",
      "transmissionType",
      "kmDriven",
      "RentPerHour",
      "RentPerDay",
      "contactNumber",
      "contactName",
      "DepositAmount",
      "pickupLatitude",
      "pickupLongitude",
      "pickupArea",
      "pickupCity",
      "pickupCityPinCode",
      "pickupCityState",
      "pickupCityCountry",
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // ✅ Check if CarNumber already exists for this user
    const existingCar = await Car.findOne({ CarNumber, userId });
    if (existingCar) {
      return res
        .status(400)
        .json({ message: "CarNumber already exists for this user" });
    }

    // ✅ Upload images to S3
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileKey = `${userId}/cars/${uuidv4()}-${file.originalname}`;
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

    // ✅ Create Car document
    const newCar = new Car({
      userId,
      CarName,
      CarModel,
      CarNumber,
      fuelType,
      Carseater,
      transmissionType,
      kmDriven,
      Ac_available,
      description,
      RentPerHour,
      RentPerDay,
      contactNumber,
      contactName,
      drivingLicenseRequired,
      AadharCardRequired,
      DepositAmount,
      DepositVehicle,
      pickupLatitude,
      pickupLongitude,
      pickupArea,
      pickupCity,
      pickupCityPinCode,
      pickupCityState,
      pickupCityCountry,
      carImages: uploadedImages,
      driverAvailable: driverAvailable === true || driverAvailable === "true",
      driverFee: driverAvailable === true || driverAvailable === "true" ? Number(driverFee) || 0 : 0,
    });

    await newCar.save();

    res
      .status(201)
      .json({ message: "Car created successfully", car: newCar });
  } catch (error) {
    console.error("Error creating car:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateCar = async (req, res) => {
  try {
    const carId = req.params.id;
    const updates = { ...req.body };

    // 🔹 Check if car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    if (car.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this vehicle" });
    }
    delete updates.userId;
    delete updates._id;
const userId = car.userId;
    // 🔹 Convert numeric fields
    const numericFields = ["kmDriven", "RentPerHour", "RentPerDay", "DepositAmount", "driverFee"];
    numericFields.forEach((field) => {
      if (updates[field] !== undefined && updates[field] !== "") {
        updates[field] = Number(updates[field]);
      }
    });

    // 🔹 Convert boolean fields
    const booleanFields = [
      "Ac_available",
      "drivingLicenseRequired",
      "AadharCardRequired",
      "DepositVehicle",
      "driverAvailable",
    ];
    booleanFields.forEach((field) => {
      if (updates[field] !== undefined) {
        updates[field] =
          updates[field] === true ||
          updates[field] === "true" ||
          updates[field] === 1 ||
          updates[field] === "1";
      }
    });

    // 🔹 Check for unique CarNumber
    if (updates.CarNumber && updates.CarNumber !== car.CarNumber) {
      const existingCar = await Car.findOne({ CarNumber: updates.CarNumber });
      if (existingCar) {
        return res.status(400).json({ message: "CarNumber already exists" });
      }
    }

    // Owner may explicitly remove specific existing photos (JSON array of URLs,
    // e.g. from the "remove" button on an existing photo in the edit form).
    // Newly uploaded files are appended rather than replacing everything —
    // editing details or adding one photo must never silently delete the rest.
    let removeImages = [];
    if (updates.removeImages) {
      try {
        const parsed = JSON.parse(updates.removeImages);
        if (Array.isArray(parsed)) removeImages = parsed;
      } catch (e) {
        // ignore malformed input
      }
    }
    delete updates.removeImages;

    let currentImages = car.carImages || [];

    if (removeImages.length > 0) {
      const toDelete = currentImages.filter((url) => removeImages.includes(url));
      for (const imgUrl of toDelete) {
        const key = imgUrl.split(".amazonaws.com/")[1]; // extract S3 key
        if (key) {
          await s3
            .deleteObject({
              Bucket: process.env.S3_BUCKET_NAME,
              Key: key,
            })
            .promise();
        }
      }
      currentImages = currentImages.filter((url) => !removeImages.includes(url));
    }

    if (req.files && req.files.length > 0) {
      const newImageUrls = [];
      for (const file of req.files) {
        const fileKey = `${userId}/cars/${uuidv4()}-${file.originalname}`;

        const uploadResult = await s3
          .upload({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
          .promise();

        newImageUrls.push(uploadResult.Location);
      }
      currentImages = [...currentImages, ...newImageUrls];
    }

    if (removeImages.length > 0 || (req.files && req.files.length > 0)) {
      updates.carImages = currentImages;
    }

    // 🔹 Update car
    const updatedCar = await Car.findByIdAndUpdate(carId, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      message: "Car updated successfully",
      car: updatedCar,
    });
  } catch (error) {
    console.error("Error updating car:", error);
    return res.status(500).json({
      message: "Server error while updating car",
      error: error.message,
    });
  }
};


// exports.updateCar = async (req, res) => {
//   try {
//     const carId = req.params.id;
//     const updates = { ...req.body };

//     // 🔹 Check if car exists
//     const car = await Car.findById(carId);
//     if (!car) {
//       return res.status(404).json({ message: "Car not found" });
//     }

//     // 🔹 Parse numeric fields safely
//     const numericFields = ["kmDriven", "RentPerHour", "RentPerDay", "DepositAmount"];
//     numericFields.forEach((field) => {
//       if (updates[field] !== undefined && updates[field] !== "")
//         updates[field] = Number(updates[field]);
//     });

//     // 🔹 Parse boolean fields
//     const booleanFields = [
//       "Ac_available",
//       "drivingLicenseRequired",
//       "AadharCardRequired",
//       "DepositVehicle",
//     ];
//     booleanFields.forEach((field) => {
//       if (updates[field] !== undefined)
//         updates[field] =
//           updates[field] === true ||
//           updates[field] === "true" ||
//           updates[field] === 1 ||
//           updates[field] === "1";
//     });

//     // 🔹 Check for unique CarNumber
//     if (updates.CarNumber && updates.CarNumber !== car.CarNumber) {
//       const existingCar = await Car.findOne({ CarNumber: updates.CarNumber });
//       if (existingCar) {
//         return res.status(400).json({ message: "CarNumber already exists" });
//       }
//     }

//     // 🔹 Handle new image uploads
//     if (req.files && req.files.length > 0) {
//       const uploadedImages = [];

//       for (const file of req.files) {
//         const fileKey = `cars/${uuidv4()}-${file.originalname}`;
//         const params = {
//           Bucket: process.env.S3_BUCKET_NAME,
//           Key: fileKey,
//           Body: file.buffer,
//           ContentType: file.mimetype,
//          // ACL: "public-read",
//         };

//         const uploadResult = await s3.upload(params).promise();
//         uploadedImages.push(uploadResult.Location);
//       }

//       // Append new images to existing ones
//       updates.carImages = Array.isArray(car.carImages)
//         ? [...car.carImages, ...uploadedImages]
//         : uploadedImages;
//     }

//     // 🔹 Update and return latest document
//     const updatedCar = await Car.findByIdAndUpdate(carId, updates, { new: true, runValidators: true });

//     return res.status(200).json({
//       message: "Car updated successfully",
//       car: updatedCar,
//     });
//   } catch (error) {
//     console.error("Error updating car:", error);
//     return res.status(500).json({
//       message: "Server error while updating car",
//       error: error.message,
//     });
//   }
// };



// // Utility to calculate distance between two coordinates
// function getDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371; // km
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLon = ((lon2 - lon1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.sin(dLon / 2) *
//       Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }

// exports.getNearbyCars = async (req, res) => {
//   try {
//     let {
//       latitude,
//       longitude,
//       range = 10, // default 10 km
//       priceMin,
//       priceMax,
//       carName,
//       fuelType,
//       transmissionType,
//       startDate,
//       endDate,
//     } = req.query;

//     // 🔹 Validate coordinates
//     if (!latitude || !longitude) {
//       return res
//         .status(400)
//         .json({ message: "latitude and longitude are required" });
//     }

//     const lat = parseFloat(latitude);
//     const lon = parseFloat(longitude);
//     const maxRange = parseFloat(range);
//     const start = startDate ? new Date(startDate) : null;
//     const end = endDate ? new Date(endDate) : null;

//     if (isNaN(lat) || isNaN(lon) || isNaN(maxRange)) {
//       return res.status(400).json({ message: "Invalid coordinates or range" });
//     }

//     // 🔹 Build MongoDB filter
//     const filter = {};
//     if (fuelType) filter.fuelType = fuelType;
//     if (transmissionType) filter.transmissionType = transmissionType;
//     if (carName) filter.CarName = { $regex: carName, $options: "i" };

//     if (priceMin || priceMax) {
//       filter.RentPerDay = {};
//       if (priceMin) filter.RentPerDay.$gte = parseFloat(priceMin);
//       if (priceMax) filter.RentPerDay.$lte = parseFloat(priceMax);
//     }

//     // 🔹 Fetch cars matching filters
//     const cars = await Car.find(filter, {
//       CarName: 1,
//       RentPerDay: 1,
//       kmDriven: 1,
//       Carseater: 1,
//       description: 1,
//       pickupLatitude: 1,
//       pickupLongitude: 1,
//       carImages: 1,
//       fuelType: 1,
//       transmissionType: 1,
//     });

//     // 🔹 Filter by nearby distance
//     let nearbyCars = cars
//       .map((car) => {
//         if (!car.pickupLatitude || !car.pickupLongitude) return null;

//         const carLat = parseFloat(car.pickupLatitude);
//         const carLon = parseFloat(car.pickupLongitude);
//         const distance = getDistance(lat, lon, carLat, carLon);

//         if (distance <= maxRange) {
//           return { ...car.toObject(), distance: distance.toFixed(2) };
//         }
//         return null;
//       })
//       .filter(Boolean);

//     // 🔹 If date filters provided, check availability
//     if (start && end) {
//       const availableCars = [];

//       for (const car of nearbyCars) {
//         const carId = car._id.toString();

//         // Check bookings overlapping the date range
//         const hasBooking = await Booking.exists({
//           VechileId: carId,
//           fromDate: { $lte: end },
//           toDate: { $gte: start },
//         });

//         // Check unavailability by owner
//         const isUnavailable = await Availability.exists({
//           VechileId: carId,
//           fromDate: { $lte: end },
//           toDate: { $gte: start },
//         });

//         if (!hasBooking && !isUnavailable) {
//           availableCars.push(car);
//         }
//       }

//       nearbyCars = availableCars;
//     }

//     // 🔹 Sort by nearest distance
//     nearbyCars.sort((a, b) => a.distance - b.distance);

//     return res.status(200).json({
//       success: true,
//       count: nearbyCars.length,
//       cars: nearbyCars,
//     });
//   } catch (error) {
//     console.error("Error fetching nearby cars:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };


// Haversine formula
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

// Combine date + time string to JS Date
function combineDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;

  const normalizedTime = timeStr.replace(".", ":").replace(/\s/g, "").toUpperCase();
  const match = normalizedTime.match(/^(\d{1,2}):?(\d{2})?(AM|PM)$/);
  let hours = 0,
    minutes = 0;

  if (match) {
    hours = parseInt(match[1]);
    minutes = parseInt(match[2]) || 0;
    const period = match[3];
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  }

  const time24 = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;
  return new Date(`${dateStr}T${time24}`);
}

// exports.getNearbyCars = async (req, res) => {
//   try {
//     const {
//       latitude,
//       longitude,
//       range = 10,
//       priceMin,
//       priceMax,
//       carName,
//       fuelType,
//       transmissionType,
//       fromDate,
//       toDate,
//       fromTime,
//       toTime,
//     } = req.query;

//     if (!latitude || !longitude) {
//       return res.status(400).json({ message: "latitude and longitude are required" });
//     }

//     const lat = parseFloat(latitude);
//     const lon = parseFloat(longitude);
//     const maxRange = parseFloat(range);
//     const start = combineDateTime(fromDate, fromTime);
//     const end = combineDateTime(toDate, toTime);

//     // Build filter
//     const filter = {};
//     if (fuelType) filter.fuelType = fuelType;
//     if (transmissionType) filter.transmissionType = transmissionType;
//     if (carName) filter.CarName = { $regex: carName, $options: "i" };
//     if (priceMin || priceMax) {
//       filter.RentPerDay = {};
//       if (priceMin) filter.RentPerDay.$gte = parseFloat(priceMin);
//       if (priceMax) filter.RentPerDay.$lte = parseFloat(priceMax);
//     }

//     const cars = await Car.find(filter, {
//       CarName: 1,
//       RentPerDay: 1,
//       kmDriven: 1,
//       Carseater: 1,
//       description: 1,
//       pickupLatitude: 1,
//       pickupLongitude: 1,
//       carImages: 1,
//       fuelType: 1,
//       transmissionType: 1,
//     });

//     let nearbyCars = cars
//       .map((car) => {
//         if (!car.pickupLatitude || !car.pickupLongitude) return null;
//         const carLat = parseFloat(car.pickupLatitude);
//         const carLon = parseFloat(car.pickupLongitude);
//         const distance = getDistance(lat, lon, carLat, carLon);
//         if (distance <= maxRange) return { ...car.toObject(), distance: distance.toFixed(2) };
//         return null;
//       })
//       .filter(Boolean);

//     // Filter by availability
//     if (start && end) {
//       const availableCars = [];
//       for (const car of nearbyCars) {
//         const carId = car._id.toString();

//         const hasBooking = await Booking.exists({
//           VechileId: carId,
//           FromDate: { $lte: end },
//           ToDate: { $gte: start },
//         });

//         const isUnavailable = await Availability.exists({
//           VechileId: carId,
//           fromDate: { $lte: end },
//           toDate: { $gte: start },
//         });

//         if (!hasBooking && !isUnavailable) availableCars.push(car);
//       }
//       nearbyCars = availableCars;
//     }

//     nearbyCars.sort((a, b) => a.distance - b.distance);

//     return res.status(200).json({ success: true, count: nearbyCars.length, cars: nearbyCars });
//   } catch (error) {
//     console.error("Error fetching nearby cars:", error);
//     return res.status(500).json({ success: false, message: "Server error", error: error.message });
//   }
// };

exports.getNearbyCars = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      range = 10,
      priceMin,
      priceMax,
      carName,
      fuelType,
      transmissionType,
      fromDate,
      toDate,
      fromTime,
      toTime,
    } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: "latitude and longitude are required" });
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const maxRange = parseFloat(range);
    const start = combineDateTime(fromDate, fromTime);
    const end = combineDateTime(toDate, toTime);

    // Base filters
    const filter = {status: "Verified"};
    // Owners never see (or book) their own listings.
    if (req.userId) filter.userId = { $ne: req.userId };
    if (fuelType) filter.fuelType = fuelType;
    if (transmissionType) filter.transmissionType = transmissionType;
    if (carName) filter.CarName = { $regex: carName, $options: "i" };
    if (priceMin || priceMax) {
      filter.RentPerDay = {};
      if (priceMin) filter.RentPerDay.$gte = parseFloat(priceMin);
      if (priceMax) filter.RentPerDay.$lte = parseFloat(priceMax);
    }

    // Fetch cars
    const cars = await Car.find(filter, {
      CarName: 1,
      RentPerDay: 1,
      kmDriven: 1,
      Carseater: 1,
      description: 1,
      pickupLatitude: 1,
      pickupLongitude: 1,
      pickupArea: 1,
      pickupCity: 1,
      pickupCityState: 1,
      pickupCityCountry: 1,
      pickupCityPinCode: 1,
      carImages: 1,
      fuelType: 1,
      transmissionType: 1,
      status: 1

    });

    // Filter nearby
    let nearbyCars = cars
      .map((car) => {
        if (!car.pickupLatitude || !car.pickupLongitude) return null;
        const distance = getDistance(lat, lon, parseFloat(car.pickupLatitude), parseFloat(car.pickupLongitude));
        if (distance <= maxRange)
          return { ...car.toObject(), distance: distance.toFixed(2) };
        return null;
      })
      .filter(Boolean);

    const availableCars = [];

    for (const car of nearbyCars) {
      const carId = car._id;

      // Check booking availability if date filters exist
      if (start && end) {
        const hasBooking = await Booking.exists({
          VechileId: carId,
          FromDate: { $lte: end },
          ToDate: { $gte: start },
        });

        const isUnavailable = await Availability.exists({
          VechileId: carId,
          fromDate: { $lte: end },
          toDate: { $gte: start },
        });

        if (hasBooking || isUnavailable) continue; // skip unavailable
      }

      // Calculate average rating
      const ratingData = await Review.aggregate([
        { $match: { VechileId: carId } },
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

      availableCars.push({
        ...car,
        averageRating: avgRating,
        totalReviews,
      });
    }

    // Sort by distance
    availableCars.sort((a, b) => (b.boosted - a.boosted) || (a.distance - b.distance));

    return res.status(200).json({
      success: true,
      count: availableCars.length,
      cars: availableCars,
    });
  } catch (error) {
    console.error("Error fetching nearby cars:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.getCarById = async (req, res) => {
  try {
    const carId = req.params.id;
    const car = await Car.findById(carId);

    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    res.status(200).json({ car });
  } catch (error) {
    console.error("Error fetching car by ID:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deleteCar = async (req, res) => {
  try {
    const carId = req.params.id;
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    if (car.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this vehicle" });
    }
    await Car.findByIdAndDelete(carId);
    res.status(200).json({ message: "Car deleted successfully" });
  } catch (error) {
    console.error("Error deleting car:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }     
};
