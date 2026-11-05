import mongoose from "mongoose";
import { Conversation } from "../models/conversation.model.js";
import { io } from "../socket/socket.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { usernameCache } from "../utils/cache.js";
import { moderateText } from "../utils/gemini.js";

// In-memory bounded TTL cache for usernames to eliminate redundant User.findById queries on every message
const getCachedUsername = async (userId) => {
  const id = String(userId);
  const cached = usernameCache.get(id);
  if (cached !== undefined) return cached;
  const u = await User.findById(id).select("username");
  const name = u?.username || "";
  if (name) usernameCache.set(id, name);
  return name;
};

/**
 * Finds or creates a conversation for a pair of users by participantsKey (used for sendMessage and forwardMessage).
 */
const getOrCreateMergedConversation = async (id1, id2) => {
  const sortedParticipants = [String(id1), String(id2)].sort();
  const participantsKey = sortedParticipants.join(":");

  try {
    let conversation = await Conversation.findOne({ participantsKey });
    if (!conversation) {
      conversation = await Conversation.findOneAndUpdate(
        { participantsKey },
        {
          $setOnInsert: {
            participants: sortedParticipants,
            participantsKey
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    return conversation;
  } catch (err) {
    if (err.code === 11000 || err.message?.includes("E11000")) {
      return await Conversation.findOne({ participantsKey });
    }
    throw err;
  }
};

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const receiverId = req.params.id;
    const rawMessage = req.body.textMessage !== undefined ? req.body.textMessage : req.body.message;
    const postId = req.body.postId;

    const trimmedMessage = typeof rawMessage === "string" ? rawMessage.trim().slice(0, 2000) : "";

    if (!trimmedMessage && !postId) {
      return res.status(400).json({ success: false, message: "Message text or post attachment is required" });
    }

    if (String(senderId) === String(receiverId)) {
      return res.status(400).json({ success: false, message: "Cannot send message to yourself" });
    }

    // Moderate message text for policy violations
    if (trimmedMessage) {
      const textModeration = await moderateText(trimmedMessage);
      if (!textModeration.safe) {
        return res.status(400).json({
          success: false,
          message: textModeration.reason || "Message violates community policy."
        });
      }
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Receiver not found" });
    }

    let messageType = "text";
    let postAttachment = null;

    if (postId) {
      if (!mongoose.isValidObjectId(postId)) {
        return res.status(400).json({ success: false, message: "Invalid postId" });
      }
      const postDoc = await Post.findById(postId);
      if (!postDoc) {
        return res.status(404).json({ success: false, message: "Attached post not found" });
      }
      messageType = "post-share";
      postAttachment = postDoc._id;
    }

    await getOrCreateMergedConversation(senderId, receiverId);

    // create message in dedicated messages collection
    let newMessage = await Message.create({
      senderId,
      receiverId,
      messageType,
      message: trimmedMessage,
      postAttachment,
    });

    if (postAttachment) {
      newMessage = await newMessage.populate({
        path: "postAttachment",
        select: "image caption author createdAt",
        populate: { path: "author", select: "username profilePicture" },
      });
    }

    // emit realtime newMessage to both sender (other tabs) and receiver
    try {
      if (typeof io !== "undefined" && io) {
        const senderUsername = await getCachedUsername(senderId);
        const messagePayload = {
          ...newMessage.toObject(),
          senderUsername
        };
        io.to(String(senderId)).to(String(receiverId)).emit("newMessage", messagePayload);
      }
    } catch (emitErr) {
      console.error("emit newMessage error:", emitErr);
    }

    return res.status(201).json({ success: true, newMessage });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  }
};

export const getMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const receiverId = req.params.id;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const before = req.query.before;

    const participantFilter = {
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId }
      ]
    };

    let messageFilter = { ...participantFilter };

    // Cursor-based pagination support (?before=<lastMessageId>)
    if (before && mongoose.isValidObjectId(before)) {
      const cursorMsg = await Message.findOne({ _id: before, ...participantFilter }).select("createdAt");
      if (cursorMsg) {
        messageFilter.createdAt = { $lt: cursorMsg.createdAt };
      }
    }

    const totalMessages = await Message.countDocuments(participantFilter);

    const query = Message.find(messageFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: "postAttachment",
        select: "image caption author createdAt",
        populate: { path: "author", select: "username profilePicture" },
      });

    // If cursor was not passed, use skip-based offset if page > 1
    if (!before && page > 1) {
      const skip = (page - 1) * limit;
      query.skip(skip);
    }

    const paginatedMessageDocs = await query;
    const hasMore = before
      ? paginatedMessageDocs.length === limit
      : ((page - 1) * limit) + paginatedMessageDocs.length < totalMessages;

    const chronologicalMessages = paginatedMessageDocs.reverse();

    return res.status(200).json({
      success: true,
      messages: chronologicalMessages,
      page,
      limit,
      totalMessages,
      hasMore
    });
  } catch (error) {
    console.error("getMessage error:", error);
    return res.status(500).json({ success: false, message: "Failed to load messages" });
  }
};

export const getUnreadMessagesCount = async (req, res) => {
  try {
    const userId = req.id;
    const count = await Message.countDocuments({
      receiverId: userId,
      readAt: { $type: "null" }
    });
    return res.status(200).json({ success: true, count });
  } catch (err) {
    console.error("getUnreadMessagesCount error:", err);
    return res.status(500).json({ success: false, message: "Failed to load unread messages count" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const currentUserId = req.id;
    const senderId = req.params.id;

    if (!senderId) {
      return res.status(400).json({ success: false, message: "Sender ID is required" });
    }

    const result = await Message.updateMany(
      { senderId: senderId, receiverId: currentUserId, readAt: { $type: "null" } },
      { $set: { readAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("markMessagesAsRead error:", error);
    return res.status(500).json({ success: false, message: "Failed to mark messages as read" });
  }
};

// Edit message (sender only)
export const editMessage = async (req, res) => {
  try {
    const userId = req.id;
    const { id: messageId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Text is required" });
    }
    if (text.trim().length > 2000) {
      return res.status(400).json({ success: false, message: "Message cannot exceed 2000 characters" });
    }
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });
    if (String(msg.senderId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed to edit this message" });
    }
    if (msg.messageType === "post-share") {
      return res.status(400).json({ success: false, message: "Shared posts cannot be edited" });
    }
    msg.message = text.trim();
    await msg.save();

    // Emit realtime update to both sender (other tabs) and receiver
    try {
      if (typeof io !== "undefined" && io) {
        io.to(String(userId)).to(String(msg.receiverId)).emit("messageEdited", msg);
      }
    } catch (err) {
      console.error("emit messageEdited error:", err);
    }

    return res.status(200).json({ success: true, message: msg });
  } catch (err) {
    console.error("editMessage error:", err);
    return res.status(500).json({ success: false, message: "Failed to edit message" });
  }
};

// Delete a message (sender only)
export const deleteMessage = async (req, res) => {
  try {
    const userId = req.id; 
    const { id: messageId } = req.params;
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });
    if (String(msg.senderId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed to delete this message" });
    }

    const receiverId = String(msg.receiverId);

    // Delete message from messages collection
    await Message.deleteOne({ _id: messageId });

    // Emit realtime deletion to both sender (other tabs) and receiver
    try {
      if (typeof io !== "undefined" && io) {
        io.to(String(userId)).to(String(receiverId)).emit("messageDeleted", { messageId });
      }
    } catch (err) {
      console.error("emit messageDeleted error:", err);
    }

    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("deleteMessage error:", err);
    return res.status(500).json({ success: false, message: "Failed to delete message" });
  }
};

// Forward a message to a different user
export const forwardMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const { id: messageId } = req.params; // original message id
    const { toUserId } = req.body;

    if (!toUserId || !mongoose.isValidObjectId(toUserId)) {
      return res.status(400).json({ success: false, message: "Valid toUserId is required" });
    }

    if (String(senderId) === String(toUserId)) {
      return res.status(400).json({ success: false, message: "Cannot forward message to yourself" });
    }

    const recipient = await User.findById(toUserId).select("_id");
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient user not found" });
    }

    const original = await Message.findOne({
      _id: messageId,
      $or: [{ senderId }, { receiverId: senderId }],
    });
    if (!original) return res.status(404).json({ success: false, message: "Original message not found" });

    await getOrCreateMergedConversation(senderId, toUserId);

    // Create a new message preserving text, type, and post attachment
    let newMsg = await Message.create({
      senderId,
      receiverId: toUserId,
      messageType: original.messageType || "text",
      message: (original.message || "").slice(0, 2000),
      postAttachment: original.postAttachment || null,
    });

    if (newMsg.postAttachment) {
      newMsg = await newMsg.populate({
        path: "postAttachment",
        select: "image caption author createdAt",
        populate: { path: "author", select: "username profilePicture" },
      });
    }

    // Realtime emit to both sender (other tabs) and receiver if online
    try {
      if (typeof io !== "undefined" && io) {
        const senderUsername = await getCachedUsername(senderId);
        const forwardPayload = {
          ...newMsg.toObject(),
          senderUsername
        };
        io.to(String(senderId)).to(String(toUserId)).emit("newMessage", forwardPayload);
      }
    } catch (err) {
      console.error("emit forward newMessage error:", err);
    }

    return res.status(201).json({ success: true, message: newMsg });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to forward message" });
  }
};
