import React, { useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import api from "@/lib/axios";
import Post from './Post';

const idStr = (x) => (typeof x === 'string' ? x : String(x?.toString?.() ?? x));

export default function Likes() {
  const { user, posts, setPosts } = useApp();

  useEffect(() => {
    const fetchIfNeeded = async () => {
      if (!posts || posts.length === 0) {
        try {
          const res = await api.get('/api/v1/post/all', {
            withCredentials: true,
          });
          if (res.data?.posts) {
            setPosts(res.data.posts);
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    fetchIfNeeded();
  }, [posts?.length]);

  const likedPosts = useMemo(() => {
    if (!user || !posts?.length) return [];
    const myId = idStr(user._id);
    return posts.filter((p) => (p?.likes || []).map(idStr).includes(myId));
  }, [user?._id, posts]);

  if (!user) {
    return <div className="p-6">Please log in to view your likes.</div>;
  }

  return (
    <div className="flex-1 my-8 flex flex-col items-center pl-[20%]">
      {likedPosts.length === 0 ? (
        <p className="text-md font-bold flex items-center justify-center h-154 text-gray-500">
          You haven’t liked any posts yet.
        </p>
      ) : (
        likedPosts.map((post) => <Post key={post._id} post={post} />)
      )}
    </div>
  );
}
