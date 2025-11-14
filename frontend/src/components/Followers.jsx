import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useParams } from "react-router-dom";

const API_BASE ="http://localhost:8000";

export default function FollowersPage() {
    const navigate = useNavigate();
  const { id } = useParams(); // profile user id
  const { user } = useSelector((s) => s.auth);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter(u => (u.username || "").toLowerCase().includes(t));
  }, [users, q]);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/api/v1/user/${id}/followers`, { withCredentials: true });
      if (data?.success) setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) refresh(); }, [id]);

  const toggleFollow = async (targetId) => {
    try {
      await axios.post(`${API_BASE}/api/v1/user/followorunfollow/${targetId}`, {}, { withCredentials: true });
      // update local isFollowing flag
      setUsers(prev => prev.map(u => u._id === targetId ? { ...u, isFollowing: !u.isFollowing } : u));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Followers</h1>
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
        <p className="text-sm text-gray-500">No followers found.</p>
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
      )}<button
  onClick={() => navigate(`/profile/${id}`)}
  className="text-sm font-semibold text-blue-600 hover:underline mb-4"
>
  ← Back to Profile
</button>

    </div>
  );
}
