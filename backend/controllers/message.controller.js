import {Conversation} from "../models/conversation.model.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import {Message} from "../models/message.model.js"
import { Notification } from "../models/notification.model.js";

// for chatting
// --- REPLACE: sendMessage function (paste this over your existing sendMessage) ---
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const receiverId = req.params.id;
    const { textMessage: message } = req.body;

    // find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId]
      });
    }

    // create message
    const newMessage = await Message.create({
      senderId,
      receiverId,
      message
    });

    // push message id into conversation and save conversation
    conversation.messages.push(newMessage._id);
    await conversation.save();

    // create notification entry for receiver
    const notif = await Notification.create({
      to: receiverId,
      from: senderId,
      type: "message",
      data: { messageId: newMessage._id, conversationId: conversation._id, text: newMessage.message }
    });

    // emit realtime notification to receiver if their socket is known
    try {
      if (typeof getReceiverSocketId === "function" && typeof io !== "undefined" && io) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("newNotification", {
            _id: notif._id,
            from: { _id: senderId },
            type: notif.type,
            data: notif.data,
            createdAt: notif.createdAt
          });

          // also emit the newMessage realtime event (so receiver's chat UI can show message)
          io.to(receiverSocketId).emit("newMessage", newMessage);
        }
      }
    } catch (emitErr) {
      // don't crash the request if emit fails — log for debugging
      console.error("emit newNotification/newMessage error:", emitErr);
    }

    return res.status(201).json({ success: true, newMessage });
  } catch (error) {
    console.error("sendMessage error:", error);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  }
};
// --- END REPLACE ---


export const getMessage = async (req,res) => {
    try {
        const senderId = req.id;
        const receiverId = req.params.id;
        const conversation = await Conversation.findOne({
            participants:{$all: [senderId, receiverId]}
        }).populate('messages');
        if(!conversation) return res.status(200).json({success:true, messages:[]});

        return res.status(200).json({success:true, messages:conversation?.messages});
        
    } catch (error) {
        console.log(error);
    }
}

// Edit a message (sender only)
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
    return res.status(200).json({ success: true, message: msg });
  } catch (err) {
    console.error(err);
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
    if (String(msg.senderId) != String(userId)) {
      return res.status(403).json({ success: false, message: "Not allowed to delete this message" });
    }
    // Pull the message from any conversation that contains it
    await Conversation.updateMany({ messages: messageId }, { $pull: { messages: messageId } });
    await Message.deleteOne({ _id: messageId });
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
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
    const original = await Message.findById(messageId);
    if (!original) return res.status(404).json({ success: false, message: "Original message not found" });

    // find or create conversation between sender and toUserId
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, toUserId] }
    });
    if (!conversation) {
      conversation = await Conversation.create({ participants: [senderId, toUserId] });
    }

    // Create a new message with same text
    const newMsg = await Message.create({
      senderId,
      receiverId: toUserId,
      message: original.message
    });
    conversation.messages.push(newMsg._id);
    await conversation.save();

    // Realtime emit to receiver if online
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMsg);
    }

    return res.status(201).json({ success: true, message: newMsg });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to forward message" });
  }
};
