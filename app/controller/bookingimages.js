const multer = require("multer");
const multerS3 = require("multer-s3");
const BookingImages = require("../model/bookingimages");
const Booking = require("../model/bookings");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const AWS = require("aws-sdk");
// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3(); // Initialize S3 instance

const bucketName = process.env.S3_BUCKET_NAME;

// ---------- Multer S3 Upload Config ----------
// stage/type are fixed per-route (before/after, image/video) — they never
// come from req.params, so the uploader is built per-route via closure
// instead of reading them off the request.
const createUploader = (stage, type) =>
  multer({
    storage: multerS3({
      s3: s3,
      bucket: bucketName,
      acl: "public-read",
      key: (req, file, cb) => {
        const fileName = `vehicles/${stage}/${type}/${Date.now()}_${file.originalname}`;
        cb(null, fileName);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
    fileFilter: (req, file, cb) => {
      const allowed = {
        image: ["image/jpeg", "image/png", "image/jpg"],
        video: ["video/mp4", "video/mkv", "video/quicktime"],
      };
      if (allowed[type]?.includes(file.mimetype)) cb(null, true);
      else cb(new Error(`Only ${type} files are allowed!`), false);
    },
  });

const vehicleNumberFieldByType = { Car: "CarNumber", Bike: "bikeNumber", Auto: "AutoNumber" };
const vehicleModelByType = { Car, Bike, Auto };

// ---------- Common Upload Handler ----------
const handleUpload = async (req, res, stage, type) => {
  try {
    const { bookingId } = req.params;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: "No files uploaded" });

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const urls = req.files.map((file) => file.location);

    const updateField =
      stage === "before"
        ? type === "image"
          ? "beforeTrip.images"
          : "beforeTrip.videos"
        : type === "image"
        ? "afterTrip.images"
        : "afterTrip.videos";

    // A BookingImages doc doesn't exist until the first upload — seed the
    // fields the schema requires (userId/vehicleType/vehicleNumber) from the
    // booking itself so upsert never creates an invalid orphaned document.
    const vehicleModel = vehicleModelByType[booking.vechileType];
    const vehicle = vehicleModel ? await vehicleModel.findById(booking.VechileId) : null;
    const numberField = vehicleNumberFieldByType[booking.vechileType];

    const updated = await BookingImages.findOneAndUpdate(
      { bookingId },
      {
        $push: { [updateField]: { $each: urls } },
        $setOnInsert: {
          bookingId,
          userId: booking.userId,
          vehicleType: booking.vechileType,
          vehicleNumber: (vehicle && vehicle[numberField]) || `UNKNOWN-${bookingId}`,
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: `${stage} ${type} uploaded successfully`,
      uploaded: urls,
      data: updated,
    });
  } catch (err) {
    console.error(`${stage} ${type} upload error:`, err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

// ---------- Exported Controller Methods ----------
exports.uploadBeforeImages = [
  createUploader("before", "image").array("files", 5),
  (req, res) => handleUpload(req, res, "before", "image"),
];

exports.uploadBeforeVideos = [
  createUploader("before", "video").array("files", 3),
  (req, res) => handleUpload(req, res, "before", "video"),
];

exports.uploadAfterImages = [
  createUploader("after", "image").array("files", 5),
  (req, res) => handleUpload(req, res, "after", "image"),
];

exports.uploadAfterVideos = [
  createUploader("after", "video").array("files", 3),
  (req, res) => handleUpload(req, res, "after", "video"),
];
