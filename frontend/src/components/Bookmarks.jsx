// src/components/Bookmarks.jsx
import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import Post from './Post';
import { setPosts } from '@/redux/postSlice';

const idStr = (x) => (typeof x === 'string' ? x : String(x?.toString?.() ?? x));

export default function Bookmarks() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { posts } = useSelector((s) => s.post);

  // If global posts aren't loaded yet, fetch them (so we can filter)
  useEffect(() => {
    if (!posts || posts.length === 0) {
      (async () => {
        try {
          const res = await axios.get('https://vybe-ymdg.onrender.com/api/v1/post/all', { withCredentials: true });
          if (res.data?.success && Array.isArray(res.data.posts)) {
            dispatch(setPosts(res.data.posts));
          }
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [posts?.length, dispatch]);

  const bookmarkIds = useMemo(() => (user?.bookmarks || []).map(idStr), [user?.bookmarks]);
  const bookmarkedPosts = useMemo(
    () => (posts || []).filter((p) => bookmarkIds.includes(idStr(p._id))),
    [posts, bookmarkIds]
  );

  if (!user) {
    return <div className="p-6">Please log in to view your bookmarks.</div>;
  }

  return (
    <div className="flex-1 my-8 flex flex-col items-center pl-[20%]">
      {bookmarkedPosts.length === 0 ? (
        <p className="text-md font-bold flex items-center justify-center h-154 text-gray-500">No bookmarked posts yet.</p>
      ) : (
        bookmarkedPosts.map((post) => <Post key={post._id} post={post} />)
      )}
    </div>
  );
}
