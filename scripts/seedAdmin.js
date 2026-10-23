// One-off script: create (or promote) a default admin account.
// Usage: node scripts/seedAdmin.js [email] [name]
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../app/model/user");
const dbConfig = require("../config/database.config");

const email = (process.argv[2] || "admin@rentongo.com").toLowerCase().trim();
const name = process.argv[3] || "Admin";

(async () => {
  await mongoose.connect(dbConfig.url);

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: "admin" }, $setOnInsert: { email, name } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Admin ready: ${user.email} (role: ${user.role}, id: ${user._id})`);
  console.log(`Log in on the webapp with this email via the normal OTP flow.`);

  await mongoose.disconnect();
})().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
