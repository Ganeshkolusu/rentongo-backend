const router = require("express").Router();

const userController = require("../controller/user");
const AutoController = require("../controller/auto");
const CarController = require("../controller/cars");
const BikeController = require("../controller/bike");
const bookingController =require("../controller/Bookings");
const avalibilityController =require("../controller/avalibility");
const userRatingController = require("../controller/userrating");
const ChatController = require("../controller/chating");
const SupportController = require("../controller/support");
const callingController = require("../controller/calling");
const notificationController = require("../controller/notifications");
const trackingController = require("../controller/tracking");
const otpController = require("../controller/otp");
const subscriptionController = require("../controller/subscription");
const adminController = require("../controller/admin");


const {upload} = require("../middlewares/upload");
const { requireAuth, optionalAuth } = require("../middlewares/auth");
const { requireAdmin } = require("../middlewares/adminAuth");

//auth — email OTP login/signup (no password, no Google Sign-In)
router.post("/auth/request-otp", otpController.requestOtp);
router.post("/auth/verify-otp", otpController.verifyOtp);

// owner listing subscriptions (Cashfree) — the webhook route lives directly
// in server.js since it needs a raw request body, not express.json()
router.post("/subscriptions/create-order", requireAuth, subscriptionController.createOrder);
router.get("/subscriptions/me", requireAuth, subscriptionController.getMyStatus);

// superadmin — every route here requires requireAuth then requireAdmin
router.get("/admin/users", requireAuth, requireAdmin, adminController.getAllUsers);
router.get("/admin/vehicles", requireAuth, requireAdmin, adminController.getAllVehicles);
router.get("/admin/bookings", requireAuth, requireAdmin, adminController.getAllBookings);
router.get("/admin/subscriptions", requireAuth, requireAdmin, adminController.getAllSubscriptions);
router.get("/admin/plans", requireAuth, requireAdmin, adminController.getPlans);
router.put("/admin/plans/:planId", requireAuth, requireAdmin, adminController.updatePlan);
router.put("/admin/vehicles/:vehicleType/:vehicleId/photo/:index", requireAuth, requireAdmin, upload.single("photo"), adminController.replaceVehiclePhoto);

//users
router.get("/getAllUsers",requireAuth,userController.getAllUsers);
router.get("/getUserById/:id",requireAuth,userController.getUserById);
router.put("/updateUser/:id",requireAuth,upload.single("profilePic"),userController.updateUser);
router.delete("/deleteUser/:id",requireAuth,userController.deleteUser);
router.get("/myBookings/:userId",requireAuth,userController.myBookings);
router.get("/myVehicles/:userId",requireAuth,userController.myVehicles);
router.get("/myVehicleBookings/:userId",requireAuth,userController.myVehicleBookings);
router.get("/createUserRating",requireAuth, userRatingController.createUserRating);
router.get('/getVehicleAvailability',avalibilityController.getVehicleAvailability);

router.post("/updateVehicleStatus",requireAuth,requireAdmin,require("../controller/updateVehicle").updateVehicleStatus);
router.get("/getPendingVehicles",requireAuth,requireAdmin,require("../controller/updateVehicle").getPendingVehicles);
//Auto routes
router.post("/createAuto",requireAuth, upload.array("autoImages", 5), AutoController.createAuto);
router.put("/updateAuto/:id",requireAuth, upload.array("autoImages", 5), AutoController.updateAuto);
router.delete("/deleteAuto/:id",requireAuth, AutoController.deleteAuto);
router.get("/getNearbyAutos", optionalAuth, AutoController.getNearbyAutos);
router.get("/getAutobyId/:id", AutoController.getAutobyId);

//car routes
router.post("/createCar",requireAuth, upload.array("carImages", 5),CarController.createCar);
router.put("/updateCar/:id",requireAuth, upload.array("carImages", 5),CarController.updateCar);
router.delete("/deleteCar/:id",requireAuth, CarController.deleteCar);
router.get("/getNearbyCars", optionalAuth, CarController.getNearbyCars);
router.get("/getCarById/:id", CarController.getCarById);
//bike routes
router.post("/createBike",requireAuth,upload.array("bikeImages",5),BikeController.createBike);
router.put("/updateBike/:id",requireAuth,upload.array("bikeImages",5),BikeController.updateBike);
router.delete("/deleteBike/:id",requireAuth,BikeController.deleteBikes);
router.get("/getBikeById/:id",BikeController.getBikeById);
router.get("/getNearbyBikes",optionalAuth,BikeController.getNearestBikes);

// bookings
router.post("/createBooking",requireAuth,bookingController.createBooking);
router.put("/updateBooking/:id",requireAuth,bookingController.updateBooking);
router.delete("/deleteBooking/:id",requireAuth,bookingController.deleteBooking);
router.get("/getBookingById/:id",requireAuth,bookingController.getBookingById);
router.get("/getAllBookings",requireAuth,bookingController.getAllBookings);
router.post("/confirmBooking/:id/:status",requireAuth,bookingController.confirmBooking);
router.get("/getPendingBookingsOfOwner/:userId",requireAuth,bookingController.getPendingBookingsOfOwner);



//avalibility
router.post("/createNotAvailability",requireAuth,avalibilityController.createNotAvailability);
router.put("/updateNotAvailability/:id",requireAuth,avalibilityController.updateNotAvailability);
router.delete("/deleteNotAvailability/:id",requireAuth,avalibilityController.deleteNotAvailability);
router.get("/getNotAvailabilityById/:id",avalibilityController.getNotAvailabilityById);
router.get("/getAllNotAvailabilities",avalibilityController.getAllNotAvailabilities);


//review routes
const ReviewController = require("../controller/review");
router.post("/addReview",requireAuth, ReviewController.createReview);
router.get("/getReviews", ReviewController.getReviews);
router.put("/updateReview/:id",requireAuth, ReviewController.updateReview);
router.delete("/deleteReview/:id",requireAuth, ReviewController.deleteReview);
router.get("/getReviewById/:id", ReviewController.getReviewById);
router.get("/getAverageRating", ReviewController.getAverageRating);

//chat routes
router.post("/sendMessage",requireAuth,upload.array("files", 5), ChatController.sendMessageHttp);
router.get("/getMessages/:bookingId",requireAuth, ChatController.getMessages);

//support routes
router.post("/createTicket",requireAuth, SupportController.createTicket);
router.get("/getAllTickets",requireAuth, SupportController.getAllTickets);
router.get("/getTicketsByUser/:userId",requireAuth, SupportController.getTicketsByUser);
router.put("/updateTicket/:id",requireAuth, SupportController.updateTicket);
router.delete("/deleteTicket/:id",requireAuth, SupportController.deleteTicket);

//calling
router.post("/start",requireAuth, callingController.startCall);
router.post("/save-offer",requireAuth, callingController.saveOffer);
router.post("/save-answer",requireAuth, callingController.saveAnswer);
router.post("/add-ice",requireAuth, callingController.addIceCandidate);
router.post("/update-status",requireAuth, callingController.updateStatus);
router.post("/end",requireAuth, callingController.endCall);
router.post("/rejectCall",requireAuth, callingController.rejectCall);

router.get("/history/:userId",requireAuth, callingController.getHistory);
router.get("/active/:userId",requireAuth, callingController.getActiveCall);


//notifications

router.get("/notifications/:userId",requireAuth, notificationController.getNotifications);
router.put("/markNotificationRead/:id",requireAuth, notificationController.markNotificationRead);
router.put("/markAllNotificationsRead/:userId",requireAuth, notificationController.markAllNotificationsRead);
router.delete("/deleteNotification/:notificationId",requireAuth, notificationController.deleteNotification);
router.delete("/clearAllNotifications/:userId",requireAuth, notificationController.deleteAllNotifications);

//live tracking (renter phone, driver phone, or GPS device all push through this)
router.post("/updateLocation",requireAuth, trackingController.updateLocation);
router.get("/getLatestLocation/:bookingId",requireAuth, trackingController.getLatestLocation);
router.get("/getLocationHistory/:bookingId",requireAuth, trackingController.getLocationHistory);


//vechile images
const bookingMediaController = require("../controller/bookingimages");

// BEFORE TRIP
router.post(
  "/before/image/:bookingId",
  requireAuth,
  bookingMediaController.uploadBeforeImages
);

router.post(
  "/before/video/:bookingId",
  requireAuth,
  bookingMediaController.uploadBeforeVideos
);

// AFTER TRIP
router.post(
  "/after/image/:bookingId",
  requireAuth,
  bookingMediaController.uploadAfterImages
);
router.post(
  "/after/video/:bookingId",
  requireAuth,
  bookingMediaController.uploadAfterVideos
);

// ➤ Delete a ticket (optional)
module.exports = router;
