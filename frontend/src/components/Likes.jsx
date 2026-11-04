import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import api from "@/lib/axios";
import Post from './Post';
import { Button } from './ui/button';
import { toast } from 'sonner';

export default function Likes() {
  const { user } = useApp();
  const [likedPosts, setLikedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const fetchLikedPosts = async () => {
      if (!user?._id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get('/api/v1/post/liked?page=1&limit=10');
        if (isCurrent && res.data?.success && Array.isArray(res.data.posts)) {
          setLikedPosts(res.data.posts);
          setHasMore(Boolean(res.data.hasMore));
          setPage(1);
        }
      } catch (err) {
        console.error("fetchLikedPosts error:", err);
        if (isCurrent) toast.error("Failed to load liked posts");
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchLikedPosts();
    return () => {
      isCurrent = false;
    };
  }, [user?._id]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.get(`/api/v1/post/liked?page=${nextPage}&limit=10`);
      if (res.data?.success && Array.isArray(res.data.posts)) {
        setLikedPosts((prev) => {
          const existingIds = new Set(prev.map((p) => String(p._id)));
          const fresh = res.data.posts.filter((p) => !existingIds.has(String(p._id)));
          return [...prev, ...fresh];
        });
        setPage(nextPage);
        setHasMore(Boolean(res.data.hasMore));
      }
    } catch (err) {
      console.error("loadMore liked error:", err);
      toast.error("Failed to load more liked posts");
    } finally {
      setLoadingMore(false);
    }
  };

  if (!user) {
    return <div className="p-6 text-center text-gray-500">Please log in to view your likes.</div>;
  }

  if (loading) {
    return (
      <div className="flex-1 my-8 flex items-center justify-center text-gray-500">
        Loading liked posts...
      </div>
    );
  }

  return (
    <div className="flex-1 my-8 flex flex-col items-center px-4">
      {likedPosts.length === 0 ? (
        <p className="text-md font-bold flex items-center justify-center h-64 text-gray-500">
          You haven’t liked any posts yet.
        </p>
      ) : (
        <div className="w-full max-w-xl pb-10">
          {likedPosts.map((post) => (
            <Post key={post._id} post={post} />
          ))}
          {hasMore && (
            <div className="flex justify-center my-6">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading more..." : "Load more liked posts"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
