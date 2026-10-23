const notifi = require("../model/notification");

exports.getNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await notifi.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notifi.findById(id);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    if (notification.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You can only update your own notifications" });
    }

    notification.seen = true;
    await notification.save();

    res.status(200).json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ success: false, message: "You can only update your own notifications" });
    }

    await notifi.updateMany({ userId }, { $set: { seen: true } });
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notification = await notifi.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    if (notification.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "You can only delete your own notifications" });
    }

    await notifi.findByIdAndDelete(notificationId);
    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteAllNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId !== req.userId) {
      return res.status(403).json({ success: false, message: "You can only clear your own notifications" });
    }

    await notifi.deleteMany({ userId });
    res.status(200).json({ success: true, message: "All notifications deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
