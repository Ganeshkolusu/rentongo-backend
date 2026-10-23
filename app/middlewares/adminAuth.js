const User = require("../model/user");

/**
 * Must run after requireAuth (needs req.userId set). Rejects anyone whose
 * User document isn't role:"admin". Promote a user to admin by hand in
 * MongoDB — there's no self-serve admin signup.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { requireAdmin };
