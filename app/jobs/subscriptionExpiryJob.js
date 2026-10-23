const cron = require("node-cron");
const Subscription = require("../model/subscription");
const Car = require("../model/car");
const Bike = require("../model/bikes");
const Auto = require("../model/auto");
const User = require("../model/user");
const Notification = require("../model/notification");
const admin = require("../../config/firebase");

const REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // notify 3 days before expiry

cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("⏰ Checking Pro subscriptions for expiry...");
    const now = new Date();

    const lapsed = await Subscription.find({
      plan: "pro",
      status: "active",
      expiresAt: { $lte: now },
    }).limit(100);

    await Promise.all(
      lapsed.map(async (subscription) => {
        subscription.plan = "free";
        subscription.status = "expired";
        await subscription.save();

        await Promise.all([
          Car.updateMany({ userId: subscription.userId }, { boosted: false }),
          Bike.updateMany({ userId: subscription.userId }, { boosted: false }),
          Auto.updateMany({ userId: subscription.userId }, { boosted: false }),
        ]);

        console.log(`⬇️ Subscription for user ${subscription.userId} expired — reverted to free`);
      })
    );
  } catch (error) {
    console.error("Error in subscription-expiry cron:", error);
  }
});

// Warn owners before their Pro plan lapses, so they can renew in time to
// keep listing beyond the free plan's cap and keep priority placement.
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + REMINDER_WINDOW_MS);

    const expiringSoon = await Subscription.find({
      plan: "pro",
      status: "active",
      expiresAt: { $gt: now, $lte: soon },
      expiryReminderSentAt: null,
    }).limit(100);

    for (const subscription of expiringSoon) {
      const daysLeft = Math.max(1, Math.ceil((subscription.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
      const title = "Your Pro plan is expiring soon";
      const message = `Your Pro subscription expires on ${subscription.expiresAt.toLocaleDateString()} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left). Renew to keep unlimited listings and priority placement.`;

      try {
        await Notification.create({
          userId: subscription.userId,
          ownerId: subscription.userId,
          type: "SubscriptionExpiring",
          title,
          messages: message,
        });

        const user = await User.findById(subscription.userId);
        if (user?.fcmTokens?.length) {
          const tokens = user.fcmTokens.map((t) => t.token);
          const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body: message },
          });
          const invalidTokens = response.responses
            .map((r, i) => (!r.success ? tokens[i] : null))
            .filter(Boolean);
          if (invalidTokens.length) {
            await User.updateOne(
              { _id: subscription.userId },
              { $pull: { fcmTokens: { token: { $in: invalidTokens } } } }
            );
          }
        }

        subscription.expiryReminderSentAt = now;
        await subscription.save();

        console.log(`📣 Sent expiry reminder to user ${subscription.userId} (expires ${subscription.expiresAt.toISOString()})`);
      } catch (notifyError) {
        console.error(`Failed to send expiry reminder for user ${subscription.userId}:`, notifyError);
      }
    }
  } catch (error) {
    console.error("Error in subscription-expiry-reminder cron:", error);
  }
});
