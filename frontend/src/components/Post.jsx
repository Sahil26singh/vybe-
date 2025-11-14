import React, { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "./ui/dialog";
import { Bookmark, MessageCircle, MoreHorizontal, Send, BookmarkCheck } from "lucide-react";
import { Button } from "./ui/button";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import CommentDialog from "./CommentDialog";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { toast } from "sonner";
import { setPosts, setSelectedPost } from "@/redux/postSlice";
import { Badge } from "./ui/badge";
import { setAuthUser } from "@/redux/authSlice";
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

  const { user, suggestedUsers } = useSelector((s) => s.auth);
  const { posts } = useSelector((s) => s.post);
  const { onlineUsers } = useSelector((s) => s.chat);
  const dispatch = useDispatch();

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
      dispatch(setPosts(updatedPosts));
      toast.success(liked ? "Post disliked" : "Post liked");

      await axios.get(`http://localhost:8000/api/v1/post/${post._id}/${action}`, { withCredentials: true });
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
      dispatch(setPosts(reverted));
      toast.error("Something went wrong while liking the post");
      console.error(error);
    }
  };

  /* ------------------------ COMMENT: add comment ------------------------ */
  const commentHandler = async () => {
    try {
      const res = await axios.post(
        `http://localhost:8000/api/v1/post/${post._id}/comment`,
        { text },
        { headers: { "Content-Type": "application/json" }, withCredentials: true }
      );

      if (res.data.success) {
        const updatedCommentData = [...comment, res.data.comment];
        setComment(updatedCommentData);

        const updatedPostData = posts.map((p) =>
          idStr(p._id) === idStr(post._id) ? { ...p, comments: updatedCommentData } : p
        );
        dispatch(setPosts(updatedPostData));
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
      const res = await axios.delete(`http://localhost:8000/api/v1/post/delete/${post?._id}`, {
        withCredentials: true,
      });
      if (res.data.success) {
        const updatedPostData = posts.filter((p) => idStr(p?._id) !== idStr(post?._id));
        dispatch(setPosts(updatedPostData));
        toast.success(res.data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data?.messsage || "Delete failed");
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

    dispatch(setAuthUser({ ...user, bookmarks: nextBookmarks }));

    const nextPosts = posts.map((p) =>
      idStr(p._id) === idStr(post._id) ? { ...p, bookmarkedByMe: !wasBookmarked } : p
    );
    dispatch(setPosts(nextPosts));

    try {
      const res = await axios.get(`http://localhost:8000/api/v1/post/${post?._id}/bookmark`, { withCredentials: true });

      if (res?.data?.success) {
        if (res.data.user) {
          const serverUser = res.data.user;
          const normalizedBookmarks = (serverUser.bookmarks || []).map(idStr);
          dispatch(setAuthUser({ ...serverUser, bookmarks: normalizedBookmarks }));
        }
        toast.success(res.data.message || (!wasBookmarked ? "Added to bookmarks" : "Removed from bookmarks"));
      } else {
        throw new Error(res?.data?.message || "Bookmark toggle failed");
      }
    } catch (err) {
      dispatch(setAuthUser(prevUser));
      dispatch(setPosts(prevPosts));
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
  // Choose only followers/following as recipients (and not me)
  const shareCandidates = useMemo(() => {
    const mine = idStr(user?._id);
    const following = (user?.following || []).map(idStr);
    const followers = (user?.followers || []).map(idStr);
    const isConnected = (uid) => following.includes(idStr(uid)) || followers.includes(idStr(uid));

    return (suggestedUsers || [])
      .filter((u) => u?._id && idStr(u._id) !== mine && isConnected(u._id))
      .sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  }, [suggestedUsers, user]);

  const filteredCandidates = useMemo(() => {
    const q = shareFilter.trim().toLowerCase();
    if (!q) return shareCandidates;
    return shareCandidates.filter((u) => (u.username || "").toLowerCase().includes(q));
  }, [shareCandidates, shareFilter]);

  const shareToUser = async (receiver) => {
    if (!receiver?._id) return;
    try {
      // message payload: JSON string with type=post-share + minimal preview fields
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

      const res = await axios.post(
        `http://localhost:8000/api/v1/message/send/${receiver._id}`,
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
            {idStr(post?.author?._id) !== idStr(user?._id) && (
              <Button
                onClick={() => navigate(`/profile/${post.author?._id}`)}
                variant="ghost"
                className="cursor-pointer w-fit text-blue-600 font-bold"
              >
                Profile
              </Button>
            )}
            {user && idStr(user?._id) === idStr(post?.author?._id) && (
              <Button onClick={deletePostHandler} variant="ghost" className="cursor-pointer w-fit text-[#ED4956] font-bold">
                Delete
              </Button>
            )}

            {/* Favorite: local only */}
            <Button variant="ghost" className="cursor-pointer w-fit">
              {favorite ? "Remove from favorites" : "Add to favorites"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Image */}
      <img className="rounded-sm my-2 w-full aspect-square object-cover" src={post.image} alt="post_img" />

      {/* Actions */}
      <div className="flex items-center justify-between my-2">
        <div className="flex items-center gap-3">
          {liked ? (
            <FaHeart onClick={likeOrDislikeHandler} size={24} className="cursor-pointer text-red-600" />
          ) : (
            <FaRegHeart onClick={likeOrDislikeHandler} size={22} className="cursor-pointer hover:text-gray-600" />
          )}

          <MessageCircle
            onClick={() => {
              dispatch(setSelectedPost(post));
              setOpen(true);
            }}
            className="cursor-pointer hover:text-gray-600"
          />

          {/* SHARE */}
          <Send onClick={() => setShareOpen(true)} className="cursor-pointer hover:text-gray-600" />
        </div>

        {/* Bookmark */}
        {bookmarked ? (
          <BookmarkCheck onClick={bookmarkHandler} className="cursor-pointer text-blue-600" />
        ) : (
          <Bookmark onClick={bookmarkHandler} className="cursor-pointer hover:text-gray-600" />
        )}
      </div>

      <span className="font-medium block mb-2">{postLike} likes</span>
      <p>
        <span className="font-medium mr-2">{post.author?.username}</span>
        {post.caption}
      </p>

      {comment.length > 0 && (
        <span
          onClick={() => {
            dispatch(setSelectedPost(post));
            setOpen(true);
          }}
          className="cursor-pointer text-sm text-gray-400"
        >
          View all {comment.length} comments
        </span>
      )}

      {/* Comments dialog */}
      <CommentDialog open={open} setOpen={setOpen} />

      {/* New comment box */}
      <div className="flex items-center justify-between">
        <input
          type="text"
          placeholder="Add a comment..."
          value={text}
          onChange={changeEventHandler}
          className="outline-none text-sm w-full"
        />
        {text && (
          <span onClick={commentHandler} className="text-[#3BADF8] cursor-pointer">
            Post
          </span>
        )}
      </div>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold">Share post</h3>
            <input
              className="border rounded px-3 py-2 text-sm"
              placeholder="Search follower/following…"
              value={shareFilter}
              onChange={(e) => setShareFilter(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto">
              {filteredCandidates.length === 0 ? (
                <p className="text-sm text-gray-500">No matches.</p>
              ) : (
                filteredCandidates.map((u) => {
                  const online = (onlineUsers || []).includes(u._id);
                  return (
                    <div
                      key={u._id}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={u.profilePicture} />
                          <AvatarFallback>{(u.username || "X").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{u.username}</span>
                          <span className={`text-[11px] font-semibold ${online ? "text-green-600" : "text-gray-400"}`}>
                            {online ? "online" : "offline"}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => shareToUser(u)}>Send</Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Post;
