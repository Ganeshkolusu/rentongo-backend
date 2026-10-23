const Subscription = require("../model/subscription");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const { getPlan } = require("./planCatalog");

const getEffectivePlan = async (userId) => {
  const subscription = await Subscription.findOne({ userId });
  if (!subscription) return "free";

  // Belt-and-suspenders alongside subscriptionExpiryJob.js: reflect a lapsed
  // plan immediately even if the cron hasn't swept it yet.
  if (
    subscription.plan === "pro" &&
    subscription.status === "active" &&
    subscription.expiresAt &&
    subscription.expiresAt.getTime() < Date.now()
  ) {
    return "free";
  }

  return subscription.plan;
};

/**
 * Throws an Error (with `.status = 403`) if this owner is already at their
 * plan's vehicle-listing cap. No-op for unlimited (Pro) plans. Only meant to
 * gate NEW listings — never call this from an update/edit path.
 */
exports.assertCanAddVehicle = async (userId) => {
  const plan = await getEffectivePlan(userId);
  const planDef = await getPlan(plan);
  const maxVehicles = planDef?.maxVehicles;

  if (maxVehicles === null || maxVehicles === undefined) return; // unlimited

  const [carCount, bikeCount, autoCount] = await Promise.all([
    Car.countDocuments({ userId }),
    Bike.countDocuments({ userId }),
    Auto.countDocuments({ userId }),
  ]);

  if (carCount + bikeCount + autoCount >= maxVehicles) {
    const error = new Error(
      `Vehicle limit reached for your ${plan} plan (max ${maxVehicles}). Upgrade to Pro to list more vehicles.`
    );
    error.status = 403;
    throw error;
  }
};

exports.getEffectivePlan = getEffectivePlan;
