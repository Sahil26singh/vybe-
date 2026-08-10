import { Notification } from '../models/notification.model.js';


export const listNotifications = async (req, res) => {
try {
const userId = req.id || req.userId || (req.user && req.user._id);
if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });


const page = Math.max(0, parseInt(req.query.page || '0'));
const limit = Math.min(100, parseInt(req.query.limit || '30'));


const notifs = await Notification.find({ to: userId })
.sort({ createdAt: -1 })
.skip(page * limit)
.limit(limit)
.populate('from', 'username profilePicture')
.lean();


return res.json({ success: true, data: notifs });
} catch (err) {
console.error(err);
return res.status(500).json({ success: false, message: 'Server error' });
}
};


export const markRead = async (req, res) => {
try {
const userId = req.id || req.userId || (req.user && req.user._id);
if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
const id = req.params.id;


const notif = await Notification.findOneAndUpdate({ _id: id, to: userId }, { read: true }, { new: true });
if (!notif) return res.status(404).json({ success: false, message: 'Not message found' });
return res.json({ success: true, data: notif });
} catch (err) {
console.error(err);
return res.status(500).json({ success: false, message: 'Server error' });
}
};


export const markAllRead = async (req, res) => {
try {
const userId = req.id || req.userId || (req.user && req.user._id);
if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
await Notification.updateMany({ to: userId, read: false }, { read: true });
return res.json({ success: true });
} catch (err) {
console.error(err);
return res.status(500).json({ success: false, message: 'Server error' });
}
};

export const deleteNotification = async (req, res) => {
  try {
    const notifId = req.params.id;
    const userId = req.id || req.userId || req.user?._id;

    if (!notifId) {
      return res.status(400).json({ success: false, message: "Notification id is required" });
    }

    await Notification.findOneAndDelete({ _id: notifId, to: userId });
    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("deleteNotification error:", err);
    return res.status(500).json({ success: false, message: "Server error while deleting notification" });
  }
};