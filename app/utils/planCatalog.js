const Plan = require("../model/plan");
const DEFAULT_PLANS = require("../../config/subscriptionPlans");

/**
 * Plan pricing/limits now live in the DB (so an admin can edit them without
 * a redeploy) — config/subscriptionPlans.js only supplies the seed values
 * the first time each plan is read.
 */
const getPlan = async (planId) => {
  let plan = await Plan.findOne({ planId });

  if (!plan) {
    const seed = DEFAULT_PLANS[planId];
    if (!seed) return null;

    plan = await Plan.create({
      planId,
      label: seed.label,
      price: seed.price,
      durationDays: seed.durationDays || 30,
      maxVehicles: seed.maxVehicles === Infinity ? null : seed.maxVehicles,
      priority: !!seed.priority,
    });
  }

  return plan;
};

const getAllPlans = async () => {
  const ids = Object.keys(DEFAULT_PLANS);
  const plans = await Promise.all(ids.map(getPlan));
  return plans.filter(Boolean);
};

module.exports = { getPlan, getAllPlans };
