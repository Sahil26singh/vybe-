import React from 'react';
import Post from './Post';
import { useApp } from '@/context/AppContext';

const Posts = () => {
  const { posts } = useApp();
  const sorted = [...posts].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (tb !== ta) return tb - ta;           // newest createdAt first
    return String(b._id) > String(a._id) ? 1 : -1; // fallback: _id is time-ordered
  });
  return (
    <div>
        {
            sorted.map((post) => <Post key={post._id} post={post}/>)
        }
    </div>
  );
};

export default Posts;