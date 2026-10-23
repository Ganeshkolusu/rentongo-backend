const Call = require("../model/CallSchema");
const User = require("../model/user");
const admin = require("../../config/firebase");

// 🔹 Relay an incoming-call invite to the receiver over the socket, and wake
// their device with a data-only FCM push (no top-level `notification` key,
// so it always reaches CallNotificationService's onMessage/background
// handler instead of being auto-rendered by the OS — mirrors the
// sendEachForMulticast pattern used for booking pushes in Bookings.js).
exports.relayInitiateCall = async (io, data) => {
  const { callId, callerId, callerName, callerAvatar, receiverId } = data;

  io.to(receiverId).emit("incomingCall", { ...data, callType: "audio" });

  const receiver = await User.findById(receiverId);
  if (receiver?.fcmTokens?.length) {
    const tokens = receiver.fcmTokens.map((t) => t.token);
    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        type: "incoming_call",
        notificationType: "call",
        callId: String(callId || ""),
        callerId: String(callerId || ""),
        callerName: callerName || "",
        callerAvatar: callerAvatar || "",
        callType: "audio",
      },
      android: { priority: "high" },
      apns: {
        payload: { aps: { sound: "default", contentAvailable: true } },
        headers: { "apns-priority": "10" },
      },
    });

    const invalidTokens = response.responses
      .map((r, i) => (!r.success ? tokens[i] : null))
      .filter(Boolean);

    if (invalidTokens.length) {
      await User.updateOne(
        { _id: receiver._id },
        { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
      );
    }
  }
};

// 🔹 Socket-only reject (no REST round trip) — sets status and notifies caller
exports.relayRejectCall = async (io, data) => {
  const { callId, reason } = data;
  const call = await Call.findByIdAndUpdate(callId, { status: "rejected" }, { new: true });
  if (call) io.to(call.callerId.toString()).emit("callRejected", { callId, reason });
};

// 🔹 Socket-only hangup (no REST round trip) — mirrors endCall's duration/status logic
exports.relayEndCall = async (io, data) => {
  const { callId, reason } = data;
  const call = await Call.findById(callId);
  if (!call) return;

  const endedAt = new Date();
  call.status = "ended";
  call.endedAt = endedAt;
  call.duration = Math.floor((endedAt - call.startedAt) / 1000);
  await call.save();

  const otherPartyId =
    data.userId && data.userId === call.callerId.toString()
      ? call.receiverId.toString()
      : call.callerId.toString();
  io.to(otherPartyId).emit("callEnded", { callId, reason });
};

// POST /call/start
exports.startCall = async (req, res) => {
  try {
    const {
      callerId,
      receiverId,
      callType,
      callerSocketId
    } = req.body;

    if (callType !== "audio") {
      return res.status(400).json({ success: false, message: "Only audio calls are supported" });
    }

    const call = await Call.create({
      callerId,
      receiverId,
      callType,
      callerSocketId,
      status: "ringing",
      startedAt: new Date()
    });

    res.status(200).json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /call/save-offer
exports.saveOffer = async (req, res) => {
  try {
    const { callId, offer, receiverSocketId } = req.body;

    const call = await Call.findByIdAndUpdate(
      callId,
      { offer, receiverSocketId },
      { new: true }
    );

    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /call/save-answer
exports.saveAnswer = async (req, res) => {
  try {
    const { callId, answer } = req.body;

    const call = await Call.findByIdAndUpdate(
      callId,
      { answer, status: "accepted" },
      { new: true }
    );

    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /call/add-ice
exports.addIceCandidate = async (req, res) => {
  try {
    const { callId, candidate } = req.body;

    const call = await Call.findByIdAndUpdate(
      callId,
      { $push: { iceCandidates: candidate } },
      { new: true }
    );

    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

//POST /call/update-status
exports.updateStatus = async (req, res) => {
  try {
    const { callId, status } = req.body;

    const call = await Call.findByIdAndUpdate(
      callId,
      { status },
      { new: true }
    );

    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// POST /call/end
exports.endCall = async (req, res) => {
  try {
    const { callId, reason } = req.body;

    const call = await Call.findById(callId);
    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    const endedAt = new Date();
    const duration = Math.floor((endedAt - call.startedAt) / 1000); // seconds

    call.status = "ended";
    call.endedAt = endedAt;
    call.duration = duration;
    call.callEndedReason = reason || "user ended";
    await call.save();

    const io = req.app.get("io");
    const otherPartyId =
      req.userId === call.callerId.toString()
        ? call.receiverId.toString()
        : call.callerId.toString();
    io.to(otherPartyId).emit("callEnded", { callId, reason });

    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /rejectCall
exports.rejectCall = async (req, res) => {
  try {
    const { callId, reason } = req.body;

    const call = await Call.findByIdAndUpdate(callId, { status: "rejected" }, { new: true });
    if (!call) return res.status(404).json({ success: false, message: "Call not found" });

    const io = req.app.get("io");
    io.to(call.callerId.toString()).emit("callRejected", { callId, reason });

    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /call/history/:userId
exports.getHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const calls = await Call.find({
      $or: [{ callerId: userId }, { receiverId: userId }]
    })
      .populate("callerId", "name profilePic")
      .populate("receiverId", "name profilePic")
      .sort({ createdAt: -1 });

    res.json({ success: true, calls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /call/active/:userId
exports.getActiveCall = async (req, res) => {
  try {
    const { userId } = req.params;

    const call = await Call.findOne({
      $or: [{ callerId: userId }, { receiverId: userId }],
      status: { $in: ["ringing", "accepted"] }
    });

    res.json({ success: true, call });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
