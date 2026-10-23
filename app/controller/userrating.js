const UserRating = require("../model/userrating");

// ➤ Create User Rating
exports.createUserRating = async (req, res) => {
  try {
    const { userId, BookingId, review, rating } = req.body;

    if (!userId || !BookingId || !review || !rating) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newRating = new UserRating({ userId, BookingId, review, rating });
    await newRating.save();

    res.status(201).json({ message: "User rating created successfully", rating: newRating });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


