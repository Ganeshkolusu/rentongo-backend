const mongoose = require("mongoose");
const Review = require("../model/reviews");

// ➕ Create Review
exports.createReview = async (req, res) => {
  try {
    const userId = req.userId;
    const { vechileType, VechileId, BookingId, review, rating } = req.body;

    // 🔍 Validation checks
    if (!vechileType) return res.status(400).json({ success: false, message: "vechileType is required" });
    if (!VechileId) return res.status(400).json({ success: false, message: "VechileId is required" });
    if (!BookingId) return res.status(400).json({ success: false, message: "BookingId is required" });
    if (!review) return res.status(400).json({ success: false, message: "Review text is required" });
    if (!rating) return res.status(400).json({ success: false, message: "Rating is required" });

    // ✅ Create new review
    const newReview = new Review({
      userId,
      vechileType,
      VechileId,
      BookingId,
      review,
      rating
    });

    await newReview.save();

    res.status(201).json({ success: true, message: "Review created successfully", data: newReview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✏️ Update Review
exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;

    // Find review
    let review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    if (review.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You do not own this review" });
    }

    const { vechileType,VechileId, review: reviewText, rating,BookingId } = req.body;

    // ✅ Update fields (only if provided)
    review.vechileType = vechileType ?? review.vechileType;
    review.VechileId = VechileId ?? review.VechileId;
    review.BookingId = BookingId ?? review.BookingId;
    review.review = reviewText ?? review.review;
    review.rating = rating ?? review.rating;

    await review.save();

    res.json({ success: true, message: "Review updated successfully", data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ❌ Delete Review
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    if (review.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You do not own this review" });
    }

    // ✅ Delete review from DB
    await review.deleteOne();

    res.json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getReviews = async (req, res) => {
  try {
    const { vechileType, VechileId } = req.query;
    const filter = {};
    if (vechileType) filter.vechileType = vechileType;
    if (VechileId) filter.VechileId = VechileId;
    const reviews = await Review.find(filter).populate('userId', 'username email profilePic');
    res.json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReviewById = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id).populate('userId', 'name email profilePic').populate('VechileId', 'name model');
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }   
    res.json({ success: true, data: review });
    } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAverageRating = async (req, res) => {
  try {
    const { vechileType } = req.query;
    // The mobile and web clients send `vechileId`; older callers send `VechileId`.
    const vehicleId = req.query.VechileId || req.query.vechileId;

    // ✅ Validate input — both are required, otherwise this would average the
    // ratings of every vehicle of that type.
    if (!vechileType || !vehicleId || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({
        success: false,
        message: "Please provide both vechileType and a valid VechileId",
      });
    }

    // aggregate() doesn't cast like find() does, so the id must be an ObjectId to match.
    const filter = { vechileType, VechileId: new mongoose.Types.ObjectId(vehicleId) };

    // ✅ Aggregate review stats
    const result = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    if (!result.length) {
      return res.status(404).json({
        success: false,
        message: "No reviews found for the given vehicle",
      });
    }

    // ✅ Calculate totals and percentages
    const totalReviews = result.reduce((acc, cur) => acc + cur.count, 0);
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    result.forEach((r) => {
      ratingCounts[r._id] = r.count;
    });

    const percentages = {};
    for (let i = 1; i <= 5; i++) {
      percentages[i] = ((ratingCounts[i] / totalReviews) * 100).toFixed(1);
    }

    // ✅ Calculate average rating
    const totalRatingValue = Object.entries(ratingCounts).reduce(
      (sum, [rating, count]) => sum + rating * count,
      0
    );
    const averageRating = (totalRatingValue / totalReviews).toFixed(1);

    res.status(200).json({
      success: true,
      data: {
        averageRating,
        totalReviews,
        ratings: {
          "1_star": { count: ratingCounts[1], percentage: percentages[1] },
          "2_star": { count: ratingCounts[2], percentage: percentages[2] },
          "3_star": { count: ratingCounts[3], percentage: percentages[3] },
          "4_star": { count: ratingCounts[4], percentage: percentages[4] },
          "5_star": { count: ratingCounts[5], percentage: percentages[5] },
        },
      },
    });
  } catch (error) {
    console.error("Error calculating average rating:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating average rating",
      error: error.message,
    });
  }
};
