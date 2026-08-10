import React, { useEffect, useMemo, useState } from "react";
import api, { API_URL } from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";

const API_BASE = API_URL;

export default function Notification() {
  const { user, fetchUnreadNotifCount } = useApp();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`${API_BASE}/api/v1/notification`, { withCredentials: true });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setNotifications(list);
      fetchUnreadNotifCount();
    } catch (err) {
      console.error("fetchNotifications error:", err);
      setError(err?.response?.data?.message || err?.message || "Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  };

  async function markRead(id) {
    try {
      await api.put(`${API_BASE}/api/v1/notification/${id}/read`, {}, { withCredentials: true });
      setNotifications((prev) => prev.map((n) => (String(n._id) === String(id) ? { ...n, read: true } : n)));
      fetchUnreadNotifCount();
    } catch (err) {
      console.error("markRead error:", err);
      setError("Failed to mark notification read");
    }
  }

  async function markAllRead() {
    try {
      await api.put(`${API_BASE}/api/v1/notification/markall`, {}, { withCredentials: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      fetchUnreadNotifCount();
    } catch (err) {
      console.error("markAllRead error:", err);
      setError("Failed to mark all read");
    }
  }

  async function deleteNotification(id) {
    setNotifications((prev) => prev.filter((n) => String(n._id) !== String(id)));
    try {
      if (id && String(id).length === 24) {
        await api.delete(`${API_BASE}/api/v1/notification/${id}`, { withCredentials: true });
        fetchUnreadNotifCount();
      }
    } catch (err) {
      console.error("deleteNotification error:", err);
    }
  }

  useEffect(() => {
    if (user?._id) fetchNotifications();
  }, [user?._id]);

  return (
    <div className="flex flex-col w-full h-full p-3 bg-white rounded shadow overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Notifications</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={fetchNotifications}>
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
                    {n.message || (n.type === "like" ? "Liked your post" : "") || (n.type === "message" ? "Send you new message" : "") || (n.type === "follow" ? "Started following you" : "")}
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

      <div className="mt-3 text-xs font-bold text-gray-500">
        Unread: <span className="font-medium">{unreadCount}</span>
      </div>
    </div>
  );
}
