import React from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const SuggestedUsers = () => {
  const { suggestedUsers, user } = useSelector((store) => store.auth);

  const myId = user?._id;
  const followingIds = (user?.following || []).map(String);

  // only users who are NOT me and NOT in my following
  const visibleUsers = (suggestedUsers || []).filter(u => {
    const uid = String(u?._id || "");
    if (!uid || !myId) return false;
    const isMe = uid === String(myId);
    const iAlreadyFollow = followingIds.includes(uid);
    return !isMe && !iAlreadyFollow;
  });

  return (
    <div className="my-10">
      <div className="flex items-center justify-between text-sm">
        <h1 className="font-semibold text-gray-600">Suggested for you</h1>
        <span className="mx-34 font-medium cursor-pointer">See All</span>
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
