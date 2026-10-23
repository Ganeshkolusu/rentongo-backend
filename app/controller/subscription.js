const crypto = require("crypto");
const Subscription = require("../model/subscription");
const User = require("../model/user");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const { getPlan } = require("../utils/planCatalog");
const cashfreeService = require("../services/cashfreeService");

const setBoostedForOwner = async (userId, boosted) => {
  await Promise.all([
    Car.updateMany({ userId }, { boosted }),
    Bike.updateMany({ userId }, { boosted }),
    Auto.updateMany({ userId }, { boosted }),
  ]);
};

// ➤ Get the caller's current subscription status
exports.getMyStatus = async (req, res) => {
  try {
    let subscription = await Subscription.findOne({ userId: req.userId });

    if (!subscription) {
      return res.status(200).json({
        plan: "free",
        status: "active",
        expiresAt: null,
        limits: await getPlan("free"),
      });
    }

    // Belt-and-suspenders alongside the expiry cron: reflect a lapsed plan
    // immediately even if the cron hasn't swept it yet.
    const effectivePlan =
      subscription.plan === "pro" &&
      subscription.status === "active" &&
      subscription.expiresAt &&
      subscription.expiresAt.getTime() < Date.now()
        ? "free"
        : subscription.plan;

    res.status(200).json({
      plan: effectivePlan,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      limits: await getPlan(effectivePlan),
    });
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ➤ Create a Cashfree order for a plan purchase/renewal
exports.createOrder = async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || plan === "free") {
      return res.status(400).json({ message: "A valid paid plan is required" });
    }

    const planDef = await getPlan(plan);
    if (!planDef) {
      return res.status(400).json({ message: "A valid paid plan is required" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.mobilenumber) {
      return res.status(400).json({
        message: "Add a mobile number to your profile before subscribing — it's required for payment.",
      });
    }

    const orderId = `sub_${req.userId}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

    const { paymentSessionId } = await cashfreeService.createOrder({
      orderId,
      amount: planDef.price,
      customerId: req.userId,
      customerEmail: user.email,
      customerPhone: user.mobilenumber,
    });

    await Subscription.findOneAndUpdate(
      { userId: req.userId },
      { $set: { cashfreeOrderId: orderId } },
      { upsert: true }
    );

    res.status(200).json({
      message: "Order created",
      orderId,
      paymentSessionId,
      amount: planDef.price,
      plan,
    });
  } catch (error) {
    console.error("Error creating subscription order:", error);
    res.status(500).json({ message: "Failed to create payment order", error: error.message });
  }
};

// ➤ Cashfree webhook — server-to-server, no requireAuth. Verifies signature
// against the raw body (see server.js for why this route needs raw(), not json()).
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.body; // Buffer, thanks to express.raw() on this route

    const event = cashfreeService.verifyWebhookSignature(rawBody, signature, timestamp);
    if (!event) {
      return res.status(401).json({ message: "Invalid webhook signature" });
    }

    const eventType = event.type;
    const orderId = event.data?.order?.order_id;

    if (eventType !== "PAYMENT_SUCCESS_WEBHOOK" && eventType !== "PAYMENT_SUCCESS") {
      // Not a success event (failed/pending/refund/etc.) — nothing to activate.
      return res.status(200).json({ message: "Event ignored" });
    }

    const subscription = await Subscription.findOne({ cashfreeOrderId: orderId });
    if (!subscription) {
      console.warn("Webhook for unknown order:", orderId);
      return res.status(200).json({ message: "No matching subscription for this order" });
    }

    // Idempotency: a webhook can be delivered more than once.
    if (subscription.status === "active" && subscription.cashfreeOrderId === orderId && subscription.plan === "pro") {
      const alreadyRecorded = subscription.history.some((h) => h.orderId === orderId);
      if (alreadyRecorded) {
        return res.status(200).json({ message: "Already processed" });
      }
    }

    const amount = event.data?.order?.order_amount;
    const planDef = await getPlan("pro");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + planDef.durationDays * 24 * 60 * 60 * 1000);

    subscription.plan = "pro";
    subscription.status = "active";
    subscription.startedAt = now;
    subscription.expiresAt = expiresAt;
    subscription.lastPaymentAmount = amount;
    subscription.expiryReminderSentAt = null; // fresh cycle — allow a new reminder before this expiry
    subscription.history.push({ orderId, plan: "pro", amount, paidAt: now });
    await subscription.save();

    await setBoostedForOwner(subscription.userId, true);

    res.status(200).json({ message: "Subscription activated" });
  } catch (error) {
    console.error("Error handling Cashfree webhook:", error);
    res.status(500).json({ message: "Webhook processing failed", error: error.message });
  }
};
