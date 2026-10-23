const { sendMessage } = require("../controller/chating");
const { recordLocation } = require("../controller/tracking");
const { relayInitiateCall, relayRejectCall, relayEndCall } = require("../controller/calling");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    // Safety net: some clients (mobile) connect with ?userId= in the query
    // string but may not always emit "join" — auto-join that room too so
    // io.to(userId).emit(...) reliably reaches them either way.
    const queryUserId = socket.handshake.query?.userId;
    if (queryUserId) {
      socket.join(queryUserId);
      console.log(`👤 Auto-joined room from query: ${queryUserId}`);
    }

    // Join user room (userId)
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`👤 User joined room: ${userId}`);
    });

    // ===== Calling (voice-only) =====
    socket.on("initiateCall", async (data) => {
      try {
        await relayInitiateCall(io, data);
      } catch (error) {
        socket.emit("callError", { message: error.message });
      }
    });

    socket.on("callOffer", (data) => {
      io.to(data.receiverId).emit("callOffer", data);
    });

    socket.on("callAnswer", (data) => {
      io.to(data.callerId).emit("callAnswer", data);
    });

    socket.on("iceCandidate", (data) => {
      io.to(data.targetUserId).emit("iceCandidate", data);
    });

    socket.on("rejectCall", async (data) => {
      try {
        await relayRejectCall(io, data);
      } catch (error) {
        socket.emit("callError", { message: error.message });
      }
    });

    socket.on("endCall", async (data) => {
      try {
        await relayEndCall(io, data);
      } catch (error) {
        socket.emit("callError", { message: error.message });
      }
    });

    // Handle sending messages
    socket.on("sendMessage", async (data) => {
      const result = await sendMessage(io, data);
      socket.emit("messageSent", result);
    });

    // Join a booking's tracking room (renter + driver + owner)
    socket.on("joinBooking", (bookingId) => {
      socket.join(`booking_${bookingId}`);
      console.log(`📍 Joined booking tracking room: ${bookingId}`);
    });

    // Live location ping from either the renter's or driver's phone (or a GPS device)
    socket.on("updateLocation", async (data) => {
      try {
        const point = await recordLocation(data);
        io.to(`booking_${data.bookingId}`).emit("locationUpdate", point);
      } catch (error) {
        socket.emit("locationError", { message: error.message });
      }
    });

    socket.on("disconnect", () => {
      console.log("🔴 User disconnected:", socket.id);
    });
  });
};
