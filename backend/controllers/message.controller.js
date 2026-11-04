import mongoose from "mongoose";
import { Conversation } from "../models/conversation.model.js";
import { io } from "../socket/socket.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const receiverId = req.params.id;
    const { textMessage: message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message text cannot be empty" });
    }

    if (String(senderId) === String(receiverId)) {
      return res.status(400).json({ success: false, message: "Cannot send message to yourself" });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Receiver not found" });
    }

    const trimmedMessage = message.trim();
    const sortedParticipants = [String(senderId), String(receiverId)].sort();
    const participantsKey = sortedParticipants.join(":");

    // find or create conversation (upsert on participantsKey prevents duplicate simultaneous conversations)
    let conversation = await Conversation.findOne({
      $or: [
        { participantsKey },
        { participants: { $all: [senderId, receiverId] } }
      ]
    });

    if (!conversation) {
      conversation = await Conversation.findOneAndUpdate(
        { participantsKey },
        {
          $setOnInsert: {
            participants: sortedParticipants,
            participantsKey,
            messages: []
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (!conversation.participantsKey) {
      conversation.participantsKey = participantsKey;
      await conversation.save().catch(() => {});
    }

    // create message
    const newMessage = await Message.create({
      senderId,
      receiverId,
      message: trimmedMessage
    });

    // push message id into conversation atomically
    await Conversation.findByIdAndUpdate(conversation._id, { $push: { messages: newMessage._id } });

    // emit realtime newMessage to both sender (other tabs) and receiver
    try {
      if (typeof io !== "undefined" && io) {
        const senderUser = await User.findById(senderId).select("username profilePicture");
        const messagePayload = {
          ...newMessage.toObject(),
          senderUsername: senderUser?.username || ""
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

    const sortedParticipants = [String(senderId), String(receiverId)].sort();
    const participantsKey = sortedParticipants.join(":");

    const conversation = await Conversation.findOne({
      $or: [
        { participantsKey },
        { participants: { $all: [senderId, receiverId] } }
      ]
    });
    if (!conversation) {
      return res.status(200).json({ success: true, messages: [], totalMessages: 0, hasMore: false });
    }

    const totalMessages = conversation.messages.length;

    let messageFilter = { _id: { $in: conversation.messages } };

    // Cursor-based pagination support (?before=<lastMessageId>)
    if (before && mongoose.isValidObjectId(before)) {
      const cursorMsg = await Message.findById(before).select("createdAt");
      if (cursorMsg) {
        messageFilter.createdAt = { $lt: cursorMsg.createdAt };
      } else {
        messageFilter._id = { $lt: before };
      }
    }

    const query = Message.find(messageFilter)
      .sort({ createdAt: -1 })
      .limit(limit);

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
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to load messages" });
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
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });
    if (String(msg.senderId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed to edit this message" });
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

    // Pull the message from any conversation that contains it
    await Conversation.updateMany({ messages: messageId }, { $pull: { messages: messageId } });
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
    if (!toUserId) {
      return res.status(400).json({ success: false, message: "toUserId is required" });
    }
    const original = await Message.findOne({
      _id: messageId,
      $or: [{ senderId }, { receiverId: senderId }],
    });
    if (!original) return res.status(404).json({ success: false, message: "Original message not found" });

    // find or create conversation between sender and toUserId (upsert on participantsKey prevents duplicate simultaneous creations)
    const sortedParticipants = [String(senderId), String(toUserId)].sort();
    const participantsKey = sortedParticipants.join(":");

    let conversation = await Conversation.findOne({
      $or: [
        { participantsKey },
        { participants: { $all: [senderId, toUserId] } }
      ]
    });
    if (!conversation) {
      conversation = await Conversation.findOneAndUpdate(
        { participantsKey },
        {
          $setOnInsert: {
            participants: sortedParticipants,
            participantsKey,
            messages: []
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (!conversation.participantsKey) {
      conversation.participantsKey = participantsKey;
      await conversation.save().catch(() => {});
    }

    // Create a new message with same text
    const newMsg = await Message.create({
      senderId,
      receiverId: toUserId,
      message: original.message
    });
    await Conversation.findByIdAndUpdate(conversation._id, { $push: { messages: newMsg._id } });

    // Realtime emit to both sender (other tabs) and receiver if online
    try {
      if (typeof io !== "undefined" && io) {
        const senderUser = await User.findById(senderId).select("username profilePicture");
        const forwardPayload = {
          ...newMsg.toObject(),
          senderUsername: senderUser?.username || ""
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
