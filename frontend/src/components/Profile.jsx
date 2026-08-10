import React, { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import useGetUserProfile from "@/hooks/useGetUserProfile";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import api, { API_URL } from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { AtSign, Heart, MessageCircle } from "lucide-react";

const toId = (x) => (x && typeof x === "object" ? String(x._id) : String(x));
const hasId = (arr, id) => (arr || []).some((x) => toId(x) === String(id));
const withoutId = (arr, id) => (arr || []).filter((x) => toId(x) !== String(id));

const Profile = () => {
  const navigate = useNavigate();
  const params = useParams();
  const userId = params.id;

  useGetUserProfile(userId);

  const { posts, userProfile, user, setAuthUser, setUserProfile } = useApp();

  const [activeTab, setActiveTab] = useState("posts");

  const meId = String(user?._id || "");
  const targetId = String(userProfile?._id || "");

  const isLoggedInUserProfile = meId && targetId && meId === targetId;

  const computedIsFollowing = useMemo(() => {
    if (!meId || !targetId) return false;
    if (Array.isArray(userProfile?.followers)) {
      return hasId(userProfile.followers, meId);
    }
    return hasId(user?.following, targetId);
  }, [userProfile?.followers, user?.following, meId, targetId]);

  const [isFollowing, setIsFollowing] = useState(computedIsFollowing);

  useEffect(() => {
    setIsFollowing(computedIsFollowing);
  }, [computedIsFollowing]);

  const handleTabChange = (tab) => setActiveTab(tab);

  const handleFollowToggle = async () => {
    if (!meId || !targetId) return;

    const prevUser = user;
    const prevProfile = userProfile;

    const nextFollowing = isFollowing
      ? withoutId(user?.following, targetId)
      : [...(user?.following || []), targetId];

    const nextFollowers = isFollowing
      ? withoutId(userProfile?.followers, meId)
      : [...(userProfile?.followers || []), meId];

    setIsFollowing(!isFollowing);
    setAuthUser({ ...user, following: nextFollowing });
    setUserProfile({ ...userProfile, followers: nextFollowers });

    try {
      const res = await api.post(
        `${API_URL}/api/v1/user/followorunfollow/${targetId}`,
        {},
        { withCredentials: true }
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Follow action failed");
      }

      toast.success(res.data.message || (!isFollowing ? "Followed" : "Unfollowed"));
    } catch (err) {
      setIsFollowing(isFollowing);
      setAuthUser(prevUser);
      setUserProfile(prevProfile);
      toast.error(err?.response?.data?.message || "Could not update follow");
      console.error(err);
    }
  };

  const displayedPost = useMemo(() => {
    if (activeTab === "posts") return userProfile?.posts || [];
    if (activeTab === "saved") return userProfile?.bookmarks || [];
    if (activeTab === "reels") return posts || [];
    return userProfile?.posts || [];
  }, [activeTab, userProfile?.posts, userProfile?.bookmarks, posts]);

  return (
    <div className="flex max-w-5xl justify-center mx-auto pl-10">
      <div className="flex flex-col gap-20 p-8 pt-15">
        <div className="grid grid-cols-2">
          <section className="flex items-center justify-center">
            <Avatar className="h-32 w-32">
              <AvatarImage src={userProfile?.profilePicture} alt="profilephoto" />
              <AvatarFallback>
                {(userProfile?.username || "X").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </section>

          <section>
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <span className="font-bold">{userProfile?.username}</span>

                {isLoggedInUserProfile && (
                  <Button
                    onClick={() => navigate("/account/edit")}
                    variant="secondary"
                    className="h-8"
                  >
                    Edit Profile
                  </Button>
                )}

                {!isLoggedInUserProfile &&
                  (isFollowing ? (
                    <Button onClick={handleFollowToggle} variant="secondary" className="h-8">
                      Unfollow
                    </Button>
                  ) : (
                    <Button onClick={handleFollowToggle} className="h-8 bg-[#0095F6] hover:bg-[#3192d2]">
                      Follow
                    </Button>
                  ))}
              </div>

              <div className="flex items-center gap-4">
                <p>
                  <span className="font-semibold">{userProfile?.posts?.length || 0} </span>
                  posts
                </p>
                <p>
                  <span className="font-semibold">{userProfile?.followers?.length || 0} </span>
                  followers
                </p>
                <p>
                  <span className="font-semibold">{userProfile?.following?.length || 0} </span>
                  following
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-semibold">{userProfile?.bio || "bio here..."}</span>
                <Badge className="w-fit" variant="secondary">
                  <AtSign /> <span className="pl-1">{userProfile?.username}</span>
                </Badge>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-t-gray-200">
          <div className="flex items-center justify-center gap-10 text-sm">
            <span
              className={`py-3 cursor-pointer ${
                activeTab === "posts" ? "font-bold border-b-2 border-black" : ""
              }`}
              onClick={() => handleTabChange("posts")}
            >
              POSTS
            </span>
            <span
              className={`py-3 cursor-pointer ${
                activeTab === "saved" ? "font-bold border-b-2 border-black" : ""
              }`}
              onClick={() => handleTabChange("saved")}
            >
              SAVED
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 my-5">
            {displayedPost?.map((post) => (
              <div
                key={post?._id}
                className="relative group cursor-pointer"
                onClick={() => navigate(`/post/${post?._id}`)}
              >
                <img
                  src={post?.image}
                  alt="postimage"
                  className="rounded-sm w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 text-white transition-opacity">
                  <div className="flex items-center gap-1">
                    <Heart className="w-5 h-5 fill-white" />
                    <span>{post?.likes?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>{post?.comments?.length || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
