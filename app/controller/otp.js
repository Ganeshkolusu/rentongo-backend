const crypto = require("crypto");
const Otp = require("../model/otp");
const User = require("../model/user");
const { signToken } = require("../middlewares/auth");
const { sendOtpEmail } = require("../services/emailService");

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends
const MAX_ATTEMPTS = 5;

// Dev-only fixed login for local testing, so the seeded admin account
// (scripts/seedAdmin.js) never needs a real inbox to receive a code.
// Never active in production.
const DEV_ADMIN_EMAIL = "admin@rentongo.com";
const DEV_ADMIN_OTP = "000000";
const isDevAdminBypass = (email) =>
  process.env.NODE_ENV !== "production" && email === DEV_ADMIN_EMAIL;

const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalize = (email) => email.toLowerCase().trim();

// ➤ Request an OTP be emailed for login/signup
exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email is required" });
    }

    const normalizedEmail = normalize(email);

    const existing = await Otp.findOne({ email: normalizedEmail });
    if (existing && Date.now() - existing.updatedAt.getTime() < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ message: "Please wait a minute before requesting another code" });
    }

    const devBypass = isDevAdminBypass(normalizedEmail);
    const otp = devBypass
      ? DEV_ADMIN_OTP
      : Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await Otp.findOneAndUpdate(
      { email: normalizedEmail },
      { codeHash, expiresAt, attempts: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (devBypass) {
      console.log(`[DEV] Fixed admin OTP for ${normalizedEmail}: ${DEV_ADMIN_OTP}`);
    } else {
      await sendOtpEmail(normalizedEmail, otp);
    }

    res.status(200).json({ message: "Verification code sent" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Failed to send verification code", error: error.message });
  }
};

// ➤ Verify the OTP and log the user in (creating their account on first verify)
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp, name, fcmToken, platform } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const normalizedEmail = normalize(email);
    const record = await Otp.findOne({ email: normalizedEmail });

    if (!record) {
      return res.status(400).json({ message: "No verification code found — request a new one" });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(400).json({ message: "Verification code expired — request a new one" });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(429).json({ message: "Too many incorrect attempts — request a new code" });
    }

    if (hashOtp(String(otp).trim()) !== record.codeHash) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ message: "Incorrect verification code" });
    }

    await Otp.deleteOne({ _id: record._id });

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = new User({
        email: normalizedEmail,
        name: name || normalizedEmail.split("@")[0],
        fcmTokens: fcmToken ? [{ token: fcmToken, platform: platform || "web" }] : [],
      });
      await user.save();
    } else if (fcmToken && !user.fcmTokens.some((t) => t.token === fcmToken)) {
      user.fcmTokens.push({ token: fcmToken, platform: platform || "web" });
      await user.save();
    }

    const token = signToken(user._id);
    res.status(200).json({ message: "Verified", user, token });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
