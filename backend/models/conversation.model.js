import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    participantsKey: {
        type: String,
        trim: true,
        default: null
    },
    messages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }]
}, { timestamps: true });

conversationSchema.index({ participants: 1 });
conversationSchema.index(
    { participantsKey: 1 },
    { unique: true, partialFilterExpression: { participantsKey: { $type: "string" } } }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);
