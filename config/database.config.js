require("dotenv").config();

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not set in the environment (.env)");
}

module.exports = {
  url: process.env.MONGO_URI,
};