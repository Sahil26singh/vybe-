import React from 'react';
import { useApp } from '@/context/AppContext';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const SuggestedUsers = () => {
  const { suggestedUsers, user } = useApp();

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
              <span className="text-gray-600 text-sm">{u?.bio || 'Bio here...'}</span>
            </div>
          </div>
          <span className="text-[#3BADF8] text-xs font-bold cursor-pointer hover:text-[#3495d6]">
            <Link to={`/profile/${u?._id}`}>Profile</Link>
          </span>
        </div>
      ))}
    </div>
  );
};

export default SuggestedUsers;
