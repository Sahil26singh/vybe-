import React, { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Bookmark, MessageCircle, MoreHorizontal, Send, BookmarkCheck } from "lucide-react";
import { Button } from "./ui/button";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import CommentDialog from "./CommentDialog";
import { useApp } from "@/context/AppContext";
import api, { API_URL } from "@/lib/axios";
import { toast } from "sonner";
import { Badge } from "./ui/badge";
import { useNavigate } from "react-router-dom";

/* ---------- helpers ---------- */
const idStr = (x) => (typeof x === "string" ? x : String(x?.toString?.() ?? x));
const hasId = (list, id) => Array.isArray(list) && list.map(idStr).includes(idStr(id));

const Post = ({ post }) => {
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [comment, setComment] = useState(post.comments || []);
  const [open, setOpen] = useState(false);

  // share dialog
  const [shareOpen, setShareOpen] = useState(false);
  const [shareFilter, setShareFilter] = useState("");

  // local favorite (no backend)
  const favKey = `fav:${idStr(post._id)}`;
  const [favorite, setFavorite] = useState(() => localStorage.getItem(favKey) === "1");

  const { user, suggestedUsers, posts, setPosts, onlineUsers, setSelectedPost, setAuthUser } = useApp();

  const [liked, setLiked] = useState(hasId(post.likes, user?._id));
  const [postLike, setPostLike] = useState(Array.isArray(post.likes) ? post.likes.length : 0);

  const [bookmarkInFlight, setBookmarkInFlight] = useState(false);

  const changeEventHandler = (e) => {
    const v = e.target.value;
    setText(v.trim() ? v : "");
  };

  /* ------------------------- LIKE (optimistic) ------------------------- */
  const likeOrDislikeHandler = async () => {
    try {
      const action = liked ? "dislike" : "like";

      const updatedPosts = posts.map((p) =>
        idStr(p._id) === idStr(post._id)
          ? {
              ...p,
              likes: liked
                ? (p.likes || []).filter((id) => idStr(id) !== idStr(user._id))
                : [ ...(p.likes || []), user._id ],
            }
          : p
      );
      setPosts(updatedPosts);
      toast.success(liked ? "Post disliked" : "Post liked");

      await api.get(`${API_URL}/api/v1/post/${post._id}/${action}`, { withCredentials: true });
    } catch (error) {
      const reverted = posts.map((p) =>
        idStr(p._id) === idStr(post._id)
          ? {
              ...p,
              likes: liked
                ? [ ...(p.likes || []), user._id ]
                : (p.likes || []).filter((id) => idStr(id) !== idStr(user._id)),
            }
          : p
      );
      setPosts(reverted);
      toast.error("Something went wrong while liking the post");
      console.error(error);
    }
  };

  /* ------------------------ COMMENT: add comment ------------------------ */
  const commentHandler = async () => {
    try {
      const res = await api.post(
        `${API_URL}/api/v1/post/${post._id}/comment`,
        { text },
        { headers: { "Content-Type": "application/json" }, withCredentials: true }
      );

      if (res.data.success) {
        const updatedCommentData = [...comment, res.data.comment];
        setComment(updatedCommentData);

        const updatedPostData = posts.map((p) =>
          idStr(p._id) === idStr(post._id) ? { ...p, comments: updatedCommentData } : p
        );
        setPosts(updatedPostData);
        toast.success(res.data.message);
        setText("");
      }
    } catch (error) {
      console.log(error);
    }
  };

  /* ---------------------------- DELETE POST ---------------------------- */
  const deletePostHandler = async () => {
    try {
      const res = await api.delete(`${API_URL}/api/v1/post/delete/${post?._id}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        const updatedPostData = posts.filter((p) => idStr(p?._id) !== idStr(post?._id));
        setPosts(updatedPostData);
        toast.success(res.data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data?.message || "Delete failed");
    }
  };

  /* --------------------- BOOKMARK: persisted in auth.user --------------------- */
  const bookmarked = hasId(user?.bookmarks, post._id);

  const bookmarkHandler = async () => {
    if (!user?._id || bookmarkInFlight) return;
    setBookmarkInFlight(true);

    const wasBookmarked = bookmarked;
    const prevUser = user;
    const prevPosts = posts;

    const prevList = Array.isArray(user?.bookmarks) ? user.bookmarks : [];
    const nextBookmarks = wasBookmarked
      ? prevList.filter((pid) => idStr(pid) !== idStr(post._id))
      : [ ...prevList.map(idStr), idStr(post._id) ];

    setAuthUser({ ...user, bookmarks: nextBookmarks });

    const nextPosts = posts.map((p) =>
      idStr(p._id) === idStr(post._id) ? { ...p, bookmarkedByMe: !wasBookmarked } : p
    );
    setPosts(nextPosts);

    try {
      const res = await api.get(`${API_URL}/api/v1/post/${post?._id}/bookmark`, { withCredentials: true });

      if (res?.data?.success) {
        if (res.data.user) {
          const serverUser = res.data.user;
          const normalizedBookmarks = (serverUser.bookmarks || []).map((id) =>
            typeof id === "string" ? id : String(id)
          );
          setAuthUser({ ...serverUser, bookmarks: normalizedBookmarks });
        }
        toast.success(res.data.message || (!wasBookmarked ? "Added to bookmarks" : "Removed from bookmarks"));
      } else {
        throw new Error(res?.data?.message || "Bookmark toggle failed");
      }
    } catch (err) {
      setAuthUser(prevUser);
      setPosts(prevPosts);
      toast.error("Could not update bookmark");
      console.error(err);
    } finally {
      setBookmarkInFlight(false);
    }
  };

  /* ------------------- keep like UI in sync ------------------- */
  useEffect(() => {
    if (!post || !user) return;
    const currentPost = posts?.find((p) => idStr(p._id) === idStr(post._id)) || post;
    const likesArr = Array.isArray(currentPost.likes) ? currentPost.likes : [];
    setPostLike(likesArr.length);
    setLiked(hasId(likesArr, user._id));
  }, [posts, post, user]);

  /* ------------------- SHARE: send a post preview in chat ------------------- */
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    if (!shareOpen || !user?._id) return;
    const fetchConnections = async () => {
      try {
        const [followersRes, followingRes] = await Promise.all([
          api.get(`${API_URL}/api/v1/user/${user._id}/followers`, { withCredentials: true }),
          api.get(`${API_URL}/api/v1/user/${user._id}/following`, { withCredentials: true }),
        ]);

        const followersList = followersRes.data?.success ? followersRes.data.users : [];
        const followingList = followingRes.data?.success ? followingRes.data.users : [];

        const pool = [];
        const seen = new Set();
        const me = idStr(user._id);

        const add = (u) => {
          if (!u || !u._id) return;
          const uid = idStr(u._id);
          if (uid === me || seen.has(uid)) return;
          seen.add(uid);
          pool.push(u);
        };

        followersList.forEach(add);
        followingList.forEach(add);

        setConnections(pool.sort((a, b) => (a.username || "").localeCompare(b.username || "")));
      } catch (err) {
        console.error(err);
      }
    };
    fetchConnections();
  }, [shareOpen, user?._id]);

  const filteredCandidates = useMemo(() => {
    const q = shareFilter.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((u) => (u.username || "").toLowerCase().includes(q));
  }, [connections, shareFilter]);

  const shareToUser = async (receiver) => {
    if (!receiver?._id) return;
    try {
      const payload = {
        type: "post-share",
        post: {
          _id: post._id,
          image: post.image,
          caption: post.caption || "",
        },
        author: {
          _id: post?.author?._id,
          username: post?.author?.username,
          profilePicture: post?.author?.profilePicture,
        },
      };

      const res = await api.post(
        `${API_URL}/api/v1/message/send/${receiver._id}`,
        { textMessage: JSON.stringify(payload) },
        { headers: { "Content-Type": "application/json" }, withCredentials: true }
      );

      if (res.data?.success) {
        toast.success(`Shared with ${receiver.username}`);
        setShareOpen(false);
        setShareFilter("");
      } else {
        throw new Error(res.data?.message || "Share failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not share the post");
    }
  };

  return (
    <div className="my-8 w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div onClick={()=>navigate(`/profile/${post.author._id}`)} className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src={post.author?.profilePicture} alt="post_image" />
            <AvatarFallback>{(post.author?.username || "X").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-3">
            <h1>{post.author?.username}</h1>
            {idStr(user?._id) === idStr(post.author?._id) && <Badge variant="secondary">Author</Badge>}
          </div>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <MoreHorizontal className="cursor-pointer" />
          </DialogTrigger>
          <DialogContent className="flex flex-col items-center text-sm text-center">
            {idStr(user?._id) !== idStr(post?.author?._id) && (
              <Button variant="ghost" className="cursor-pointer w-full text-[#ED4956] font-bold">
                Unfollow
              </Button>
            )}
            <Button
              variant="ghost"
              className="cursor-pointer w-full text-yellow-600 font-semibold"
              onClick={() => {
                const nextState = !favorite;
                setFavorite(nextState);
                localStorage.setItem(favKey, nextState ? "1" : "0");
                toast.success(nextState ? "Added to Favorites" : "Removed from Favorites");
              }}
            >
              {favorite ? "Remove from Favorites" : "Add to Favorites"}
            </Button>
            {idStr(user?._id) === idStr(post?.author?._id) && (
              <Button onClick={deletePostHandler} variant="ghost" className="cursor-pointer w-full text-red-600 font-bold">
                Delete
              </Button>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Post Image */}
      <img className="rounded-sm my-2 w-full aspect-square object-cover" src={post.image} alt={post.altText || "post_img"} />

      {/* Action Icons */}
      <div className="flex items-center justify-between my-2">
        <div className="flex items-center gap-3">
          {liked ? (
            <FaHeart onClick={likeOrDislikeHandler} size={"22px"} className="cursor-pointer text-red-600" />
          ) : (
            <FaRegHeart onClick={likeOrDislikeHandler} size={"22px"} className="cursor-pointer hover:text-gray-600" />
          )}

          <MessageCircle
            onClick={() => {
              setSelectedPost(post);
              setOpen(true);
            }}
            className="cursor-pointer hover:text-gray-600"
          />

          <Send onClick={() => setShareOpen(true)} className="cursor-pointer hover:text-gray-600" />
        </div>

        {bookmarked ? (
          <BookmarkCheck onClick={bookmarkHandler} className="cursor-pointer text-blue-600" />
        ) : (
          <Bookmark onClick={bookmarkHandler} className="cursor-pointer hover:text-gray-600" />
        )}
      </div>

      {/* Likes count */}
      <span className="font-medium block mb-2">{postLike} likes</span>

      {/* Caption */}
      <p>
        <span className="font-medium mr-2">{post.author?.username}</span>
        {post.caption}
      </p>

      {/* Comments section */}
      {comment.length > 0 && (
        <span
          onClick={() => {
            setSelectedPost(post);
            setOpen(true);
          }}
          className="cursor-pointer text-sm text-gray-400"
        >
          View all {comment.length} comments
        </span>
      )}

      <CommentDialog open={open} setOpen={setOpen} />

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <h2 className="text-lg font-semibold text-center border-b pb-2">Share Post</h2>
          <div className="py-2">
            <input
              type="text"
              placeholder="Search followers/following..."
              value={shareFilter}
              onChange={(e) => setShareFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-60 overflow-y-auto divide-y">
            {filteredCandidates.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No matching connections</div>
            ) : (
              filteredCandidates.map((u) => (
                <div key={u._id} className="flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.profilePicture} alt="user" />
                      <AvatarFallback>{(u.username || "X").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{u.username}</span>
                  </div>
                  <Button size="sm" onClick={() => shareToUser(u)}>
                    Send
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New comment input */}
      <div className="flex items-center justify-between mt-2">
        <input
          type="text"
          placeholder="Add a comment..."
          value={text}
          onChange={changeEventHandler}
          className="outline-none text-sm w-full"
        />
        {text && (
          <span onClick={commentHandler} className="text-[#3BADF8] cursor-pointer font-semibold">
            Post
          </span>
        )}
      </div>
    </div>
  );
};

export default Post;
