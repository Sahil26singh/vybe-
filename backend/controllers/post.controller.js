import mongoose from "mongoose";
import sharp from "sharp";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { io } from "../socket/socket.js";
import { Notification } from "../models/notification.model.js";
import { generateAltText, generateAICaption, moderateContent } from "../utils/gemini.js";
import { queueEmbedding } from "../services/embedding.service.js";

// DELETE a comment 
export const deleteComment = async (req, res) => {
  try {
    const userId = req.id || req.userId || (req.user && req.user._id);
    const { postId, commentId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const isCommentAuthor = String(comment.author) === String(userId);
    const isPostAuthor = String(post.author) === String(userId);

    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ success: false, message: "Not allowed to delete this comment" });
    }

    await Post.findByIdAndUpdate(postId, { $pull: { comments: commentId } });

    // Remove the comment itself
    await Comment.deleteOne({ _id: commentId });

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      commentId,
    });
  } catch (err) {
    console.error("deleteComment error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to delete comment",
    });
  }
};

export const addNewPost = async (req, res) => {
    try {
        const { caption } = req.body;
        const image = req.file;
        const authorId = req.id;

        if (!image) return res.status(400).json({ message: 'Image required' });

        // image upload 
        const optimizedImageBuffer = await sharp(image.buffer)
            .resize({ width: 800, height: 800, fit: 'inside' })
            .toFormat('jpeg', { quality: 80 })
            .toBuffer();

        // Run AI moderation and alt-text suggestion together in parallel with Promise.all
        const [moderation, altText] = await Promise.all([
            moderateContent(optimizedImageBuffer, caption),
            generateAltText(optimizedImageBuffer).catch((err) => {
                console.error("generateAltText error:", err);
                return "";
            })
        ]);

        if (!moderation.safe) {
            return res.status(400).json({
                success: false,
                message: moderation.reason || "This post violates our content policy.",
            });
        }

        // buffer to data uri
        const fileUri = `data:image/jpeg;base64,${optimizedImageBuffer.toString('base64')}`;
        const cloudResponse = await cloudinary.uploader.upload(fileUri);
        const post = await Post.create({
            caption,
            image: cloudResponse.secure_url,
            altText,
            author: authorId
        });
        const user = await User.findById(authorId);
        if (user) {
            user.posts.push(post._id);
            await user.save();
            // Queue author profile embedding update in background with new post caption
            queueEmbedding(authorId);
        }

        await post.populate({ path: 'author', select: '-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts' });

        return res.status(201).json({
            message: 'New post added',
            post,
            success: true,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getAllPost = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const [posts, totalPosts] = await Promise.all([
            Post.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({ path: 'author', select: 'username profilePicture' }),
            Post.countDocuments()
        ]);

        return res.status(200).json({
            success: true,
            posts,
            page,
            limit,
            totalPosts,
            totalPages: Math.ceil(totalPosts / limit),
            hasMore: skip + posts.length < totalPosts
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserPost = async (req, res) => {
    try {
        const authorId = req.id;
        const posts = await Post.find({ author: authorId })
            .sort({ createdAt: -1 })
            .populate({
                path: 'author',
                select: 'username profilePicture'
            });
        return res.status(200).json({
            posts,
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const likePost = async (req, res) => {
  try {
    const likeKrneWalaUserKiId = req.id;
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found", success: false });

    const userObjId = mongoose.isValidObjectId(likeKrneWalaUserKiId)
      ? new mongoose.Types.ObjectId(String(likeKrneWalaUserKiId))
      : likeKrneWalaUserKiId;

    // Only update if not already liked
    const updateResult = await Post.updateOne(
      { _id: postId, likes: { $nin: [userObjId, String(likeKrneWalaUserKiId)] } },
      { $addToSet: { likes: userObjId } }
    );

    // Only notify if the update actually added a new like
    if (updateResult.modifiedCount > 0) {
      const postOwnerId = String(post.author?._id || post.author);
      // only notify if liker is not the post owner
      if (postOwnerId !== String(likeKrneWalaUserKiId)) {
        const user = await User.findById(likeKrneWalaUserKiId).select("username profilePicture");
        const notif = await Notification.create({
          to: postOwnerId,
          from: likeKrneWalaUserKiId,
          type: "like",
          data: { postId: post._id, likerId: likeKrneWalaUserKiId, likerUsername: user?.username || "" }
        });

        try {
          if (io) {
            io.to(String(postOwnerId)).emit("newNotification", {
              _id: notif._id,
              from: { _id: likeKrneWalaUserKiId, username: user?.username || "" },
              type: notif.type,
              data: notif.data,
              createdAt: notif.createdAt
            });
          }
        } catch (emitErr) {
          console.error("emit newNotification (like) error:", emitErr);
        }
      }
    }

    return res.status(200).json({ message: "Post liked", success: true });
  } catch (error) {
    console.error("likePost error:", error);
    return res.status(500).json({ message: "Failed to like post", success: false });
  }
};

export const dislikePost = async (req, res) => {
  try {
    const userId = req.id;
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found", success: false });

    // remove the like
    const userObjId = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(String(userId)) : userId;
    await Post.findByIdAndUpdate(postId, {
      $pull: { likes: { $in: [userObjId, String(userId)] } }
    });

    try {
      const postOwnerId = String(post.author);
      if (postOwnerId !== String(userId)) {
        if (io) {
          io.to(postOwnerId).emit("postLikeRemoved", { postId, userId });
        }
      }
    } catch (emitErr) {
      console.error("emit postLikeRemoved error:", emitErr);
    }

    return res.status(200).json({ message: "Post disliked", success: true });
  } catch (error) {
    console.error("dislikePost error:", error);
    return res.status(500).json({ message: "Failed to dislike post", success: false });
  }
};

export const addComment = async (req,res) =>{
    try {
        const postId = req.params.id;
        const commentKrneWalaUserKiId = req.id;

        const {text} = req.body;
        if(!text || !text.trim()) return res.status(400).json({message:'text is required', success:false});

        const post = await Post.findById(postId);
        if(!post) return res.status(404).json({message:'Post not found', success:false});

        const comment = await Comment.create({
            text: text.trim(),
            author:commentKrneWalaUserKiId,
            post:postId
        });

        await comment.populate({
            path:'author',
            select:"username profilePicture"
        });
        
        post.comments.push(comment._id);
        await post.save();

        const postOwnerId = String(post.author?._id || post.author);
        if (postOwnerId !== String(commentKrneWalaUserKiId)) {
            const user = await User.findById(commentKrneWalaUserKiId).select("username profilePicture");
            const notif = await Notification.create({
                to: postOwnerId,
                from: commentKrneWalaUserKiId,
                type: "comment",
                data: { postId: post._id, commentId: comment._id, text: comment.text, commenterUsername: user?.username || "" }
            });

            try {
                if (io) {
                    io.to(String(postOwnerId)).emit("newNotification", {
                        _id: notif._id,
                        from: { _id: commentKrneWalaUserKiId, username: user?.username || "" },
                        type: notif.type,
                        data: notif.data,
                        createdAt: notif.createdAt
                    });
                }
            } catch (emitErr) {
                console.error("emit newNotification (comment) error:", emitErr);
            }
        }

        return res.status(201).json({
            message:'Comment Added',
            comment,
            success:true
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getCommentsOfPost = async (req,res) => {
    try {
        const postId = req.params.id;

        const comments = await Comment.find({post:postId}).sort({ createdAt: -1 }).populate('author', 'username profilePicture');

        return res.status(200).json({ success: true, comments: comments || [] });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deletePost = async (req,res) => {
    try {
        const postId = req.params.id;
        const authorId = req.id;

        const post = await Post.findById(postId);
        if(!post) return res.status(404).json({message:'Post not found', success:false});

        // check if the logged-in user is the owner of the post
        if(post.author.toString() !== authorId) return res.status(403).json({message:'Unauthorized'});

        // 1. Delete the image from Cloudinary
        if (post.image) {
            try {
                const parts = post.image.split('/');
                const uploadIndex = parts.indexOf('upload');
                if (uploadIndex !== -1) {
                    const pathParts = parts.slice(uploadIndex + 1);
                    if (pathParts[0]?.startsWith('v') && /^\d+$/.test(pathParts[0].slice(1))) {
                        pathParts.shift();
                    }
                    const publicId = pathParts.join('/').replace(/\.[^/.]+$/, '');
                    if (publicId) await cloudinary.uploader.destroy(publicId);
                } else {
                    const filename = parts[parts.length - 1];
                    const publicId = filename.split('.')[0];
                    if (publicId) await cloudinary.uploader.destroy(publicId);
                }
            } catch (cloudErr) {
                console.error("Cloudinary delete image error:", cloudErr);
            }
        }

        // 2. Clean up bookmarks that point to this post across all users
        await User.updateMany({ bookmarks: postId }, { $pull: { bookmarks: postId } });

        // 3. Remove the post id from the author's posts
        await User.updateOne({ _id: authorId }, { $pull: { posts: postId } });

        // 4. Delete associated comments
        await Comment.deleteMany({post:postId});

        // 5. Delete post
        await Post.findByIdAndDelete(postId);

        return res.status(200).json({
            success:true,
            message:'Post deleted'
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const bookmarkPost = async (req, res) => {
    try {
        const postId = req.params.id;
        const authorId = req.id;
        const post = await Post.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post not found', success: false });

        const user = await User.findById(authorId);
        if (!user) return res.status(404).json({ message: 'User not found', success: false });

        const postObjId = mongoose.isValidObjectId(postId) ? new mongoose.Types.ObjectId(String(postId)) : postId;
        const isAlreadyBookmarked = (user.bookmarks || []).some(id => String(id) === String(postId));

        if (isAlreadyBookmarked) {
            // already bookmarked -> remove from the bookmark
            await User.updateOne(
                { _id: authorId },
                { $pull: { bookmarks: { $in: [postObjId, String(postId)] } } }
            );
            const updatedUser = await User.findById(authorId).select("-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts");
            return res.status(200).json({
                type: 'unsaved',
                message: 'Post removed from bookmark',
                success: true,
                user: updatedUser
            });
        } else {
            // add to bookmarks
            await User.updateOne(
                { _id: authorId },
                { $addToSet: { bookmarks: postObjId } }
            );
            const updatedUser = await User.findById(authorId).select("-password -embedding -embeddingModel -embeddingStatus -embeddingAttempts");
            return res.status(200).json({
                type: 'saved',
                message: 'Post bookmarked',
                success: true,
                user: updatedUser
            });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const generateCaption = async (req, res) => {
  try {
    const image = req.file;
    if (!image) {
      return res.status(400).json({ success: false, message: "Please select an image first" });
    }
    const optimizedImageBuffer = await sharp(image.buffer)
      .resize({ width: 800, height: 800, fit: "inside" })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();

    const caption = await generateAICaption(optimizedImageBuffer);
    return res.status(200).json({ success: true, caption });
  } catch (error) {
    console.error("generateCaption error:", error);
    return res.status(500).json({ success: false, message: "Couldn't generate a caption" });
  }
};

export const getPostById = async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId)
            .populate({ path: 'author', select: 'username profilePicture' });
        if (!post) {
            return res.status(404).json({ success: false, message: "Post not found" });
        }
        return res.status(200).json({ success: true, post });
    } catch (error) {
        console.error("getPostById error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getLikedPosts = async (req, res) => {
    try {
        const userId = req.id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const [posts, totalPosts] = await Promise.all([
            Post.find({ likes: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({ path: 'author', select: 'username profilePicture' }),
            Post.countDocuments({ likes: userId })
        ]);

        return res.status(200).json({
            success: true,
            posts,
            page,
            limit,
            totalPosts,
            totalPages: Math.ceil(totalPosts / limit),
            hasMore: skip + posts.length < totalPosts
        });
    } catch (error) {
        console.error("getLikedPosts error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getBookmarkedPosts = async (req, res) => {
    try {
        const userId = req.id;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;

        const user = await User.findById(userId).select("bookmarks");
        const bookmarks = user?.bookmarks || [];

        const [posts, totalPosts] = await Promise.all([
            Post.find({ _id: { $in: bookmarks } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({ path: 'author', select: 'username profilePicture' }),
            Post.countDocuments({ _id: { $in: bookmarks } })
        ]);

        return res.status(200).json({
            success: true,
            posts,
            page,
            limit,
            totalPosts,
            totalPages: Math.ceil(totalPosts / limit),
            hasMore: skip + posts.length < totalPosts
        });
    } catch (error) {
        console.error("getBookmarkedPosts error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
