

// const express = require('express');
// const bodyParser = require('body-parser');
// const http = require('http');
// const cors = require("cors");
// const { Server } = require('socket.io');
// const mongoose = require('mongoose');
// const dotenv = require('dotenv');
// const UserRoute = require('./app/routes/Routes.js');
// const socketHandler = require('./app/middlewares/socket.js');
// const dbConfig = require('./config/database.config.js');

// require('./app/jobs/bookingAutoCompleteJob.js');   // <-- Make sure path is correct


// dotenv.config();
// const app = express();

// app.use(bodyParser.urlencoded({ extended: true }));
// app.use(bodyParser.json());
// app.use(cors());

// app.use('/', UserRoute);

// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: {
//     origin: '*',
//     methods: ['GET', 'POST']
//   }
// });

// socketHandler(io);

// mongoose.connect(dbConfig.url)
//   .then(() => console.log('✅ Database Connected Successfully!'))
//   .catch(err => {
//     console.error('❌ Could not connect to the database:', err);
//     process.exit(1);
//   });

// app.get('/', (req, res) => {
//   res.json({ message: 'Hello RentOnGoVehicle' });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`🚀 Server is running on port ${PORT}`);
// });





const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const UserRoute = require("./app/routes/Routes");
const socketHandler = require("./app/middlewares/socket");
const dbConfig = require("./config/database.config");
const subscriptionController = require("./app/controller/subscription");

require("./app/jobs/bookingAutoCompleteJob");
require("./app/jobs/subscriptionExpiryJob");

dotenv.config();
const app = express();

// Sits behind nginx (PM2 fork mode on the VPS), so requests arrive with the
// real client IP in X-Forwarded-For. Without this, req.ip (and therefore
// every rate limiter below) would see only the proxy's IP for every request.
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());

// Cashfree's webhook signature is computed over the exact raw request body,
// so this route must get express.raw() instead of the global express.json()
// below — it's registered first so its own middleware runs instead. It's
// also registered before the rate limiters, so payment webhooks are never
// throttled.
app.post(
  "/subscriptions/webhook",
  express.raw({ type: "application/json" }),
  subscriptionController.handleWebhook
);

// General API-wide throttle: generous enough not to bite normal usage
// (polling, chat, etc.), just a backstop against a runaway client or abuse.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use(generalLimiter);

// Dev-only request log: one line per request with status and timing.
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });
}

// OTP endpoints are the actual abuse target here (SMS/email cost, brute-forcing
// a code) — much stricter than the general limiter.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later." },
});
app.use(["/auth/request-otp", "/auth/verify-otp"], otpLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const corsOptions = {
  // Allow every origin. Note: a literal '*' can't be combined with
  // credentials:true (browsers reject that per the CORS spec), so instead
  // this reflects back whatever Origin the request sent — the standard way
  // to open CORS to all origins while still supporting Authorization headers.
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],
};

app.use(cors(corsOptions));


app.use("/", UserRoute);

app.get("/", (req, res) => {
  res.json({ message: "🚀 RentOnGoVehicle API is running" });
});

// Unmatched route — JSON instead of Express's default HTML 404 page.
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

// Final error handler. Express 5 forwards a route handler's thrown/rejected
// errors here automatically (no per-route try/catch required), so this is
// what stands between a bug in any single request and the whole process
// crashing — it must be the last app.use().
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    message: "Server error",
    ...(process.env.NODE_ENV !== "production" && { error: err.message }),
  });
});

const server = http.createServer(app);


const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
});

app.set("io", io);
socketHandler(io);


mongoose
  .connect(dbConfig.url)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  });


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
