import {
  Bookmark,
  Heart,
  Bell,
  Home,
  LogOut,
  MessageCircle,
  PlusSquare,
  Search,
  Handshake,
} from "lucide-react";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { toast } from "sonner";
import axios from "axios";
import { useNavigate, useLocation, matchPath } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setAuthUser } from "@/redux/authSlice";
import CreatePost from "./CreatePost";
import { setPosts, setSelectedPost } from "@/redux/postSlice";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import logo from '../assets/logo.png';

const API_BASE ="https://vybe-ymdg.onrender.com";

const LeftSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((store) => store.auth);
  const dispatch = useDispatch();

  const [manualActive, setManualActive] = useState(null);
  const [open, setOpen] = useState(false);
  // CONNECTIONS (handshake) state
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [followersCount, setFollowersCount] = useState(null);
  const [followingCount, setFollowingCount] = useState(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState(null);

  // Notifications badge state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  // Keep Create highlight
  useEffect(() => {
    if (open) setManualActive("Create");
    else if (manualActive === "Create") setManualActive(null);
  }, [open]);

  useEffect(() => {
    if (manualActive && manualActive !== "Create") setManualActive(null);
  }, [location.pathname]);

  // Fetch unread notification count
  const fetchUnreadCount = async () => {
    try {
      setNotifLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/notification`, { withCredentials: true });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      const count = list.filter((n) => !n.read).length;
      setUnreadCount(count);
    } catch (err) {
      console.error("Failed to fetch notification count:", err);
      setUnreadCount(0);
    } finally {
      setNotifLoading(false);
    }
  };

  // Fetch on mount and every 30s
  useEffect(() => {
    if (user?._id) {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user?._id]);

  // Logout
  const logoutHandler = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/user/logout`, {
        withCredentials: true,
      });
      if (res.data.success) {
        dispatch(setAuthUser(null));
        dispatch(setSelectedPost(null));
        dispatch(setPosts([]));
        navigate("/login");
        toast.success(res.data.message);
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Logout failed");
    }
  };

  const sidebarHandler = (textType) => {
    if (textType === "Logout") {
      logoutHandler();
    } else if (textType === "Create") {
      setOpen(true);
    } else if (textType === "Profile") {
      navigate(`/profile/${user?._id}`);
    } else if (textType === "Home") {
      navigate("/");
    } else if (textType === "Messages") {
      navigate("/chat");
    } else if (textType === "Bookmarks") {
      navigate("/bookmarks");
    } else if (textType === "Search") {
      navigate("/search");
    } else if (textType === "Likes") {
      navigate("/likes");
    } else if (textType === "Notifications") {
      navigate("/notification");
    }
  };

  const sidebarItems = useMemo(
    () => [
      { icon: <Home />, text: "Home" },
      { icon: <Search />, text: "Search" },
      { icon: <Handshake />, text: "Connections" },
      { icon: <MessageCircle />, text: "Messages" },
      { icon: <PlusSquare />, text: "Create" },
      { icon: <Bell />, text: "Notifications" },
      { icon: <Bookmark />, text: "Bookmarks" },
      { icon: <Heart />, text: "Likes" },
      {
        icon: (
          <Avatar className="w-6 h-6">
            <AvatarImage src={user?.profilePicture} alt="@user" />
            <AvatarFallback>
              {(user?.username || "X").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ),
        text: "Profile",
      },
      { icon: <LogOut />, text: "Logout" },
    ],
    [user]
  );

  const isRouteActive = useCallback(
    (text) => {
      const path = location.pathname;
      switch (text) {
        case "Home":
          return matchPath({ path: "/", end: true }, path) != null;
        case "Search":
          return matchPath("/search", path) != null;
        case "Messages":
          return matchPath({ path: "/chat", end: true }, path) != null || matchPath("/chat/:id", path) != null;
        case "Connections":
          return (
            matchPath({ path: "/profile/:id/followers", end: true }, path) != null ||
            matchPath("/profile/:id/following", path) != null
          );
        case "Bookmarks":
          return matchPath("/bookmarks", path) != null;
        case "Notifications":
          return matchPath("/notification", path) != null;
        case "Likes":
          return matchPath("/likes", path) != null;
        case "Profile":
          return matchPath("/profile/:id", path) != null;
        default:
          return false;
      }
    },
    [location.pathname]
  );

  const isActive = (text) => isRouteActive(text);

  // --- Connections (Followers / Following)  ---
  const fetchConnectionsCounts = async (userId = user?._id) => {
    if (!userId) return;
    setConnectionsLoading(true);
    setConnectionsError(null);
    try {
      // try fetching lists and count length - backend returns users or data arrays
      const [fRes, gRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/user/${userId}/followers`, { withCredentials: true }),
        axios.get(`${API_BASE}/api/v1/user/${userId}/following`, { withCredentials: true }),
      ]);
      const fList = Array.isArray(fRes.data?.users) ? fRes.data.users : Array.isArray(fRes.data?.data) ? fRes.data.data : [];
      const gList = Array.isArray(gRes.data?.users) ? gRes.data.users : Array.isArray(gRes.data?.data) ? gRes.data.data : [];
      setFollowersCount(fList.length);
      setFollowingCount(gList.length);
    } catch (err) {
      console.error("fetchConnectionsCounts error:", err);
      setConnectionsError("Failed to load");
      setFollowersCount(null);
      setFollowingCount(null);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const onConnectionsOpenChange = (open) => {
    setConnectionsOpen(open);
    setManualActive(open ? "Connections" : null);
    if (open) fetchConnectionsCounts();
  };


  return (
    <div className="fixed top-0 z-10 left-0 px-4 border-r border-gray-300 w-[16%] h-screen">
      <div className="flex flex-col">
        <div className="flex items-center justify-evenly my-7 pl-0">
          <img className="w-10 h-10" src={logo} alt="logo" />
          <h1 className="font-bold text-xl -translate-x-8">Vybe</h1>
        </div>

        <div>
          {sidebarItems.map((item, index) => {
            const active = isActive(item.text);
            const base = "flex items-center gap-3 relative cursor-pointer rounded-lg p-3 my-3";
            const hover = "hover:bg-gray-100";
            const bg = active ? "bg-gray-100" : "";
            const isConnections = item.text === "Connections";
            const isNotif = item.text === "Notifications";

            if (isConnections) {
              return (
                <Popover key={index} open={connectionsOpen} onOpenChange={onConnectionsOpenChange}>
                  <PopoverTrigger asChild>
                    <div
                      className={`${base} ${hover} ${bg}`}
                      role="button"
                      aria-selected={active}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectionsOpen((v) => !v);
                      }}
                    >
                      {item.icon}
                      <span>{item.text}</span>
                    </div>
                  </PopoverTrigger>

                  <PopoverContent side="right" align="start" className="w-48 p-2" onClick={(e) => e.stopPropagation()}>
                    

                    <div className="flex flex-col">
                      {connectionsLoading ? (
                        <div className="px-3 py-2 text-sm text-gray-600">Loading…</div>
                      ) : connectionsError ? (
                        <div className="px-3 py-2 text-sm text-red-600">{connectionsError}</div>
                      ) : (
                        <>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-300 rounded"
                            onClick={() => {
                              setConnectionsOpen(false);
                              setManualActive(null);
                              navigate(`/profile/${user?._id}/followers`);
                            }}
                          >
                            Followers {typeof followersCount === "number" ? `(${followersCount})` : ""}
                          </button>

                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-300 rounded"
                            onClick={() => {
                              setConnectionsOpen(false);
                              setManualActive(null);
                              navigate(`/profile/${user?._id}/following`);
                            }}
                          >
                            Following {typeof followingCount === "number" ? `(${followingCount})` : ""}
                          </button>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <div
                key={index}
                className={`${base} ${hover} ${bg}`}
                onClick={() => sidebarHandler(item.text)}
                aria-selected={active}
                role="button"
              >
                {item.icon}
                <span>{item.text}</span>

                {/* Notification badge (simple) */}
                {isNotif && unreadCount > 0 && (
                  <span className="absolute right-4 top-3 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-red-600 rounded-full">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CreatePost
        open={open}
        setOpen={(v) => {
          setOpen(v);
          if (!v && manualActive === "Create") setManualActive(null);
        }}
      />
    </div>
  );
};

export default LeftSidebar;
