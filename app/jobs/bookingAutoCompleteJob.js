const cron = require("node-cron");
const Booking = require("../model/bookings");
const User = require("../model/user");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const Notification = require("../model/notification");
const admin = require("../../config/firebase");


cron.schedule("* * * * *", async () => {
  try {
    console.log("⏰ Checking Pending bookings for auto-cancel...");
    const now = new Date();

    const pendingBookings = await Booking.find({
      status: "Pending",
      expireAt: { $lte: now }
    }).limit(50);

    await Promise.all(pendingBookings.map(async (booking) => {
      // Atomic: skip if the owner/customer changed it since the find() above,
      // so this never notifies on top of a cancel that already happened.
      const claimed = await Booking.findOneAndUpdate(
        { _id: booking._id, status: "Pending" },
        { $set: { status: "AutoCancelled" } }
      );
      if (!claimed) return;

      let vehicle;
      if (booking.vechileType === "Car") vehicle = await Car.findById(booking.VechileId);
      else if (booking.vechileType === "Bike") vehicle = await Bike.findById(booking.VechileId);
      else if (booking.vechileType === "Auto") vehicle = await Auto.findById(booking.VechileId);

      const ownerId = vehicle?.userId || booking.ownerId;

      await Notification.create({
        userId: booking.userId,
        type: "Booking",
        ownerId,
        vehicleId: vehicle?._id,
        vehicleType: booking.vechileType,
        bookingId: booking._id,
        title: "Booking Auto-Cancelled ❌",
        messages: "Owner did not respond in time. Booking cancelled automatically."
      });

      const customer = await User.findById(booking.userId);
      if (customer?.fcmTokens?.length) {
        const tokens = customer.fcmTokens.map(t => t.token);
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: "Booking Cancelled ❌",
            body: "Owner did not respond in time. Booking is cancelled!"
          },
          android: { notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default" } } }
        });

        const badTokens = response.responses
          .map((r, i) => (!r.success ? tokens[i] : null))
          .filter(Boolean);

        if (badTokens.length) {
          await User.updateOne(
            { _id: booking.userId },
            { $pull: { fcmTokens: { token: { $in: badTokens } } } }
          );
        }
      }

      console.log(`⛔ Booking ${booking._id} Auto-Cancelled`);
    }));
  } catch (error) {
    console.error("Error in auto-cancel cron:", error);
  }
});



cron.schedule("* * * * *", async () => {
  try {
    console.log("🚦 Checking Confirmed bookings for auto-complete...");

    const now = new Date();

    const confirmedBookings = await Booking.find({
      status: "Confirmed",
      ToDate: { $lte: now } 
    }).limit(50);

    await Promise.all(confirmedBookings.map(async (booking) => {

      let timeStr = booking.ToTime.replace(".", ":");
      const [hours, minutes] = timeStr.split(":");

      
      const bookingEnd = new Date(booking.ToDate);
      bookingEnd.setHours(parseInt(hours), parseInt(minutes || 0), 0, 0);

     
      if (now < bookingEnd) return;

     
      booking.status = "Completed";
      await booking.save();

      let vehicle;
      if (booking.vechileType === "Car") vehicle = await Car.findById(booking.VechileId);
      else if (booking.vechileType === "Bike") vehicle = await Bike.findById(booking.VechileId);
      else if (booking.vechileType === "Auto") vehicle = await Auto.findById(booking.VechileId);

      const ownerId = vehicle?.userId || booking.ownerId;

      const vehicleInfo = {
        ownerId,
        vehicleId: vehicle?._id,
        vehicleType: booking.vechileType,
      };

      
      await Notification.insertMany([
        {
          userId: booking.userId,
          type: "Booking",
          ...vehicleInfo,
          bookingId: booking._id,
          title: "Booking Completed ✔️",
          messages: "Your ride is completed. Hope you enjoyed the trip!"
        },
        {
          userId: ownerId,
          type: "Booking",
          ...vehicleInfo,
          bookingId: booking._id,
          title: "Ride Completed 🎯",
          messages: "Your vehicle has returned. Ride successfully finished."
        }
      ]);

      
      const customer = await User.findById(booking.userId);
      if (customer?.fcmTokens?.length) {
        const tokens = customer.fcmTokens.map(t => t.token);
        const resp = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: "Booking Completed ✔️",
            body: "Hope you enjoyed your ride!"
          },
          android: { notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default" } } }
        });

        const bad = resp.responses.map((r, i) => (!r.success ? tokens[i] : null)).filter(Boolean);
        if (bad.length) await User.updateOne({ _id: customer._id }, { $pull: { fcmTokens: { token: { $in: bad } } } });
      }

      
      const owner = await User.findById(ownerId);
      if (owner?.fcmTokens?.length) {
        const tokens = owner.fcmTokens.map(t => t.token);
        const resp = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: "Ride Completed 🎯",
            body: "Ride is auto-finished. Please check vehicle."
          },
          android: { notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default" } } }
        });

        const bad = resp.responses.map((r, i) => (!r.success ? tokens[i] : null)).filter(Boolean);
        if (bad.length) await User.updateOne({ _id: owner._id }, { $pull: { fcmTokens: { token: { $in: bad } } } });
      }

      console.log(`✔ Booking ${booking._id} auto Completed`);
    }));
  } catch (error) {
    console.error("Error in auto-complete cron:", error);
  }
});

