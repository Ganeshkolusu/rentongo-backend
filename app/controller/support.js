const SupportTicket = require("../model/support");

// ➤ Create a new support ticket
exports.createTicket = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      vehicleType,
      vehicleId,
      bookingId,
      subject,
      description,
      priority,
    } = req.body;

    const ticket = await SupportTicket.create({
      userId,
      vehicleType,
      vehicleId,
      bookingId,
      subject,
      description,
      priority,
    });

    res
      .status(201)
      .json({ message: "Ticket created successfully", ticket });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Get all tickets (Admin or support team)
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      //.populate("userId", "name email")
      //.populate("vehicleId", "vehicleName vehicleNumber")
      //.populate("bookingId", "bookingDate totalAmount")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ message: "Tickets fetched successfully", tickets });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Get tickets by user ID
exports.getTicketsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.userId) {
      return res.status(403).json({ message: "You can only view your own tickets" });
    }

    const tickets = await SupportTicket.find({ userId })
     // .populate("vehicleId", "vehicleName vehicleNumber")
      //.populate("bookingId", "bookingDate totalAmount")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json({ message: "User tickets fetched successfully", tickets });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Update ticket status or add review/rating
exports.updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review, rating } = req.body;

    const existing = await SupportTicket.findById(id);
    if (!existing)
      return res.status(404).json({ message: "Ticket not found" });

    if (existing.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this ticket" });
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      id,
      { status, review, rating, reviewDate: Date.now() },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Ticket updated successfully", ticket });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Delete a ticket (optional)
exports.deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await SupportTicket.findById(id);
    if (!existing)
      return res.status(404).json({ message: "Ticket not found" });

    if (existing.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "You do not own this ticket" });
    }

    const deleted = await SupportTicket.findByIdAndDelete(id);

    res.status(200).json({ message: "Ticket deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
