const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true, sparse: true, index: true }, // legacy, no longer set on new signups
    name: { type: String, index: true }, // for searching users
    email: { type: String, required: true, unique: true, index: true },
    profilePic: { type: String },
    mobilenumber: { type: String, index: true }, // search by number
    latitude: { type: String },
    longitude: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },

    fcmTokens: [
      {
        token: { type: String, required: true },
        platform: {
          type: String,
          enum: ["android", "ios", "web"],
          default: "web",
        },
      },
    ],
  },
  { timestamps: true }
);

// ⚡ Additional Indexes
UserSchema.index({ createdAt: -1 }); // for latest users
UserSchema.index({ email: 1, googleId: 1 }); // compound index

module.exports = mongoose.model("User", UserSchema);
