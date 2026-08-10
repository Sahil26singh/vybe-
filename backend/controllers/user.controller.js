import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { Notification } from "../models/notification.model.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import { generateUserEmbedding, calculateCosineSimilarity } from "../utils/gemini.js";

// Helper to update embedding vector for a user based on bio and recent post captions
export const updateUserEmbedding = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    const recentPosts = await Post.find({ author: userId }).sort({ createdAt: -1 }).limit(5).select("caption");
    const postText = recentPosts.map(p => p.caption).filter(Boolean).join(". ");
    const profileText = `Username: ${user.username}. Bio: ${user.bio || "No bio"}. Gender: ${user.gender || ""}. Posts: ${postText}`;
    const embedding = await generateUserEmbedding(profileText);
    if (embedding && embedding.length > 0) {
      user.embedding = embedding;
      user.embeddingUpdatedAt = new Date();
      user.markModified("embedding");
      await user.save();
      console.log(`🧠 [Vector Embedding] Generated ${embedding.length}-dim vector for user @${user.username}`);
    }
  } catch (err) {
    console.error("updateUserEmbedding error:", err.message);
  }
};

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
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(401).json({
                message: "Something is missing, please check!",
                success: false,
            });
        }
        const user = await User.findOne({ email });
        if (user) {
            return res.status(401).json({
                message: "Try different email",
                success: false,
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.create({
            username,
            email,
            password: hashedPassword
        });
        return res.status(201).json({
            message: "Account created successfully.",
            success: true,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(401).json({
                message: "Something is missing, please check!",
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
        return res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 1 * 24 * 60 * 60 * 1000 }).json({
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
        return res.cookie("token", "", { maxAge: 0 }).json({
            message: 'Logged out successfully.',
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        let user = await User.findById(userId).populate({path:'posts', options:{sort:{createdAt:-1}}}).populate('bookmarks').select('-password');
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

        const user = await User.findById(userId).select('-password');
        if (!user) {
            return res.status(404).json({
                message: 'User not found.',
                success: false
            });
        }
        if (bio) user.bio = bio;
        if (gender) user.gender = gender;
        if (profilePicture) user.profilePicture = cloudResponse.secure_url;

        await user.save();

        // Update user embedding vector in background when profile changes
        updateUserEmbedding(userId).catch(err => console.error("editProfile embedding error:", err));

        return res.status(200).json({
            message: 'Profile updated.',
            success: true,
            user
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getSuggestedUsers = async (req, res) => {
    try {
        const loggedInUserId = req.id;
        const loggedInUser = await User.findById(loggedInUserId).select("following embedding bio gender username");

        if (!loggedInUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // If logged-in user does not have an embedding vector yet, generate one
        if (!loggedInUser.embedding || loggedInUser.embedding.length === 0) {
            await updateUserEmbedding(loggedInUserId);
            const reloaded = await User.findById(loggedInUserId).select("embedding");
            if (reloaded) loggedInUser.embedding = reloaded.embedding;
        }

        // Exclude self + users already being followed
        const followingArray = (loggedInUser.following || []).map(id => id?._id ? String(id._id) : String(id));
        const excludeIds = [String(loggedInUserId), ...followingArray];

        // Fetch candidate users not followed yet
        const candidates = await User.find({ _id: { $nin: excludeIds } })
            .select("-password")
            .lean();

        // Generate missing candidate embeddings in parallel (fast & non-blocking)
        const missingCandidates = candidates.filter(c => !c.embedding || c.embedding.length === 0);
        if (missingCandidates.length > 0) {
            await Promise.all(missingCandidates.map(async (cand) => {
                await updateUserEmbedding(cand._id);
                const reloaded = await User.findById(cand._id).select("embedding").lean();
                if (reloaded) cand.embedding = reloaded.embedding;
            }));
        }

        // Score candidates using Cosine Similarity
        if (loggedInUser.embedding && loggedInUser.embedding.length > 0) {
            const rankedUsers = candidates.map(user => {
                let score = 0;
                if (user.embedding && user.embedding.length === loggedInUser.embedding.length) {
                    score = calculateCosineSimilarity(loggedInUser.embedding, user.embedding);
                }
                return { ...user, similarityScore: score };
            });

            // Sort descending by similarityScore, then by newest
            rankedUsers.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
            console.log(`🔍 [Vector Search] Scored ${rankedUsers.length} candidates using Cosine Similarity. Top match: @${rankedUsers[0]?.username} (Score: ${rankedUsers[0]?.similarityScore?.toFixed(4) || 0})`);
            return res.status(200).json({ success: true, users: rankedUsers });
        }

        return res.status(200).json({
            success: true,
            users: candidates
        });
    } catch (error) {
        console.error("getSuggestedUsers error:", error);
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
            const updatedUser = await User.findById(followKrneWala).select("-password");
            return res.status(200).json({ message: 'Unfollowed successfully', success: true, user: updatedUser });
        } else {
            await Promise.all([
                User.updateOne({ _id: followKrneWala }, { $addToSet: { following: jiskoFollowKrunga } }),
                User.updateOne({ _id: jiskoFollowKrunga }, { $addToSet: { followers: followKrneWala } }),
            ]);
            try {
                const notif = await Notification.create({
                    to: jiskoFollowKrunga,
                    from: followKrneWala,
                    type: "follow",
                    data: { followerId: followKrneWala, followerUsername: user?.username || "" }
                });

                try {
                    if (typeof getReceiverSocketId === "function" && typeof io !== "undefined" && io) {
                        const socketId = getReceiverSocketId(jiskoFollowKrunga);
                        if (socketId) {
                            io.to(socketId).emit("newNotification", {
                                _id: notif._id,
                                from: { _id: followKrneWala, username: user?.username || "" },
                                type: notif.type,
                                data: notif.data,
                                createdAt: notif.createdAt
                            });
                        }
                    }
                } catch (emitErr) {
                    console.error("emit newNotification error (follow):", emitErr);
                }
            } catch (notifErr) {
                console.error("Failed to create follow notification:", notifErr);
            }

            const updatedUser = await User.findById(followKrneWala).select("-password");
            return res.status(200).json({ message: 'Followed successfully', success: true, user: updatedUser });
        }
    } catch (error) {
        console.error("followOrUnfollow error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};