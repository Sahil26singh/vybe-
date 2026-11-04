import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import api from '@/lib/axios';
import { toast } from 'sonner';

const SuggestedUsers = () => {
  const { suggestedUsers, user, mergeAuthUser, setSuggestedUsers, fetchSuggestedUsers } = useApp();
  const [followingMap, setFollowingMap] = useState({});

  const toId = (x) => (x && typeof x === "object" ? String(x._id || x) : String(x || ""));

  const myId = toId(user?._id);
  const followingIds = (user?.following || []).map(toId);

  // Users who are NOT me and NOT in my following
  const visibleUsers = (suggestedUsers || []).filter((u) => {
    const uid = toId(u?._id);
    if (!uid || !myId) return false;
    const isMe = uid === myId;
    const iAlreadyFollow = followingIds.includes(uid);
    return !isMe && !iAlreadyFollow;
  });

  const handleFollow = async (targetId) => {
    if (followingMap[targetId]) return;
    setFollowingMap((prev) => ({ ...prev, [targetId]: true }));

    // Optimistically remove from suggested users
    setSuggestedUsers((prev) =>
      (prev || []).filter((u) => String(u?._id || u) !== String(targetId))
    );

    try {
      const res = await api.post(`/api/v1/user/followorunfollow/${targetId}`, {});
      if (res.data?.success) {
        if (res.data.user) {
          mergeAuthUser(res.data.user);
        }
        fetchSuggestedUsers(true);
        toast.success(res.data.message || "Followed successfully");
      }
    } catch (err) {
      setFollowingMap((prev) => ({ ...prev, [targetId]: false }));
      fetchSuggestedUsers(true);
      toast.error(err?.response?.data?.message || "Could not follow user");
    }
  };

  if (!visibleUsers || visibleUsers.length === 0) {
    return (
      <div className="my-10">
        <div className="flex items-center justify-between text-sm mb-3">
          <h1 className="font-semibold text-gray-600">Suggested for you</h1>
        </div>
        <p className="text-xs text-gray-400">No new user suggestions right now.</p>
      </div>
    );
  }

  return (
    <div className="my-10">
      <div className="flex items-center justify-between text-sm">
        <h1 className="font-semibold text-gray-600">Suggested for you</h1>
        <span className="font-medium cursor-pointer text-xs text-gray-500 hover:text-black">See All</span>
      </div>

      {visibleUsers.map((u) => (
        <div key={u._id} className="flex items-center justify-between my-5">
          <div className="flex items-center gap-2">
            <Link to={`/profile/${u?._id}`}>
              <Avatar>
                <AvatarImage src={u?.profilePicture || undefined} alt="profile" />
                <AvatarFallback>{(u?.username || "X").slice(0,2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <h1 className="font-semibold text-sm hover:font-normal">
                <Link to={`/profile/${u?._id}`}>{u?.username}</Link>
              </h1>
              <span className="text-gray-600 text-xs line-clamp-1 max-w-[130px]">{u?.bio || 'Bio here...'}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs bg-[#0095F6] hover:bg-[#3192d2]"
            disabled={followingMap[u._id]}
            onClick={() => handleFollow(u._id)}
          >
            {followingMap[u._id] ? "Following" : "Follow"}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default SuggestedUsers;
