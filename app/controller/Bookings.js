const mongoose = require("mongoose");
const Booking = require("../model/bookings");
const Notification = require("../model/notification");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const admin = require("../../config/firebase");
const User = require("../model/user");
const Review = require("../model/reviews");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.userId;
    const {
      vechileType,
      VechileId,
      pricePerKm,
      pricePerHour,
      pricePerDay,
      contactNumber,
      contactName,
      latitude,
      longitude,
      FromDate,
      ToDate,
      FromTime,
      ToTime,
      totalHours,
      totalPrice,
      withDriver,
    } = req.body;

    // 🧩 Step 1: Required field validation
    const requiredFields = [
      "vechileType", "VechileId",
      "contactNumber", "contactName", "latitude", "longitude",
      "FromDate", "ToDate", "FromTime", "ToTime",
      "totalHours", "totalPrice"
    ];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // 🧩 Step 2: Validate date order
    if (new Date(FromDate) > new Date(ToDate)) {
      return res.status(400).json({ message: "FromDate cannot be after ToDate" });
    }

    // 🧩 Steps 3-5 run inside a transaction so the overlap check and the
    // booking creation are atomic — otherwise two near-simultaneous requests
    // for the same vehicle/date-range can both pass the check before either
    // save commits, producing a double booking.
    let newBooking;
    const reserve = async (session) => {
      const overlapping = await Booking.findOne({
        VechileId,
        status: { $nin: ["Cancelled", "AutoCancelled"] }, // ✅ exclude cancelled bookings
        $or: [
          {
            FromDate: { $lte: new Date(ToDate) },
            ToDate: { $gte: new Date(FromDate) },
          },
        ],
      }).session(session);

      if (overlapping) {
        throw new HttpError(400, "Vehicle already booked for this date range (active booking found).");
      }

      // 🧩 Fetch the corresponding vehicle
      const vehicleModel = vechileType === "Car" ? Car : vechileType === "Bike" ? Bike : vechileType === "Auto" ? Auto : null;
      const vehicle = vehicleModel ? await vehicleModel.findById(VechileId).session(session) : null;

      if (!vehicle) {
        throw new HttpError(404, `${vechileType} not found`);
      }

      if (vehicle.userId.toString() === userId) {
        throw new HttpError(403, "You cannot book your own vehicle");
      }

      // With-driver is a cars-only option, and only when the owner has
      // opted in for this specific car.
      const wantsDriver = withDriver === true || withDriver === "true";
      if (wantsDriver && vechileType !== "Car") {
        throw new HttpError(400, "Booking with a driver is only available for cars");
      }
      if (wantsDriver && !vehicle.driverAvailable) {
        throw new HttpError(400, "This car's owner does not offer a with-driver option");
      }
      // Driver fee is charged per day of the trip, not once per booking.
      // Snapshot the car's current per-day rate × trip length at booking
      // time, so a later change to the car's rate doesn't retroactively
      // change this booking.
      const tripDays = Math.ceil(Math.abs(new Date(ToDate) - new Date(FromDate)) / (1000 * 60 * 60 * 24)) + 1;
      const driverFee = wantsDriver ? (vehicle.driverFee || 0) * tripDays : 0;

      const now = new Date();
      const expireAt = new Date(now.getTime() + 2 * 60 * 1000); // ⏱ Auto cancel after 2 minutes

      const created = await new Booking({
        userId,
        ownerId: vehicle.userId,
        vechileType,
        VechileId,
        pricePerKm,
        pricePerHour,
        pricePerDay,
        contactNumber,
        contactName,
        latitude,
        longitude,
        FromDate,
        ToDate,
        FromTime,
        ToTime,
        totalHours,
        totalPrice,
        withDriver: wantsDriver,
        driverFee,
        status: "Pending",
        expireAt,
      }).save({ session });

      newBooking = created;
    };

    try {
      await session.withTransaction(() => reserve(session));
    } catch (err) {
      // Standalone mongod (e.g. local dev) doesn't support transactions —
      // fall back to running the same steps without one.
      if (err?.code !== 20 && err?.codeName !== "IllegalOperation") throw err;
      await reserve(null);
    }

    const vehicle =
      newBooking.vechileType === "Car"
        ? await Car.findById(newBooking.VechileId)
        : newBooking.vechileType === "Bike"
        ? await Bike.findById(newBooking.VechileId)
        : await Auto.findById(newBooking.VechileId);

    // 🧩 Step 6: Add notifications
    await Notification.insertMany([
      {
        userId: vehicle.userId,
        ownerId: vehicle.userId,
        type: "Booking",
          vehicleId: vehicle._id,
        vehicleType: vechileType,
        vehicleName: vehicle.CarName || vehicle.bikeName || "",
        vehiclefuelType: vehicle.fuelType || "",
        vehicleTransmission: vehicle.transmission || "",
        vehicleseatingCapacity: vehicle.Carseater|| 0,
        bookingId: newBooking._id,
        title: "New Booking Received",
        messages: `A customer requested to book your ${vechileType} (${vehicle.bikeNumber || vehicle.CarNumber || vehicle.AutoNumber}).`,
      },
      {
        userId,
        type: "Booking",
          vehicleId: vehicle._id,
        vehicleType: vechileType,
        vehicleName: vehicle.CarName || vehicle.bikeName || "",
        vehiclefuelType: vehicle.fuelType || "",
        vehicleTransmission: vehicle.transmission || "",
        vehicleseatingCapacity: vehicle.Carseater|| 0,
        ownerId: vehicle.userId,
        bookingId: newBooking._id,
        title: "Booking Request Sent",
        messages: "Your booking request has been sent. Please wait for confirmation from the owner.",
      },
    ]);

    // 🧩 Step 7: Send FCM Notification to customer
    const customer = await User.findById(userId);
    if (customer?.fcmTokens?.length) {
      const customerTokens = customer.fcmTokens.map(t => t.token);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: customerTokens,
        notification: {
          title: "Booking Request Sent 🛵",
          body: "Your booking request has been sent. Please wait for confirmation.",
        },
        // android: { priority: "high" },
        // apns: { payload: { aps: { sound: "default" } } },
         android: {

          priority: "high",

          notification: {

            sound: "default"

          }

        },

        apns: {

          payload: {

            aps: {

              sound: "default",

              contentAvailable: true

            }

          }

        }
      });

      const invalidTokens = response.responses
        .map((r, i) => (!r.success ? customerTokens[i] : null))
        .filter(Boolean);

      if (invalidTokens.length) {
        await User.updateOne(
          { _id: userId },
          { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
        );
        console.log("Removed invalid customer tokens:", invalidTokens);
      }
    }

    // 🧩 Step 8: Send FCM Notification to vehicle owner
    const owner = await User.findById(vehicle.userId);
    if (owner?.fcmTokens?.length) {
      const ownerTokens = owner.fcmTokens.map(t => t.token);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: ownerTokens,
        notification: {
          title: "New Booking Received 🚗",
          body: `A customer requested to book your ${vechileType}.`,
        },
        // android: { priority: "high" },
        // apns: { payload: { aps: { sound: "default" } } },
         android: {

          priority: "high",

          notification: {

            sound: "default"

          }

        },

        apns: {

          payload: {

            aps: {

              sound: "default",

              contentAvailable: true

            }

          }

        }
      });

      const invalidTokens = response.responses
        .map((r, i) => (!r.success ? ownerTokens[i] : null))
        .filter(Boolean);

      if (invalidTokens.length) {
        await User.updateOne(
          { _id: owner._id },
          { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
        );
        console.log("Removed invalid owner tokens:", invalidTokens);
      }
    }

    // ✅ Step 9: Success response
    res.status(201).json({
      message: "Booking created successfully. Notifications sent to customer and owner.",
      booking: newBooking,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    const status = error instanceof HttpError ? error.status : 500;
    res.status(status).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};

// ✅ Get all bookings (with filters)
exports.getAllBookings = async (req, res) => {
  try {
    const { userId, VechileId, vechileType, startDate, endDate, status } = req.query;

    // A caller may only list their own bookings, or bookings for a vehicle
    // they own — otherwise this endpoint would leak every booking/user's PII.
    if (userId && userId !== req.userId) {
      return res.status(403).json({ message: "You can only view your own bookings" });
    }

    if (VechileId) {
      const vehicleModel = vechileType === "Car" ? Car : vechileType === "Bike" ? Bike : vechileType === "Auto" ? Auto : null;
      const vehicle = vehicleModel ? await vehicleModel.findById(VechileId) : null;
      if (!vehicle || vehicle.userId.toString() !== req.userId) {
        return res.status(403).json({ message: "You do not own this vehicle" });
      }
    }

    if (!userId && !VechileId) {
      return res.status(400).json({ message: "userId or VechileId is required" });
    }

    const filter = {};
    if (userId) filter.userId = userId;
    if (VechileId) filter.VechileId = VechileId;
    if (vechileType) filter.vechileType = vechileType;
    if (status) filter.status = status;

    // 🔹 Date range filter
    if (startDate && endDate) {
      filter.$or = [
        {
          FromDate: { $lte: new Date(endDate) },
          ToDate: { $gte: new Date(startDate) },
        },
      ];
    }

    // 🔹 Fetch bookings
    const bookings = await Booking.find(filter).sort({ createdAt: -1 });

    // 🔹 If no bookings found
    if (!bookings.length) {
      return res.status(404).json({ message: "No bookings found" });
    }

    // 🔹 Combine data
    const bookingData = await Promise.all(
      bookings.map(async (booking) => {
        // Fetch user details
        const user = await User.findById(booking.userId).select(
          "name email mobilenumber profilePic"
        );

        // Fetch vehicle details based on type
        let vehicle = null;
        if (booking.vechileType === "Bike") {
          vehicle = await Bike.findById(booking.VechileId);
        } else if (booking.vechileType === "Car") {
          vehicle = await Car.findById(booking.VechileId);
        } else if (booking.vechileType === "Auto") {
          vehicle = await Auto.findById(booking.VechileId);
        }

        // Fetch reviews for this booking
        const reviews = await Review.find({ bookingId: booking._id });

        return {
          booking,
          user,
          vehicle,
          reviews,
        };
      })
    );

    res.status(200).json({
      count: bookingData.length,
      data: bookingData,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.userId.toString() !== req.userId && booking.ownerId?.toString() !== req.userId) {
      return res.status(403).json({ message: "You are not part of this booking" });
    }

    // 🔹 Fetch User details
    const user = await User.findById(booking.userId).select(
      "_id name email mobilenumber profilePic"
    );

    // 🔹 Fetch Vehicle details based on type
    let vehicle = null;
    if (booking.vechileType === "Bike") {
      vehicle = await Bike.findById(booking.VechileId).select(
        "_id bikeName bikeNumber pricePerKm contactName contactNumber bikeImages pickupCity pickupArea"
      );
    } else if (booking.vechileType === "Car") {
      vehicle = await Car.findById(booking.VechileId).select(
        "_id carName carNumber pricePerKm contactName contactNumber carImages pickupCity pickupArea"
      );
    } else if (booking.vechileType === "Auto") {
      vehicle = await Auto.findById(booking.VechileId).select(
        "_id autoName autoNumber pricePerKm contactName contactNumber autoImages pickupCity pickupArea"
      );
    }

    // 🔹 Fetch Reviews linked to this booking
    const reviews = await Review.find({ bookingId: booking._id }).select(
      "_id rating comment createdAt"
    );

    // 🔹 Construct final response
    const response = {
      booking,
      user,
      vehicle,
      reviews,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching booking by ID:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Update booking
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const isCustomer = booking.userId.toString() === req.userId;
    const isOwner = booking.ownerId?.toString() === req.userId;

    if (!isCustomer && !isOwner) {
      return res.status(403).json({ message: "You are not part of this booking" });
    }

    // Whitelist what can change here — status/price/ownerId etc. must go
    // through confirmBooking, not arbitrary mass-assignment from the client.
    // "AutoCancelled" is included alongside "Cancelled" because the mobile
    // app's own 120s waiting timer reports a timeout this way; without it,
    // that call silently no-ops, the booking stays "Pending", and the
    // server-side auto-cancel cron catches it later — producing a second,
    // delayed "Auto-Cancelled" notification on top of the one the customer
    // already saw.
    const allowedFields = ["contactNumber", "contactName", "latitude", "longitude"];
    if (isCustomer && (req.body.status === "Cancelled" || req.body.status === "AutoCancelled")) {
      allowedFields.push("status");
    }

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        booking[field] = req.body[field];
      }
    }

    await booking.save();
    res.status(200).json({ message: "Booking updated successfully", booking });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Delete booking
exports.deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You can only delete your own booking" });
    }

    await Booking.findByIdAndDelete(id);

    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


exports.confirmBooking = async (req, res) => {
  try {
    const { id, status } = req.params;

    // ✅ Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.ownerId?.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this booking's vehicle" });
    }

    // ✅ Update booking status — atomically, and only from a state the change
    // makes sense from. Without this guard a repeated call (e.g. a web client
    // whose 120s timer fired twice, or one that fires after the auto-cancel
    // cron) re-"cancels" the booking and pushes a duplicate notification.
    const allowedFrom = status === "Cancelled" ? ["Pending", "Confirmed"] : ["Pending"];
    const updated = await Booking.findOneAndUpdate(
      { _id: id, status: { $in: allowedFrom } },
      { $set: { status } },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({
        message: `Booking is already ${booking.status}`,
        booking,
      });
    }
    booking.status = updated.status;

    // ✅ Find user (customer who made the booking)
    const customer = await User.findById(booking.userId);

    // ✅ Find vehicle
    let vehicle;
    if (booking.vechileType === "Car") vehicle = await Car.findById(booking.VechileId);
    else if (booking.vechileType === "Bike") vehicle = await Bike.findById(booking.VechileId);
    else if (booking.vechileType === "Auto") vehicle = await Auto.findById(booking.VechileId);

    // ✅ Notification message
    const title =
      status === "Confirmed"
        ? "Booking Confirmed ✅"
        : status === "Cancelled"
        ? "Booking Cancelled ❌"
        : "Booking Updated";

    const body =
      status === "Confirmed"
        ? `Your ${booking.vechileType} (${vehicle?.CarNumber || vehicle?.bikeNumber || vehicle?.AutoNumber}) booking has been confirmed by the owner.`
        : `Your ${booking.vechileType} (${vehicle?.CarNumber || vehicle?.bikeNumber || vehicle?.AutoNumber}) booking has been cancelled by the owner.`;

    // ✅ Extract valid FCM tokens
    const tokens = customer?.fcmTokens?.map((t) => t.token).filter(Boolean);

    if (tokens && tokens.length > 0) {
      const message = {
        notification: { title, body },
        data: {
          type: "BookingStatus",
          bookingId: booking._id.toString(),
          status,
        },
        android: {
          notification: {
            sound: "buzzr",
            channelId: "booking_channel",
          },
        },
        apns: {
          payload: {
            aps: { sound: "buzzr.wav" },
          },
        },
        webpush: {
          notification: {
            title,
            body,
            icon: "https://yourdomain.com/icons/booking.png",
            sound: "https://yourdomain.com/sounds/buzzr.mp3",
            vibrate: [200, 100, 200],
            click_action: "https://yourdomain.com/mybookings",
          },
        },
      };

      // ✅ Use sendEachForMulticast for multiple tokens
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...message,
      });

      console.log("🔔 Notification Response:", response);
    } else {
      console.warn("⚠️ Customer FCM tokens not found, skipping notification");
    }

    // ✅ Save notification in DB
    const notification = new Notification({
      userId: booking.userId,
      type: "BookingStatus",
      ownerId: vehicle.userId,
      vehicleId: vehicle._id,
      vehicleType: booking.vechileType,
      vehicleName: vehicle.CarName || vehicle.bikeName || "",
      vehiclefuelType: vehicle.fuelType || "",
      vehicleTransmission: vehicle.transmission || "",
      vehicleseatingCapacity: vehicle.Carseater || 0,
      bookingId: booking._id,
      title,
      messages: body,
    });
    await notification.save();

    res.status(200).json({
      message: `Booking ${status} successfully`,
      booking,
    });
  } catch (error) {
    console.error("Error confirming booking:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




// ✅ Get All Bookings (with optional filters)
exports.getPendingBookingsOfOwner = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.userId) {
      return res.status(403).json({ message: "You can only view your own pending bookings" });
    }

    const bookings = await Booking.find({ ownerId: userId, status: "Pending" }).sort({ createdAt: -1 });
    res.status(200).json({ count: bookings.length, data: bookings });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
