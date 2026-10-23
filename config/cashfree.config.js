require("dotenv").config();

if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
  throw new Error(
    "CASHFREE_APP_ID and CASHFREE_SECRET_KEY must be set in the environment (.env)"
  );
}

const env = (process.env.CASHFREE_ENV || "SANDBOX").toUpperCase();

module.exports = {
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
  webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY,
  env,
  baseUrl:
    env === "PRODUCTION"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg",
};
