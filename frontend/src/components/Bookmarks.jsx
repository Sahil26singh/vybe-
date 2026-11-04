import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import api from "@/lib/axios";
import Post from './Post';
import { Button } from './ui/button';
import { toast } from 'sonner';

const idStr = (x) => (x?._id ? String(x._id) : String(x ?? ""));

export default function Bookmarks() {
  const { user } = useApp();
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const fetchBookmarks = async () => {
      if (!user?._id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get('/api/v1/post/bookmarked?page=1&limit=10');
        if (isCurrent && res.data?.success && Array.isArray(res.data.posts)) {
          setBookmarkedPosts(res.data.posts);
          setHasMore(Boolean(res.data.hasMore));
          setPage(1);
        }
      } catch (err) {
        console.error("fetchBookmarks error:", err);
        if (isCurrent) toast.error("Failed to load bookmarked posts");
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    fetchBookmarks();
    return () => {
      isCurrent = false;
    };
  }, [user?._id]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.get(`/api/v1/post/bookmarked?page=${nextPage}&limit=10`);
      if (res.data?.success && Array.isArray(res.data.posts)) {
        setBookmarkedPosts((prev) => {
          const existingIds = new Set(prev.map((p) => String(p._id)));
          const fresh = res.data.posts.filter((p) => !existingIds.has(String(p._id)));
          return [...prev, ...fresh];
        });
        setPage(nextPage);
        setHasMore(Boolean(res.data.hasMore));
      }
    } catch (err) {
      console.error("loadMore bookmarks error:", err);
      toast.error("Failed to load more bookmarked posts");
    } finally {
      setLoadingMore(false);
    }
  };

  const currentBookmarks = useMemo(
    () => new Set((user?.bookmarks || []).map(idStr)),
    [user?.bookmarks]
  );

  const visiblePosts = useMemo(
    () => bookmarkedPosts.filter((p) => currentBookmarks.has(idStr(p._id))),
    [bookmarkedPosts, currentBookmarks]
  );

  if (!user) {
    return <div className="p-6 text-center text-gray-500">Please log in to view your bookmarks.</div>;
  }

  if (loading) {
    return (
      <div className="flex-1 my-8 flex items-center justify-center text-gray-500">
        Loading bookmarks...
      </div>
    );
  }

  return (
    <div className="flex-1 my-8 flex flex-col items-center px-4">
      {visiblePosts.length === 0 ? (
        <p className="text-md font-bold flex items-center justify-center h-64 text-gray-500">
          No bookmarked posts yet.
        </p>
      ) : (
        <div className="w-full max-w-xl pb-10">
          {visiblePosts.map((post) => (
            <Post key={post._id} post={post} />
          ))}
          {hasMore && (
            <div className="flex justify-center my-6">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading more..." : "Load more bookmarks"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
