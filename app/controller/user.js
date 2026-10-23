const User = require("../model/user");
const Booking = require("../model/bookings");
const Auto = require("../model/auto");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const UserRating = require("../model/userrating");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3(); // Initialize S3 instance

// Account creation/login now happens via email OTP —
// see app/controller/otp.js (requestOtp/verifyOtp).

// ➤ Get All Users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name profilePic createdAt")
      .sort({ createdAt: -1 });
    res.status(200).json({ message: "Users fetched successfully", count: users.length, users });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate average rating and total reviews for this user
    const ratingStats = await UserRating.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const avgRating = ratingStats.length ? ratingStats[0].averageRating.toFixed(1) : "0.0";
    const totalReviews = ratingStats.length ? ratingStats[0].totalReviews : 0;

    // Send response
    res.status(200).json({
      message: "User fetched successfully",
      user,
      ratings: {
        averageRating: avgRating,
        totalReviews,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// // ➤ Get Single User by ID
// exports.getUserById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const user = await User.findById(id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.status(200).json({ message: "User fetched successfully", user });
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

// ➤ Update User
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      return res.status(403).json({ message: "You can only update your own profile" });
    }

    const {
      name,
      mobilenumber,
      latitude,
      longitude,
      fcmToken,
      platform,
    } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }


    if (name) user.name = name;
    let uploadedImage = "";

    if (req.file) {
      const fileKey = `users/${uuidv4()}-${req.file.originalname}`;

      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const uploadResult = await s3.upload(params).promise();
      uploadedImage = uploadResult.Location;
    }
    if (uploadedImage) user.profilePic = uploadedImage;
    if (mobilenumber) user.mobilenumber = mobilenumber;
    if (latitude) user.latitude = latitude;
    if (longitude) user.longitude = longitude;

  
    if (fcmToken) {
      const tokenExists = user.fcmTokens.some(
        (t) => t.token === fcmToken
      );
      if (!tokenExists) {
        user.fcmTokens.push({
          token: fcmToken,
          platform: platform || "web",
        });
      }
    }

    await user.save();

    res.status(200).json({
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ➤ Delete User
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.userId !== id) {
      return res.status(403).json({ message: "You can only delete your own account" });
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.myBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    if (userId !== req.userId) {
      return res.status(403).json({ message: "You can only view your own bookings" });
    }

    // Build base query
    const query = { userId };

    // Optional date range filter
    if (startDate && endDate) {
      query.FromDate = { $gte: new Date(startDate) };
      query.ToDate = { $lte: new Date(endDate) };
    }

    // Fetch all bookings for user
    const bookings = await Booking.find(query).sort({ createdAt: -1 });

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found" });
    }

    // Prepare response with vehicle details
    const bookingsWithVehicle = await Promise.all(
      bookings.map(async (booking) => {
        let vehicleDetails = null;

        if (booking.vechileType === "Auto") {
          vehicleDetails = await Auto.findById(booking.VechileId).lean();
        } else if (booking.vechileType === "Car") {
          vehicleDetails = await Car.findById(booking.VechileId).lean();
        } else if (booking.vechileType === "Bike") {
          vehicleDetails = await Bike.findById(booking.VechileId).lean();
        }

        return {
          ...booking.toObject(),
          vehicleDetails: vehicleDetails || null,
        };
      })
    );

    res.status(200).json({
      message: "User bookings retrieved successfully",
      total: bookingsWithVehicle.length,
      data: bookingsWithVehicle,
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.myVehicles = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    if (userId !== req.userId) {
      return res.status(403).json({ message: "You can only view your own vehicles" });
    }

    // 🔹 Fetch vehicles by userId from all collections
    const [autos, cars, bikes] = await Promise.all([
      Auto.find({ userId }),
      Car.find({ userId }),
      Bike.find({ userId }),
    ]);

    // 🔹 Return combined response
    res.status(200).json({
      message: "User vehicles retrieved successfully",
      total: autos.length + cars.length + bikes.length,
      data: {
        autos,
        cars,
        bikes,
      },
    });
  } catch (error) {
    console.error("Error fetching user vehicles:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.myVehicleBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const { vechileType, VechileId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    if (userId !== req.userId) {
      return res.status(403).json({ message: "You can only view your own vehicle bookings" });
    }

    let vehicles = [];

    // 🔹 Fetch vehicles based on type and/or ID
    if (vechileType && VechileId) {
      // Specific vehicle
      let vehicleModel;
      if (vechileType === "Auto") vehicleModel = Auto;
      else if (vechileType === "Car") vehicleModel = Car;
      else if (vechileType === "Bike") vehicleModel = Bike;
      else return res.status(400).json({ message: "Invalid vehicle type" });

      const vehicle = await vehicleModel.findOne({ _id: VechileId, userId });
      if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

      vehicles.push({ type: vechileType, data: [vehicle] });
    } else {
      // All vehicles of the user
      const [autos, cars, bikes] = await Promise.all([
        Auto.find({ userId }),
        Car.find({ userId }),
        Bike.find({ userId }),
      ]);

      vehicles = [
        { type: "Auto", data: autos },
        { type: "Car", data: cars },
        { type: "Bike", data: bikes },
      ];
    }

    // 🔹 Attach bookings to each vehicle
    const result = {};
    for (const v of vehicles) {
      const type = v.type;
      const list = await Promise.all(
        v.data.map(async (vehicle) => {
          const bookings = await Booking.find({
            VechileId: vehicle._id,
            vechileType: type,
          }).sort({ createdAt: -1 });

          return {
            ...vehicle.toObject(),
            bookings: bookings || [],
          };
        })
      );
      result[type.toLowerCase()] = list;
    }

    res.status(200).json({
      message: "User vehicles with bookings fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error fetching vehicle bookings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


