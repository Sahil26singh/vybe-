import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Notification() {
  const { user, fetchUnreadNotifCount } = useApp();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const fetchNotifications = useCallback(async (targetPage = 1) => {
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.get(`/api/v1/notification?page=${targetPage}&limit=20`);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      if (targetPage === 1) {
        setNotifications(list);
      } else {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => String(n._id)));
          const uniqueNew = list.filter((n) => !existingIds.has(String(n._id)));
          return [...prev, ...uniqueNew];
        });
      }
      setPage(targetPage);
      setHasMore(Boolean(res.data?.hasMore));
      fetchUnreadNotifCount();
    } catch (err) {
      console.error("fetchNotifications error:", err);
      const msg = err?.response?.data?.message || err?.message || "Failed to fetch notifications";
      toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchUnreadNotifCount]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchNotifications(page + 1);
    }
  };

  async function markRead(id) {
    try {
      await api.put(`/api/v1/notification/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (String(n._id) === String(id) ? { ...n, read: true } : n)));
      fetchUnreadNotifCount();
    } catch (err) {
      console.error("markRead error:", err);
      toast.error("Failed to mark notification read");
    }
  }

  async function markAllRead() {
    try {
      await api.put('/api/v1/notification/markall', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      fetchUnreadNotifCount();
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error("markAllRead error:", err);
      toast.error("Failed to mark all read");
    }
  }

  async function deleteNotification(id) {
    setNotifications((prev) => prev.filter((n) => String(n._id) !== String(id)));
    try {
      if (id && String(id).length === 24) {
        await api.delete(`/api/v1/notification/${id}`);
        fetchUnreadNotifCount();
        toast.success("Notification deleted");
      }
    } catch (err) {
      console.error("deleteNotification error:", err);
      toast.error("Failed to delete notification");
    }
  }

  useEffect(() => {
    if (user?._id) fetchNotifications();
  }, [user?._id, fetchNotifications]);

  return (
    <div className="flex flex-col w-full h-full p-3 sm:p-6 bg-white rounded shadow overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => fetchNotifications(1)}>
            Refresh
          </Button>
          <Button size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-blue-500">Loading…</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-gray-500">No notifications</p>
      ) : (
        <div className="flex-1 divide-y overflow-y-auto">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`flex items-start justify-between gap-3 p-3 ${n.read ? "bg-white" : "bg-blue-50"}`}
            >
              <div className="flex items-start gap-3">
                <Link to={n.from?._id ? `/profile/${n.from._id}` : "#"} className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={n.from?.profilePicture} />
                    <AvatarFallback>{(n.from?.username || "X").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>

                <div>
                  <div className="text-sm">
                    <strong>{n.from?.username || "Someone"}</strong>
                  </div>
                  <div className="text-sm text-blue-500">
                    {n.message || (n.type === "like" ? "Liked your post" : "") || (n.type === "comment" ? "Commented on your post" : "") || (n.type === "message" ? "Send you new message" : "") || (n.type === "follow" ? "Started following you" : "")}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {!n.read ? (
                  <Button size="sm" variant="outline" onClick={() => markRead(n._id)}>
                    Mark read
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Read</span>
                    <button
                      onClick={() => deleteNotification(n._id)}
                      className="ml-1 text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded"
                      aria-label="Delete notification"
                      title="Delete notification"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-3">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}

      <div className="mt-3 text-xs font-bold text-gray-500">
        Unread: <span className="font-medium">{unreadCount}</span>
      </div>
    </div>
  );
}
