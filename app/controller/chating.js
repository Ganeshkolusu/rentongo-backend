const AWS = require("aws-sdk");
const Chat = require("../model/chating");
const User = require("../model/user");
const Booking = require("../model/bookings");
const Notification = require("../model/notification");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const admin = require("../../config/firebase");

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
// 🔹 Helper to Upload File to S3
// ===============================
const uploadFileToS3 = async (file) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `chat_uploads/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  const uploaded = await s3.upload(params).promise();
  return uploaded.Location; // return the file URL
};

// ===============================
// 🔹 SEND MESSAGE
// ===============================
exports.sendMessage = async (io, data, files = []) => {
  try {
    const { bookingId, senderId, receiverId, message } = data;

    if (!bookingId || !senderId || !receiverId)
      return { success: false, message: "Missing fields" };

    let chat = await Chat.findOne({ bookingId });

    // 🔹 Upload all files (images/videos) to S3
    let fileUrls = [];
    if (files && files.length > 0) {
      const uploadPromises = files.map((file) => uploadFileToS3(file));
      fileUrls = await Promise.all(uploadPromises);
    }

    const newMessage = {
      senderId,
      receiverId,
      message: message || "",
      files: fileUrls,
      seen: false,
      timestamp: new Date(),
    };

    if (!chat) {
      chat = new Chat({ bookingId, messages: [newMessage] });
    } else {
      chat.messages.push(newMessage);
    }

    await chat.save();

    // 🔹 Emit message to receiver in real-time
    io.to(receiverId.toString()).emit("receiveMessage", newMessage);

    // 🔹 Look up sender/receiver/booking context once, reused below for the
    // push notification and the persisted Notification doc
    const [receiver, sender, booking] = await Promise.all([
      User.findById(receiverId),
      User.findById(senderId),
      Booking.findById(bookingId),
    ]);

    // 🔹 Send Firebase Push Notification
    if (receiver && receiver.fcmTokens.length > 0) {
      const fcmTokens = receiver.fcmTokens.map((f) => f.token);
      await admin.messaging().sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title: "💬 New Message",
          body: message ? message : "📎 Sent a media file",
        },
        data: {
          bookingId: bookingId.toString(),
          senderId: senderId.toString(),
          type: "chat_message",
        },
      });
    }

    // 🔹 Persist as a Notification so it shows up on the Notifications page
    // (Chats category) even when the recipient isn't in the chat screen.
    // Wrapped in its own try/catch so a failure here never rolls back the
    // message, which is already saved and delivered above.
    try {
      let vehicle = null;
      if (booking) {
        const VehicleModel =
          booking.vechileType === "Car" ? Car
          : booking.vechileType === "Bike" ? Bike
          : booking.vechileType === "Auto" ? Auto
          : null;
        if (VehicleModel) vehicle = await VehicleModel.findById(booking.VechileId);
      }

      const chatNotification = new Notification({
        userId: receiverId,
        type: "chat_message",
        ownerId: senderId,
        bookingId,
        vehicleId: vehicle ? vehicle._id : undefined,
        vehicleType: booking ? booking.vechileType : "",
        vehicleName: vehicle ? (vehicle.CarName || vehicle.bikeName || "") : "",
        title: `New message from ${sender ? sender.name : "someone"}`,
        messages: message ? message : "Sent an attachment",
      });
      await chatNotification.save();

      io.to(receiverId.toString()).emit("new-notification", {
        _id: chatNotification._id,
        type: chatNotification.type,
        title: chatNotification.title,
        message: chatNotification.messages,
        vehicleId: chatNotification.vehicleId,
        vehicleName: chatNotification.vehicleName,
        bookingId: chatNotification.bookingId,
        ownerId: chatNotification.ownerId,
      });
    } catch (notifyError) {
      console.error("Chat notification save error:", notifyError);
    }

    return { success: true, message: "Message sent successfully", data: newMessage };
  } catch (error) {
    console.error("Send Message Error:", error);
    return { success: false, message: "Server Error", error: error.message };
  }
};

// ===============================
// 🔹 SEND MESSAGE (HTTP route — used when a file attachment needs uploading
// first; the socket handler in middlewares/socket.js covers text-only sends)
// ===============================
exports.sendMessageHttp = async (req, res) => {
  try {
    const { bookingId, senderId, receiverId, message } = req.body;

    if (req.userId !== senderId) {
      return res.status(403).json({ success: false, message: "senderId must match the authenticated user" });
    }

    const io = req.app.get("io");
    const files = req.files || [];
    const result = await exports.sendMessage(io, { bookingId, senderId, receiverId, message }, files);

    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.error("Send Message (HTTP) Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ===============================
// 🔹 GET MESSAGES
// ===============================
exports.getMessages = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const chat = await Chat.findOne({ bookingId })
      .populate("messages.senderId", "name profilePic")
      .populate("messages.receiverId", "name profilePic");

    if (!chat)
      return res.status(404).json({ success: false, message: "Chat not found" });

    res.status(200).json({ success: true, messages: chat.messages });
  } catch (error) {
    console.error("Get Messages Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
