import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { API_URL } from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { MessageCircle, Send, Bookmark, BookmarkCheck, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";

const idStr = (x) => {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x._id) return String(x._id);
  return String(x?.toString?.() ?? x);
};
const hasId = (list, id) =>
  Array.isArray(list) && list.map(idStr).includes(idStr(id));

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, posts, setPosts } = useApp();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const isBookmarked = user?.bookmarks
    ? user.bookmarks.map(idStr).includes(idStr(post?._id))
    : false;

  // Load from global posts cache first, then fetch if not found
  useEffect(() => {
    const cached = posts.find((p) => idStr(p._id) === idStr(id));
    if (cached) {
      setPost(cached);
      setComments(cached.comments || []);
      setLiked(hasId(cached.likes, user?._id));
      setLikeCount(Array.isArray(cached.likes) ? cached.likes.length : 0);
      setLoading(false);
    } else {
      api.get(`${API_URL}/api/v1/post/all`, { withCredentials: true })
        .then((res) => {
          const all = Array.isArray(res.data?.posts) ? res.data.posts : [];
          const found = all.find((p) => idStr(p._id) === idStr(id));
          if (found) {
            setPost(found);
            setComments(found.comments || []);
            setLiked(hasId(found.likes, user?._id));
            setLikeCount(Array.isArray(found.likes) ? found.likes.length : 0);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const likeHandler = async () => {
    if (!post) return;
    const action = liked ? "dislike" : "like";
    const newLiked = !liked;
    const newCount = newLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    // Capture pre-action values for error revert
    const prevLiked = liked;
    const prevCount = likeCount;

    // Optimistic UI update
    setLiked(newLiked);
    setLikeCount(newCount);

    // Also sync global posts feed state
    setPosts((prev) =>
      prev.map((p) =>
        idStr(p._id) === idStr(post._id)
          ? {
              ...p,
              likes: newLiked
                ? [...(p.likes || []), user._id]
                : (p.likes || []).filter((l) => idStr(l) !== idStr(user._id)),
            }
          : p
      )
    );

    try {
      toast.success(newLiked ? "Post liked" : "Post disliked");
      await api.get(`${API_URL}/api/v1/post/${post._id}/${action}`, { withCredentials: true });
    } catch {
      // Revert on error using captured pre-action values
      setLiked(prevLiked);
      setLikeCount(prevCount);
      toast.error("Failed to update like");
    }
  };

  const commentHandler = async () => {
    if (!commentText.trim() || !post) return;
    try {
      const res = await api.post(
        `${API_URL}/api/v1/post/${post._id}/comment`,
        { text: commentText },
        { headers: { "Content-Type": "application/json" }, withCredentials: true }
      );
      if (res.data.success) {
        setComments((prev) => [...prev, res.data.comment]);
        setCommentText("");
        toast.success("Comment added");
      }
    } catch (err) {
      toast.error("Failed to add comment");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-gray-500">Post not found.</p>
        <Button onClick={() => navigate(-1)} variant="outline">Go back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to={`/profile/${post.author?._id}`}>
            <Avatar className="w-10 h-10">
              <AvatarImage src={post.author?.profilePicture} />
              <AvatarFallback>
                {(post.author?.username || "X").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <Link to={`/profile/${post.author?._id}`} className="font-semibold text-sm hover:underline">
              {post.author?.username}
            </Link>
            {post.createdAt && !isNaN(new Date(post.createdAt)) && (
              <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>

        {/* Image */}
        {post.image && (
          <div className="w-full bg-black">
            <img
              src={post.image}
              alt="post"
              className="w-full max-h-[600px] object-contain"
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-4">
          <button onClick={likeHandler} className="transition-transform hover:scale-110">
            {liked
              ? <FaHeart className="h-6 w-6 text-red-500" />
              : <FaRegHeart className="h-6 w-6 text-gray-700" />
            }
          </button>
          <MessageCircle className="h-6 w-6 text-gray-700" />
        </div>

        {/* Like count */}
        <div className="px-4 pb-1">
          <span className="text-sm font-semibold">{likeCount} {likeCount === 1 ? "like" : "likes"}</span>
        </div>

        {/* Caption */}
        {post.caption && (
          <div className="px-4 pb-2 text-sm">
            <span className="font-semibold mr-2">{post.author?.username}</span>
            {post.caption}
          </div>
        )}

        {/* Comments */}
        <div className="px-4 pb-3 max-h-64 overflow-y-auto divide-y divide-gray-50">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400 py-2">No comments yet. Be the first!</p>
          )}
          {comments.map((c, i) => (
            <div key={c._id || i} className="py-2 text-sm">
              <span className="font-semibold mr-2">
                {c.author?.username || c.username || "User"}
              </span>
              {c.text}
            </div>
          ))}
        </div>

        {/* Add comment */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commentHandler()}
            placeholder="Add a comment…"
            className="flex-1 text-sm outline-none bg-transparent"
          />
          <button
            onClick={commentHandler}
            disabled={!commentText.trim()}
            className="text-blue-500 text-sm font-semibold disabled:opacity-40 hover:text-blue-700"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
