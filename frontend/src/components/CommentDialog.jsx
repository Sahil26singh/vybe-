import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Link, useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { useDispatch, useSelector } from 'react-redux';
import Comment from './Comment';
import axios from 'axios';
import { toast } from 'sonner';
import { setPosts } from '@/redux/postSlice';

const API_BASE ='https://vybe-ymdg.onrender.com';
const POST_API = `${API_BASE}/api/v1/post`;

const CommentDialog = ({ open, setOpen }) => {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const { selectedPost, posts } = useSelector((store) => store.post);
  const [comment, setComment] = useState([]);
  const dispatch = useDispatch();

  useEffect(() => {
    if (selectedPost) {
      setComment(selectedPost.comments || []);
    }
  }, [selectedPost]);

  const changeEventHandler = (e) => {
    const inputText = e.target.value;
    setText(inputText.trim() ? inputText : '');
  };

  const sendMessageHandler = async () => {
    if (!text.trim()) return;
    try {
      const res = await axios.post(
        `${POST_API}/${selectedPost?._id}/comment`,
        { text },
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
        }
      );

      if (res.data.success) {
        const updatedComments = [...comment, res.data.comment];
        setComment(updatedComments);

        const updatedPosts = posts.map((p) =>
          p._id === selectedPost._id ? { ...p, comments: updatedComments } : p
        );
        dispatch(setPosts(updatedPosts));
        toast.success(res.data.message || 'Comment added');
        setText('');
      }
    } catch (error) {
      console.log(error);
      toast.error('Failed to add comment');
    }
  };

  // NEW: delete a comment 
  const deleteComment = async (commentId) => {
    if (!commentId) return;
    // optimistic UI
    const prev = comment;
    const next = comment.filter((c) => c._id !== commentId);
    setComment(next);
    dispatch(
      setPosts(
        posts.map((p) =>
          p._id === selectedPost._id ? { ...p, comments: next } : p
        )
      )
    );

    try {
      // DELETE /api/v1/post/:postId/comment/:commentId 
      const res = await axios.delete(`${POST_API}/${selectedPost?._id}/comment/${commentId}`, {
        withCredentials: true,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Comment deleted');
      } else {
        throw new Error('Delete failed');
      }
    } catch (err) {
      // rollback on failure
      setComment(prev);
      dispatch(
        setPosts(
          posts.map((p) =>
            p._id === selectedPost._id ? { ...p, comments: prev } : p
          )
        )
      );
      console.error(err);
      toast.error('Failed to delete comment');
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent onInteractOutside={() => setOpen(false)} className="max-w-5xl p-0 flex flex-col">
        <div className="flex flex-1">
          <div className="w-1/2">
            <img
              src={selectedPost?.image}
              alt="post_img"
              className="w-full h-full object-cover rounded-l-lg"
            />
          </div>

          <div className="w-1/2 flex flex-col justify-between">
            <div className="flex items-center justify-between p-4">
              <div className="flex gap-3 items-center">
                <Link>
                  <Avatar>
                    <AvatarImage src={selectedPost?.author?.profilePicture} />
                    <AvatarFallback>
                      {(selectedPost?.author?.username || 'X').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <Link className="font-semibold text-xs">{selectedPost?.author?.username}</Link>
                </div>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <MoreHorizontal className='cursor-pointer' />
                </DialogTrigger>
                <DialogContent className="flex flex-col items-center text-sm text-center">
                  <div onClick={()=>{navigate(`/profile/${selectedPost?.author?._id}`)}} className='cursor-pointer w-full text-[#ED4956] font-bold'>
                    Profile
                  </div>
                  <div className='cursor-pointer w-full'>
                    Add to favorites
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <hr />

            <div className="flex-1 overflow-y-auto max-h-96 p-4">
              {comment.map((c) => (
                <Comment
                  key={c._id}
                  comment={c}
                  postAuthorId={selectedPost?.author?._id}
                  onDelete={deleteComment}
                />
              ))}
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={changeEventHandler}
                  placeholder="Add a comment..."
                  className="w-full outline-none border text-sm border-gray-300 p-2 rounded"
                />
                <Button disabled={!text.trim()} onClick={sendMessageHandler} variant="outline">
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommentDialog;
