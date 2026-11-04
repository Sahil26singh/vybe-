import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    caption: { type: String, default: '' },
    image: { type: String, required: true },
    altText: { type: String, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
}, { timestamps: true });

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ likes: 1, createdAt: -1 });

export const Post = mongoose.model('Post', postSchema);
