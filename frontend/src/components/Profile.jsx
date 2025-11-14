import React, { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import useGetUserProfile from "@/hooks/useGetUserProfile";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { setAuthUser, setUserProfile } from "@/redux/authSlice";
import { toast } from "sonner";
import { AtSign, Heart, MessageCircle } from "lucide-react";

const toId = (x) => (x && typeof x === "object" ? String(x._id) : String(x));
const hasId = (arr, id) => (arr || []).some((x) => toId(x) === String(id));
const withoutId = (arr, id) => (arr || []).filter((x) => toId(x) !== String(id));

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const params = useParams();
  const userId = params.id;

  // always fetch latest profile on mount/param change
  useGetUserProfile(userId);

  const { posts } = useSelector((store) => store.post);
  const { userProfile, user } = useSelector((store) => store.auth);

  const [activeTab, setActiveTab] = useState("posts"); // "posts" | "saved" | "reels"

  const meId = String(user?._id || "");
  const targetId = String(userProfile?._id || "");

  const isLoggedInUserProfile = meId && targetId && meId === targetId;

  const computedIsFollowing = useMemo(() => {
    if (!meId || !targetId) return false;
    // Prefer the target profile's followers 
    if (Array.isArray(userProfile?.followers)) {
      return hasId(userProfile.followers, meId);
    }
    // Fallback to our auth user
    return hasId(user?.following, targetId);
  }, [meId, targetId, userProfile?.followers, user?.following]);

  const [isFollowing, setIsFollowing] = useState(computedIsFollowing);

  // keep local state in sync whenever store-derived value changes
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

    // Optimistic updates
    setIsFollowing(!isFollowing);
    dispatch(setAuthUser({ ...user, following: nextFollowing }));
    dispatch(setUserProfile({ ...userProfile, followers: nextFollowers }));

    try {
      const res = await axios.post(
        `https://vybe-ymdg.onrender.com/api/v1/user/followorunfollow/${targetId}`,
        {},
        { withCredentials: true }
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "Follow action failed");
      }

      // If your API returns fresh user/profile, trust server state:
      // const { me, profile } = res.data || {};
      // if (me) dispatch(setAuthUser(me));
      // if (profile) dispatch(setUserProfile(profile));

      toast.success(res.data.message || (!isFollowing ? "Followed" : "Unfollowed"));
    } catch (err) {
      setIsFollowing(isFollowing); 
      dispatch(setAuthUser(prevUser));
      dispatch(setUserProfile(prevProfile));
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
                    <>
                      <Button
                        onClick={handleFollowToggle}
                        variant="secondary"
                        className="h-8"
                      >
                        Unfollow
                      </Button>
                      <Button
                        onClick={() => navigate(`/chat/${userProfile?._id}`)}
                        variant="secondary"
                        className="h-8"
                      >
                        Message
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleFollowToggle}
                      className="bg-[#0095F6] hover:bg-[#3192d2] h-8"
                    >
                      Follow
                    </Button>
                  ))}
              </div>

              <div className="flex items-center gap-4">
                <p>
                  <span className="font-semibold">{userProfile?.posts?.length || 0} </span>
                  posts
                </p>

                <p className="cursor-pointer hover:underline">
                  <Link to={`/profile/${userProfile?._id}/followers`}>
                    <span className="font-semibold">{userProfile?.followers?.length || 0} </span>
                    followers
                  </Link>
                </p>

                <p className="cursor-pointer hover:underline">
                  <Link to={`/profile/${userProfile?._id}/following`}>
                    <span className="font-semibold">{userProfile?.following?.length || 0} </span>
                    following
                  </Link>
                </p>
              </div>

              <Badge className="w-fit" variant="secondary">
                <AtSign />
                <span className="pl-1">{userProfile?.username}</span>
              </Badge>

              <div className="flex flex-col gap-1">
                <span className="font-semibold">
                  Bio :-{" "}
                  <span className="font-normal">{userProfile?.bio || "bio here..."}</span>
                </span>
                <span className="font-semibold">
                  Gender :-{" "}
                  <span className="font-normal">{userProfile?.gender || "..."}</span>
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-t-gray-200">
          <div className="flex items-center justify-center gap-10 text-sm">
            <span
              className={`py-3 cursor-pointer ${activeTab === "posts" ? "font-bold" : ""}`}
              onClick={() => handleTabChange("posts")}
            >
              POSTS
            </span>
            <span
              className={`py-3 cursor-pointer ${activeTab === "saved" ? "font-bold" : ""}`}
              onClick={() => handleTabChange("saved")}
            >
              SAVED
            </span>
            <span
              className={`py-3 cursor-pointer ${activeTab === "reels" ? "font-bold" : ""}`}
              onClick={() => handleTabChange("reels")}
            >
              REELS
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {displayedPost?.map((post) => (
              <div key={post?._id} className="relative group cursor-pointer">
                <img
                  src={post?.image}
                  alt="postimage"
                  className="rounded-sm my-2 w-full aspect-square object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center text-white space-x-4">
                    <button className="flex items-center gap-2 hover:text-gray-300">
                      <Heart />
                      <span>{post?.likes?.length || 0}</span>
                    </button>
                    <button className="flex items-center gap-2 hover:text-gray-300">
                      <MessageCircle />
                      <span>{post?.comments?.length || 0}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!displayedPost?.length && (
              <div className="col-span-3 text-center text-sm text-gray-500 py-8">
                Nothing to show here yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
