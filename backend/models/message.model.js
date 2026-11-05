import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    messageType: {
        type: String,
        enum: ['text', 'post-share'],
        default: 'text',
    },
    message: {
        type: String,
        maxlength: 2000,
        default: "",
    },
    postAttachment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        default: null,
    },
    readAt: {
        type: Date,
        default: null,
    }
}, { timestamps: true });

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, readAt: 1 });

export const Message = mongoose.model('Message', messageSchema);
