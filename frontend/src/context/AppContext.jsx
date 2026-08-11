import React, { createContext, useContext, useState, useEffect, useRef } from "react";

import { io } from "socket.io-client";
import api, { API_URL } from "@/lib/axios";

const AppContext = createContext(null);

const normalizeId = (x) =>
  typeof x === "string" ? x : String(x?._id ?? x?.toString?.() ?? x);

const normalizeUser = (u) => {
  if (!u) return u;
  const safe = { ...u };
  safe.bookmarks = (u.bookmarks || []).map(normalizeId);
  return safe;
};

export const AppProvider = ({ children }) => {
  // --- Auth State ---
  const [user, setUserState] = useState(() => {
    try {
      const saved = localStorage.getItem("vybe_user");
      return saved ? normalizeUser(JSON.parse(saved)) : null;
    } catch (e) {
      return null;
    }
  });

  const setAuthUser = (u) => {
    const normalized = normalizeUser(u);
    setUserState(normalized);
    if (normalized) {
      localStorage.setItem("vybe_user", JSON.stringify(normalized));
    } else {
      localStorage.removeItem("vybe_user");
    }
  };

  const mergeAuthUser = (data) => {
    setUserState((prev) => {
      const updated = normalizeUser({ ...(prev || {}), ...(data || {}) });
      if (updated) {
        localStorage.setItem("vybe_user", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  // --- Post State ---
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);

  // --- Chat State ---
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);

  // --- Real-time Notification State ---
  const [likeNotification, setLikeNotificationState] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const fetchUnreadNotifCount = async () => {
    if (!user?._id) return;
    try {
      const res = await api.get(`${API_URL}/api/v1/notification`, { withCredentials: true });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      const count = list.filter((n) => !n.read).length;
      setUnreadNotifCount(count);
    } catch (err) {
      console.error("fetchUnreadNotifCount error:", err);
    }
  };

  useEffect(() => {
    if (user?._id) {
      fetchUnreadNotifCount();
    } else {
      setUnreadNotifCount(0);
    }
  }, [user?._id]);

  const setLikeNotification = (notification) => {
    if (!notification) return;
    if (notification.type === "like") {
      setLikeNotificationState((prev) => [notification, ...prev]);
    } else if (notification.type === "dislike") {
      setLikeNotificationState((prev) =>
        prev.filter(
          (n) => n.userId !== notification.userId || n.postId !== notification.postId
        )
      );
    } else {
      setLikeNotificationState((prev) => [notification, ...prev]);
    }
  };

  const removeNotification = (id) => {
    setLikeNotificationState((prev) =>
      prev.filter((n) => {
        const nid = n._id ?? `${n.type}:${n.postId}:${n.userId}`;
        return nid !== id;
      })
    );
  };

  const clearAllNotifications = () => {
    setLikeNotificationState([]);
  };

  // --- Socket State & Centralized Lifecycle ---
  const [socket, setSocket] = useState(null);
  // Keep the live socket instance in a ref so React cleanup cycles don't destroy it
  const socketRef = useRef(null);
  const socketUserIdRef = useRef(null);

  useEffect(() => {
    const userId = user?._id ? String(user._id) : null;

    if (userId) {
      // If we already have a live socket for this exact user, just sync state and bail.
      // This covers the case where React StrictMode or a re-render re-runs the effect
      // but the user hasn't changed — we must NOT disconnect and reconnect.
      if (socketRef.current && socketUserIdRef.current === userId) {
        if (!socket) setSocket(socketRef.current);
        return;
      }

      // Tear down any existing socket for a DIFFERENT user (e.g., user switched accounts)
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        socketRef.current = null;
        socketUserIdRef.current = null;
      }

      const socketio = io(API_URL, {
        query: { userId },
        transports: ["polling", "websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      socketRef.current = socketio;
      socketUserIdRef.current = userId;
      setSocket(socketio);

      socketio.on("connect", () => {
        console.log("Socket connected:", socketio.id);
      });

      socketio.on("reconnect", () => {
        console.log("Socket reconnected, re-registering userId");
        socketio.emit("registerUser", userId);
      });

      socketio.on("getOnlineUsers", (users) => {
        setOnlineUsers(users);
      });

      socketio.on("newNotification", (notification) => {
        setLikeNotification(notification);
        fetchUnreadNotifCount();
      });

      // Cleanup runs when userId changes or component unmounts.
      // We do NOT disconnect here — the socket should stay alive across re-renders.
      // We only disconnect when userId becomes null (logout) handled in the else branch below.
      return () => {
        // intentionally empty — socket lives in the ref
      };
    } else {
      // User logged out — destroy the socket
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        socketRef.current = null;
        socketUserIdRef.current = null;
      }
      setSocket(null);
      setOnlineUsers([]);
    }
  }, [user?._id]);

  const value = {
    // Auth
    user,
    setAuthUser,
    mergeAuthUser,
    suggestedUsers,
    setSuggestedUsers,
    userProfile,
    setUserProfile,
    selectedUser,
    setSelectedUser,

    // Post
    posts,
    setPosts,
    selectedPost,
    setSelectedPost,

    // Chat
    onlineUsers,
    setOnlineUsers,
    messages,
    setMessages,

    // Notification
    likeNotification,
    setLikeNotification,
    removeNotification,
    clearAllNotifications,
    unreadNotifCount,
    setUnreadNotifCount,
    fetchUnreadNotifCount,

    // Socket
    socket,
    setSocket,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
