import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function FollowingPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { mergeAuthUser, setSuggestedUsers, fetchSuggestedUsers } = useApp();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter(u => (u.username || "").toLowerCase().includes(t));
  }, [users, q]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/v1/user/${id}/following`);
      if (data?.success) setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load following");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) refresh();
  }, [id, refresh]);

  const toggleFollow = async (targetId) => {
    const targetUser = users.find((u) => u._id === targetId);
    const wasFollowing = targetUser ? targetUser.isFollowing : true;

    // Optimistically update suggested users
    if (wasFollowing && targetUser) {
      setSuggestedUsers((prev) => {
        const idStr = String(targetId);
        const filteredList = (prev || []).filter((u) => String(u?._id || u) !== idStr);
        return [
          {
            _id: targetUser._id,
            username: targetUser.username || "",
            profilePicture: targetUser.profilePicture || "",
            bio: targetUser.bio || "",
          },
          ...filteredList,
        ];
      });
    } else if (!wasFollowing) {
      setSuggestedUsers((prev) =>
        (prev || []).filter((u) => String(u?._id || u) !== String(targetId))
      );
    }

    try {
      const res = await api.post(`/api/v1/user/followorunfollow/${targetId}`, {});
      if (res.data?.user) mergeAuthUser(res.data.user);
      setUsers(prev => prev.map(u => u._id === targetId ? { ...u, isFollowing: !u.isFollowing } : u));
      fetchSuggestedUsers(true);
      toast.success(res.data?.message || "Follow status updated");
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || "Could not update follow");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Following</h1>
        <input
          className="border rounded px-3 py-2 text-sm"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">Not following anyone yet.</p>
      ) : (
        <div className="divide-y">
          {filtered.map(u => (
            <div key={u._id} className="flex items-center justify-between py-3">
              <Link to={`/profile/${u._id}`} className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={u.profilePicture} />
                  <AvatarFallback>{(u.username || "X").slice(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{u.username}</span>
              </Link>
              {!u.isMe && (
                <Button size="sm" variant={u.isFollowing ? "secondary" : "default"} onClick={() => toggleFollow(u._id)}>
                  {u.isFollowing ? "Unfollow" : "Follow"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => navigate(`/profile/${id}`)}
        className="text-sm font-semibold text-blue-600 hover:underline mb-4"
      >
        ← Back to Profile
      </button>
    </div>
  );
}
