const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const User = require("../model/user");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const Booking = require("../model/bookings");
const Subscription = require("../model/subscription");
const Plan = require("../model/plan");
const { getAllPlans, getPlan } = require("../utils/planCatalog");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const s3 = new AWS.S3();

const VEHICLE_CONFIG = {
  Car: { model: Car, imagesField: "carImages", keyPrefix: "cars" },
  Bike: { model: Bike, imagesField: "bikeImages", keyPrefix: "bikes" },
  Auto: { model: Auto, imagesField: "autoImages", keyPrefix: "autos" },
};

const paginate = (req) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  return { limit, skip };
};

// ➤ All users, full details (unlike the PII-stripped public getAllUsers)
exports.getAllUsers = async (req, res) => {
  try {
    const { limit, skip } = paginate(req);
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(),
    ]);
    res.status(200).json({ total, count: users.length, users });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Every vehicle across all three types, regardless of owner/status
exports.getAllVehicles = async (req, res) => {
  try {
    const { limit, skip } = paginate(req);
    const { vehicleType, status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const wantsCars = !vehicleType || vehicleType === "Car";
    const wantsBikes = !vehicleType || vehicleType === "Bike";
    const wantsAutos = !vehicleType || vehicleType === "Auto";

    const [cars, bikes, autos] = await Promise.all([
      wantsCars ? Car.find(filter).populate("userId", "name email mobilenumber").sort({ createdAt: -1 }) : [],
      wantsBikes ? Bike.find(filter).populate("userId", "name email mobilenumber").sort({ createdAt: -1 }) : [],
      wantsAutos ? Auto.find(filter).populate("userId", "name email mobilenumber").sort({ createdAt: -1 }) : [],
    ]);

    const vehicles = [
      ...cars.map((v) => ({ ...v.toObject(), vehicleType: "Car" })),
      ...bikes.map((v) => ({ ...v.toObject(), vehicleType: "Bike" })),
      ...autos.map((v) => ({ ...v.toObject(), vehicleType: "Auto" })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const page = vehicles.slice(skip, skip + limit);
    res.status(200).json({ total: vehicles.length, count: page.length, vehicles: page });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Every booking, unrestricted (the regular getAllBookings requires
// ownership; this is the admin-only bypass)
exports.getAllBookings = async (req, res) => {
  try {
    const { limit, skip } = paginate(req);
    const { status } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate("userId", "name email mobilenumber")
        .populate("ownerId", "name email mobilenumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);

    res.status(200).json({ total, count: bookings.length, bookings });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Every owner subscription
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { limit, skip } = paginate(req);
    const [subscriptions, total] = await Promise.all([
      Subscription.find()
        .populate("userId", "name email mobilenumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments(),
    ]);
    res.status(200).json({ total, count: subscriptions.length, subscriptions });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Plan pricing/limits
exports.getPlans = async (req, res) => {
  try {
    const plans = await getAllPlans();
    res.status(200).json({ plans });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Replace one photo on a vehicle (e.g. swap in a manually plate-blurred
// version of an owner-uploaded photo). Deletes the old S3 object and uploads
// the new one in its place, preserving position in the images array.
exports.replaceVehiclePhoto = async (req, res) => {
  try {
    const { vehicleType, vehicleId, index } = req.params;
    const config = VEHICLE_CONFIG[vehicleType];
    if (!config) {
      return res.status(400).json({ message: "Invalid vehicleType" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No photo file uploaded" });
    }

    const idx = parseInt(index, 10);
    const vehicle = await config.model.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ message: `${vehicleType} not found` });
    }

    const images = vehicle[config.imagesField] || [];
    if (Number.isNaN(idx) || idx < 0 || idx >= images.length) {
      return res.status(400).json({ message: "Photo index out of range" });
    }

    const oldUrl = images[idx];
    const oldKey = oldUrl && oldUrl.split(".amazonaws.com/")[1];
    if (oldKey) {
      try {
        await s3.deleteObject({ Bucket: process.env.S3_BUCKET_NAME, Key: oldKey }).promise();
      } catch (err) {
        console.error("Failed to delete old S3 photo (continuing):", err.message);
      }
    }

    const newKey = `${config.keyPrefix}/${vehicle.userId}/${uuidv4()}-${req.file.originalname}`;
    const uploadResult = await s3
      .upload({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: newKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
      .promise();

    images[idx] = uploadResult.Location;
    vehicle[config.imagesField] = images;
    await vehicle.save();

    res.status(200).json({ message: "Photo replaced", [config.imagesField]: images });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { label, price, durationDays, maxVehicles, priority } = req.body;

    // Ensure it exists (lazy-seeds from defaults if this is the first edit)
    const existing = await getPlan(planId);
    if (!existing) {
      return res.status(404).json({ message: "Unknown plan" });
    }

    const updates = {};
    if (label !== undefined) updates.label = label;
    if (price !== undefined) updates.price = Number(price);
    if (durationDays !== undefined) updates.durationDays = Number(durationDays);
    if (maxVehicles !== undefined) updates.maxVehicles = maxVehicles === null || maxVehicles === "" ? null : Number(maxVehicles);
    if (priority !== undefined) updates.priority = priority === true || priority === "true";

    const updated = await Plan.findOneAndUpdate({ planId }, { $set: updates }, { new: true });
    res.status(200).json({ message: "Plan updated", plan: updated });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
