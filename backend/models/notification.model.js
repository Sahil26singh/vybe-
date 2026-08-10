// backend/models/notification.model.js
import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },   // receiver
  from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },// actor 
  type: { type: String, enum: ["like","follow","message","comment","other"], required: true },
  read: { type: Boolean, default: false },
  opened: { type: Boolean, default: false }, 
  data: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});
NotificationSchema.index({ to: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", NotificationSchema);
