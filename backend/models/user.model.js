import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePicture: { type: String, default: '' },
    bio: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female'] },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    embedding: { type: [Number], select: false },
    embeddingModel: { type: String },
    embeddingStatus: { type: String, enum: ['none', 'pending', 'ready', 'failed'], default: 'none' },
    embeddingAttempts: { type: Number, default: 0 },
    embeddingUpdatedAt: { type: Date }
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
