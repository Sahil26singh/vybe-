import React, { useState } from 'react';
import Post from './Post';
import { useApp } from '@/context/AppContext';
import { Button } from './ui/button';
import api from '@/lib/axios';
import { toast } from 'sonner';

const Posts = () => {
  const { posts, setPosts } = useApp();
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMorePosts = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.get(`/api/v1/post/all?page=${nextPage}&limit=10`);
      if (res.data?.success && Array.isArray(res.data.posts)) {
        if (res.data.posts.length === 0) {
          setHasMore(false);
        } else {
          setPosts((prev) => {
            const existingIds = new Set((prev || []).map((p) => String(p._id)));
            const newPosts = res.data.posts.filter((p) => !existingIds.has(String(p._id)));
            return [...(prev || []), ...newPosts];
          });
          setPage(nextPage);
          if (res.data.hasMore !== undefined) {
            setHasMore(res.data.hasMore);
          }
        }
      }
    } catch (err) {
      console.error("loadMorePosts error:", err);
      toast.error("Failed to load more posts");
    } finally {
      setLoadingMore(false);
    }
  };

  const sorted = [...posts].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (tb !== ta) return tb - ta;           // newest createdAt first
    return String(b._id) > String(a._id) ? 1 : -1; // fallback: _id is time-ordered
  });

  return (
    <div className="w-full max-w-xl pb-10">
      {sorted.map((post) => (
        <Post key={post._id} post={post} />
      ))}
      {posts.length > 0 && hasMore && (
        <div className="flex justify-center my-6">
          <Button variant="outline" size="sm" onClick={loadMorePosts} disabled={loadingMore}>
            {loadingMore ? "Loading more posts..." : "Load more posts"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Posts;
