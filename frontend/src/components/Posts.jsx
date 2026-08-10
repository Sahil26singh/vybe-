import React from 'react';
import Post from './Post';
import { useApp } from '@/context/AppContext';

const Posts = () => {
  const { posts } = useApp();
  return (
    <div>
        {
            posts.map((post) => <Post key={post._id} post={post}/>)
        }
    </div>
  );
};

export default Posts;