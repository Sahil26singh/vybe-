import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";

import { Notification } from "../models/notification.model.js";
import { getReceiverSocketId, io } from "../socket/socket.js";

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
    if (!raw) return res.json({ success: true, results: [], suggestions: [] });

    const reContains = new RegExp(raw);        // ...foo...
    const rePrefix   = new RegExp("^" + raw);  // foo...
    const reExact    = new RegExp("^" + raw + "$");

    // pull candidates by contains (cheap) then score client-side
    const candidates = await User.find({ username: { $regex: reContains, $options: "i" } })
      .select("_id username profilePicture")
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

    const prefix = raw.slice(0, Math.min(3, raw.length));
    const suggestions = prefix
      ? candidates
          .filter(u =>
            u.username.toLowerCase().startsWith(prefix) &&
            u.username.toLowerCase() !== raw
          )
          .slice(0, 10)
      : [];

    return res.json({ success: true, results: ranked, suggestions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Search failed" });
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
        };
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
        console.log("try try try");
    }
}
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
        };

        const token = await jwt.sign({ userId: user._id }, process.env.SECRET_KEY, { expiresIn: '1d' });

        // populate each post if in the posts array
        const populatedPosts = await Promise.all(
            user.posts.map( async (postId) => {
                const post = await Post.findById(postId);
                if(post.author.equals(user._id)){
                    return post;
                }
                return null;
            })
        )
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
        } 
        return res.cookie('token', token, { httpOnly: true, sameSite: 'strict', maxAge: 1 * 24 * 60 * 60 * 1000 }).json({
            message: `Welcome back ${user.username}`,
            success: true,
            user
        });

    } catch (error) {
        console.log(error);
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
    }
};
export const getProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        let user = await User.findById(userId).populate({path:'posts', createdAt:-1}).populate('bookmarks').select('-password');
        return res.status(200).json({
            user,
            success: true
        });
    } catch (error) {
        console.log(error);
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
        };
        if (bio) user.bio = bio;
        if (gender) user.gender = gender;
        if (profilePicture) user.profilePicture = cloudResponse.secure_url;

        await user.save();

        return res.status(200).json({
            message: 'Profile updated.',
            success: true,
            user
        });

    } catch (error) {
        console.log(error);
    }
};
export const getSuggestedUsers = async (req, res) => {
    try {
        const suggestedUsers = await User.find({ _id: { $ne: req.id } }).select("-password");
        if (!suggestedUsers) {
            return res.status(400).json({
                message: 'Currently do not have any users',
            })
        };
        return res.status(200).json({
            success: true,
            users: suggestedUsers
        })
    } catch (error) {
        console.log(error);
    }
};
export const followOrUnfollow = async (req, res) => {
    try {
        const followKrneWala = req.id; // patel
        const jiskoFollowKrunga = req.params.id; // shivani
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
        // mai check krunga ki follow krna hai ya unfollow
        const isFollowing = user.following.includes(jiskoFollowKrunga);
        if (isFollowing) {
            // unfollow logic ayega
            await Promise.all([
                User.updateOne({ _id: followKrneWala }, { $pull: { following: jiskoFollowKrunga } }),
                User.updateOne({ _id: jiskoFollowKrunga }, { $pull: { followers: followKrneWala } }),
            ])
            
            return res.status(200).json({ message: 'Unfollowed successfully', success: true });
        } else {
            // follow logic ayega
            await Promise.all([
                User.updateOne({ _id: followKrneWala }, { $push: { following: jiskoFollowKrunga } }),
                User.updateOne({ _id: jiskoFollowKrunga }, { $push: { followers: followKrneWala } }),
            ])
try {
  // create notification (store follower id + username)
  const notif = await Notification.create({
    to: jiskoFollowKrunga,
    from: followKrneWala,
    type: "follow",
    data: { followerId: followKrneWala, followerUsername: user?.username || "" }
  });

  // emit realtime notification if receiver is online (safe guards)
  try {
    if (typeof getReceiverSocketId === "function" && typeof io !== "undefined" && io) {
      const socketId = getReceiverSocketId(String(jiskoFollowKrunga));
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
    // do not throw — notification is persisted in DB
  }
} catch (notifErr) {
  console.error("Failed to create follow notification:", notifErr);
}

            return res.status(200).json({ message: 'followed successfully', success: true });
        }

        
    } catch (error) {
        console.log(error);
    }
}