import React from 'react';
import Post from './Post';
import { useApp } from '@/context/AppContext';

const Posts = () => {
  const { posts } = useApp();
  const sorted = [...posts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  return (
    <div>
        {
            sorted.map((post) => <Post key={post._id} post={post}/>)
        }
    </div>
  );
};

export default Posts;