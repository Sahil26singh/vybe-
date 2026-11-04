import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { Notification } from "../models/notification.model.js";
import { io } from "../socket/socket.js";
import { queueEmbedding } from "../services/embedding.service.js";
import { usernameCache } from "../utils/cache.js";

// In-memory 5-minute cache for suggested users: userId -> { users, source, expiresAt }
const suggestionsCache = new Map();

export function invalidateSuggestedUsersCache(userId) {
  if (userId) {
    suggestionsCache.delete(String(userId));
  } else {
    suggestionsCache.clear();
  }
}

// Return followers list populated with minimal fields
export const getFollowers = async (req, res) => {
  try {
    const profileId = req.params.id;       // whose profile we're viewing
    const viewerId = req.id;                // logged-in user

    const user = await User.findById(profileId)
      .select("_id followers")
      .populate({
        path: "followers",
        select: "_id username profilePicture",
      });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // viewer convenience: isFollowing / isMe
    const viewer = await User.findById(viewerId).select("_id following");
    const followingSet = new Set((viewer?.following || []).map(String));

    const list = (user.followers || []).map(u => ({
      _id: u._id,
      username: u.username,
      profilePicture: u.profilePicture,
      isFollowing: followingSet.has(String(u._id)),
      isMe: String(u._id) === String(viewerId),
    }));

    return res.status(200).json({ success: true, users: list });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Failed to load followers" });
  }
};

export const getFollowing = async (req, res) => {
  try {
    const profileId = req.params.id;
    const viewerId = req.id;

    const user = await User.findById(profileId)
      .select("_id following")
      .populate({
        path: "following",
        select: "_id username profilePicture",
      });

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const viewer = await User.findById(viewerId).select("_id following");
    const followingSet = new Set((viewer?.following || []).map(String));

    const list = (user.following || []).map(u => ({
      _id: u._id,
      username: u.username,
      profilePicture: u.profilePicture,
      isFollowing: followingSet.has(String(u._id)),
      isMe: String(u._id) === String(viewerId),
    }));

    return res.status(200).json({ success: true, users: list });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: "Failed to load following" });
  }
};

export const searchUsersByUsername = async (req, res) => {
  try {
    const raw = (req.query.query || "").trim().toLowerCase();
    if (!raw) {
      const allUsers = await User.find({ _id: { $ne: req.id } })
        .select("_id username profilePicture bio")
        .limit(50)
        .lean();
      return res.json({ success: true, results: allUsers, suggestions: [] });
    }

    const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reContains = new RegExp(safe);
    const rePrefix   = new RegExp("^" + safe);
    const reExact    = new RegExp("^" + safe + "$");

    const candidates = await User.find({
      _id: { $ne: req.id },
      username: { $regex: reContains, $options: "i" }
    })
      .select("_id username profilePicture bio")
      .limit(100)
      .lean();

    const score = (u) =>
      (reExact.test(u.username.toLowerCase())   ? 1000 : 0) +
      (rePrefix.test(u.username.toLowerCase())  ? 500  : 0) +
      (reContains.test(u.username.toLowerCase())? 200  : 0);

    const ranked = candidates
      .map(u => ({ ...u, _score: score(u) }))
      .filter(u => u._score > 0)
      .sort((a,b) => b._score - a._score)
      .slice(0, 20);

    return res.json({ success: true, results: ranked, suggestions: [] });
  } catch (error) {
    console.error("searchUsersByUsername error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const register = async (req, res) => {
    try {
        const username = (req.body.username || "").trim();
        const email = (req.body.email || "").trim().toLowerCase();
        const password = req.body.password;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Username, email, and password are required.",
                success: false,
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please provide a valid email address.",
                success: false,
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters long.",
                success: false,
            });
        }

        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({
                message: "An account with this email already exists.",
                success: false,
            });
        }

        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            return res.status(409).json({
                message: "Username is already taken.",
                success: false,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
            username,
            email,
            password: hashedPassword
        });
        queueEmbedding(newUser._id);
        return res.status(201).json({
            message: "Account created successfully.",
            success: true,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Username or email is already registered.",
                success: false,
            });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const login = async (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const password = req.body.password;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required.",
                success: false,
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please provide a valid email address.",
                success: false,
            });
        }

        let user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                message: "Incorrect email or password",
                success: false,
            });
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(401).json({
                message: "Incorrect email or password",
                success: false,
            });
        }

        const token = await jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '1d' });

        // populate posts in a single query instead of one round-trip per post
        const populatedPosts = await Post.find({
            _id: { $in: user.posts },
            author: user._id
        });
        user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            bio: user.bio,
            followers: user.followers,
            following: user.following,
            bookmarks: (user.bookmarks || []).map((id) =>
              typeof id === "string" ? id : String(id)
            ),
            posts: populatedPosts
        };
        const isProd = process.env.NODE_ENV === "production";
        return res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProd,
            maxAge: 1 * 24 * 60 * 60 * 1000
        }).json({
            message: `Welcome back ${user.username}`,
            success: true,
            user
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const logout = async (_, res) => {
    try {
        const isProd = process.env.NODE_ENV === "production";
        return res.cookie("token", "", {
            httpOnly: true,
            sameSite: 'lax',
            secure: isProd,
            maxAge: 0
        }).json({
            message: 'Logged out successfully.',
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMe = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId).select("-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const populatedPosts = await Post.find({
            _id: { $in: user.posts },
            author: user._id
        });
        const sanitizedUser = {
            _id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            bio: user.bio,
            gender: user.gender,
            followers: user.followers,
            following: user.following,
            bookmarks: (user.bookmarks || []).map((id) =>
              typeof id === "string" ? id : String(id)
            ),
            posts: populatedPosts
        };
        return res.status(200).json({
            success: true,
            user: sanitizedUser
        });
    } catch (error) {
        console.error("getMe error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        const isOwnProfile = String(req.id) === String(userId);

        let query = User.findById(userId).populate({
            path: 'posts',
            options: { sort: { createdAt: -1 } }
        });

        if (isOwnProfile) {
            query = query.populate('bookmarks').select('-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts');
        } else {
            query = query.select('-password -email -embedding -embeddingModel -embeddingStatus -embeddingAttempts -bookmarks');
        }

        const user = await query;
        if (!user) {
            return res.status(404).json({
                message: 'User not found.',
                success: false
            });
        }

        return res.status(200).json({
            user,
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const editProfile = async (req, res) => {
    try {
        const userId = req.id;
        const { bio, gender } = req.body;
        const profilePicture = req.file;
        let cloudResponse;

        if (profilePicture) {
            const fileUri = getDataUri(profilePicture);
            cloudResponse = await cloudinary.uploader.upload(fileUri);
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: 'User not found.',
                success: false
            });
        }
        if (bio !== undefined) user.bio = bio;
        if (gender !== undefined) user.gender = gender;
        if (profilePicture) user.profilePicture = cloudResponse.secure_url;

        await user.save();

        // Invalidate username cache
        usernameCache.delete(String(userId));

        // Invalidate suggestions cache so profile changes are reflected
        invalidateSuggestedUsersCache();

        // Queue user embedding vector update in background when profile changes
        queueEmbedding(userId);

        const updatedUser = await User.findById(userId).select('-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts');

        return res.status(200).json({
            message: 'Profile updated.',
            success: true,
            user: updatedUser
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getSuggestedUsers = async (req, res) => {
    const startTime = Date.now();
    const loggedInUserId = String(req.id);
    try {
        const limitParam = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
        const forceRefresh = req.query.refresh === "true";

        // 1. Check in-memory 5-minute cache (unless forced refresh)
        if (!forceRefresh) {
            const cached = suggestionsCache.get(loggedInUserId);
            if (cached && cached.expiresAt > Date.now()) {
                const durationMs = Date.now() - startTime;
                console.log(`[SuggestedUsers] userId=${loggedInUserId} source=${cached.source} (cached) durationMs=${durationMs} resultCount=${cached.users.length}`);
                return res.status(200).json({
                    success: true,
                    users: cached.users.slice(0, limitParam),
                    source: cached.source
                });
            }
        }

        const loggedInUser = await User.findById(loggedInUserId)
            .select("+embedding embeddingModel embeddingStatus following");

        if (!loggedInUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const followingObjectIds = (loggedInUser.following || [])
            .map(id => (id?._id ? id._id : id))
            .filter(Boolean)
            .map(id => new mongoose.Types.ObjectId(String(id)));

        const myObjectId = new mongoose.Types.ObjectId(loggedInUserId);
        const excludeObjectIds = [myObjectId, ...followingObjectIds];

        let results = [];
        let source = "none";

        // TIER A: Atlas Vector Search
        const hasReadyVector =
            loggedInUser.embeddingStatus === "ready" &&
            Array.isArray(loggedInUser.embedding) &&
            loggedInUser.embedding.length === 768 &&
            loggedInUser.embeddingModel;

        if (hasReadyVector) {
            try {
                const vectorIndexName = process.env.VECTOR_INDEX_NAME || "user_embedding_index";
                const vectorMatches = await User.aggregate([
                    {
                        $vectorSearch: {
                            index: vectorIndexName,
                            path: "embedding",
                            queryVector: loggedInUser.embedding,
                            numCandidates: 1000,
                            limit: 150,
                        }
                    },
                    {
                        $match: {
                            _id: { $nin: excludeObjectIds },
                            embeddingModel: loggedInUser.embeddingModel,
                            embeddingStatus: "ready",
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            profilePicture: 1,
                            bio: 1,
                            score: { $meta: "vectorSearchScore" }
                        }
                    },
                    { $limit: limitParam }
                ]);

                if (vectorMatches && vectorMatches.length > 0) {
                    results = vectorMatches;
                    source = "vector";
                }
            } catch (vectorErr) {
                console.error("[SuggestedUsers] Vector search error:", vectorErr.message);
                // Gracefully continue to Tier B
            }
        }

        // TIER B: Friends-of-friends (Mutual connections)
        if (results.length < limitParam && followingObjectIds.length > 0) {
            try {
                const alreadyFoundIds = results.map(u => u._id);
                const currentExclude = [...excludeObjectIds, ...alreadyFoundIds];
                const needed = limitParam - results.length;

                const mutualMatches = await User.aggregate([
                    { $match: { _id: { $in: followingObjectIds } } },
                    { $unwind: "$following" },
                    { $match: { following: { $nin: currentExclude } } },
                    { $group: { _id: "$following", mutualCount: { $sum: 1 } } },
                    { $sort: { mutualCount: -1 } },
                    { $limit: needed },
                    {
                        $lookup: {
                            from: "users",
                            localField: "_id",
                            foreignField: "_id",
                            as: "userDoc"
                        }
                    },
                    { $unwind: "$userDoc" },
                    {
                        $project: {
                            _id: "$userDoc._id",
                            username: "$userDoc.username",
                            profilePicture: "$userDoc.profilePicture",
                            bio: "$userDoc.bio",
                            mutualCount: 1
                        }
                    }
                ]);

                if (mutualMatches && mutualMatches.length > 0) {
                    if (results.length === 0) {
                        source = "mutual";
                    }
                    results = results.concat(mutualMatches);
                }
            } catch (mutualErr) {
                console.error("[SuggestedUsers] Tier B mutual friends error:", mutualErr.message);
            }
        }

        // Clean output: NEVER return password, email, bookmarks, embedding, or embedding internal fields
        const sanitizedUsers = results.slice(0, limitParam).map(u => ({
            _id: u._id,
            username: u.username,
            profilePicture: u.profilePicture || "",
            bio: u.bio || "",
            ...(u.score !== undefined ? { score: u.score } : {}),
            ...(u.mutualCount !== undefined ? { mutualCount: u.mutualCount } : {}),
        }));

        // Cache result for 5 minutes
        suggestionsCache.set(loggedInUserId, {
            users: sanitizedUsers,
            source,
            expiresAt: Date.now() + 5 * 60 * 1000
        });

        const durationMs = Date.now() - startTime;
        console.log(`[SuggestedUsers] userId=${loggedInUserId} source=${source} durationMs=${durationMs} resultCount=${sanitizedUsers.length}`);

        return res.status(200).json({
            success: true,
            users: sanitizedUsers,
            source
        });
    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.error(`[SuggestedUsers] userId=${loggedInUserId} error: ${error.message} durationMs=${durationMs}`);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const followOrUnfollow = async (req, res) => {
    try {
        const followKrneWala = String(req.id);
        const jiskoFollowKrunga = String(req.params.id);
        if (followKrneWala === jiskoFollowKrunga) {
            return res.status(400).json({
                message: 'You cannot follow/unfollow yourself',
                success: false
            });
        }

        const user = await User.findById(followKrneWala);
        const targetUser = await User.findById(jiskoFollowKrunga);

        if (!user || !targetUser) {
            return res.status(400).json({
                message: 'User not found',
                success: false
            });
        }

        const followingStrings = (user.following || []).map(String);
        const isFollowing = followingStrings.includes(jiskoFollowKrunga);

        if (isFollowing) {
            await Promise.all([
                User.updateOne({ _id: followKrneWala }, { $pull: { following: jiskoFollowKrunga } }),
                User.updateOne({ _id: jiskoFollowKrunga }, { $pull: { followers: followKrneWala } }),
            ]);
            // Invalidate suggestions cache after DB update commits
            invalidateSuggestedUsersCache(followKrneWala);
            invalidateSuggestedUsersCache(jiskoFollowKrunga);
            const updatedUser = await User.findById(followKrneWala).select("-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts");
            return res.status(200).json({ message: 'Unfollowed successfully', success: true, user: updatedUser });
        } else {
            await Promise.all([
                User.updateOne({ _id: followKrneWala }, { $addToSet: { following: jiskoFollowKrunga } }),
                User.updateOne({ _id: jiskoFollowKrunga }, { $addToSet: { followers: followKrneWala } }),
            ]);
            // Invalidate suggestions cache after DB update commits
            invalidateSuggestedUsersCache(followKrneWala);
            invalidateSuggestedUsersCache(jiskoFollowKrunga);
            try {
                const notif = await Notification.create({
                    to: jiskoFollowKrunga,
                    from: followKrneWala,
                    type: "follow",
                    data: { followerId: followKrneWala, followerUsername: user?.username || "" }
                });

                try {
                    if (typeof io !== "undefined" && io) {
                        io.to(String(jiskoFollowKrunga)).emit("newNotification", {
                            _id: notif._id,
                            from: { _id: followKrneWala, username: user?.username || "" },
                            type: notif.type,
                            data: notif.data,
                            createdAt: notif.createdAt
                        });
                    }
                } catch (emitErr) {
                    console.error("emit newNotification error (follow):", emitErr);
                }
            } catch (notifErr) {
                console.error("Failed to create follow notification:", notifErr);
            }

            const updatedUser = await User.findById(followKrneWala).select("-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts");
            return res.status(200).json({ message: 'Followed successfully', success: true, user: updatedUser });
        }
    } catch (error) {
        console.error("followOrUnfollow error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};