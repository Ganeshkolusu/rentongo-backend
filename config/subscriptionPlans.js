// Owner listing-subscription tiers. Prices are in INR.
// Free: 1 vehicle listing. Pro: unlimited vehicles + priority placement in
// nearby-vehicle search results.
module.exports = {
  free: {
    id: "free",
    label: "Free",
    maxVehicles: 1,
    priority: false,
    price: 0,
  },
  pro: {
    id: "pro",
    label: "Pro",
    maxVehicles: Infinity,
    priority: true,
    price: 499,
    durationDays: 30,
  },
};
