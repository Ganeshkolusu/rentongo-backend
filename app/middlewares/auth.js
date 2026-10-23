const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in the environment (.env)");
}

/**
 * Requires a valid app-issued JWT (Authorization: Bearer <token>).
 * Sets req.userId on success.
 */
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Like requireAuth, but for public routes: sets req.userId when a valid token
 * is sent, and lets the request through anonymously otherwise.
 */
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      req.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    } catch (error) {
      // Invalid/expired token on a public route — treat as anonymous.
    }
  }
  next();
};

const signToken = (userId) =>
  jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: "30d" });

module.exports = { requireAuth, optionalAuth, signToken };
