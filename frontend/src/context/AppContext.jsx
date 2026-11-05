/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";

import { io } from "socket.io-client";
import api, { API_URL } from "@/lib/axios";
import { toast } from "sonner";

const AppContext = createContext(null);

const normalizeId = (x) =>
  typeof x === "string" ? x : String(x?._id ?? x?.toString?.() ?? x);

const normalizeUser = (u) => {
  if (!u) return u;
  const safe = { ...u };
  safe.bookmarks = (u.bookmarks || []).map(normalizeId);
  safe.following = (u.following || []).map(normalizeId);
  safe.followers = (u.followers || []).map(normalizeId);
  return safe;
};

export const AppProvider = ({ children }) => {
  // --- Auth State ---
  const [user, setUserState] = useState(() => {
    try {
      const saved = localStorage.getItem("vybe_user");
      return saved ? normalizeUser(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // --- Connected Users State (single cache for ChatPage, Post share dialog, Message forward dialog) ---
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [loadingConnectedUsers, setLoadingConnectedUsers] = useState(false);
  const connectedUsersFetchedRef = useRef(false);
  const pendingPromiseRef = useRef(null);

  const setAuthUser = useCallback((u) => {
    const normalized = normalizeUser(u);
    if (normalized) {
      try {
        localStorage.setItem("vybe_user", JSON.stringify(normalized));
      } catch (e) {
        console.error("Failed to save user to localStorage:", e);
      }
    } else {
      try {
        localStorage.removeItem("vybe_user");
      } catch (e) {
        console.error("Failed to remove user from localStorage:", e);
      }
    }
    connectedUsersFetchedRef.current = false;
    pendingPromiseRef.current = null;
    setConnectedUsers([]);
    userRef.current = normalized;
    setUserState(normalized);
  }, []);

  const mergeAuthUser = useCallback((data) => {
    const prev = userRef.current;
    const updated = normalizeUser({ ...(prev || {}), ...(data || {}) });
    if (updated) {
      try {
        localStorage.setItem("vybe_user", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save user to localStorage:", e);
      }
    }
    if (data?.following || data?.followers) {
      connectedUsersFetchedRef.current = false;
      pendingPromiseRef.current = null;
    }
    userRef.current = updated;
    setUserState(updated);
  }, []);

  // Validate & sync login session with backend /me endpoint
  const syncAuth = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/user/me');
      if (res.data?.success && res.data.user) {
        setAuthUser(res.data.user);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setAuthUser(null);
      }
    }
  }, [setAuthUser]);

  useEffect(() => {
    syncAuth();
  }, [syncAuth]);

  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchSuggestedUsers = useCallback(async (force = false) => {
    if (!user?._id) return;
    try {
      const url = force ? '/api/v1/user/suggested?refresh=true' : '/api/v1/user/suggested';
      const res = await api.get(url);
      if (res.data?.success && Array.isArray(res.data.users)) {
        setSuggestedUsers(res.data.users);
      }
    } catch (err) {
      console.error("fetchSuggestedUsers error:", err);
    }
  }, [user?._id]);

  useEffect(() => {
    if (user?._id) {
      fetchSuggestedUsers();
    } else {
      setSuggestedUsers([]);
    }
  }, [user?._id, fetchSuggestedUsers]);

  // --- Post State ---
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);

  // --- Chat State ---
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const fetchUnreadChatCount = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await api.get('/api/v1/message/unread-count');
      if (res.data?.success && typeof res.data.count === "number") {
        setUnreadChatCount(res.data.count);
      }
    } catch (err) {
      console.error("fetchUnreadChatCount error:", err);
    }
  }, [user?._id]);

  useEffect(() => {
    if (user?._id) {
      fetchUnreadChatCount();
    } else {
      setUnreadChatCount(0);
    }
  }, [user?._id, fetchUnreadChatCount]);

  const markChatAsRead = useCallback(async (partnerId) => {
    if (!partnerId || !user?._id) return;
    try {
      await api.post(`/api/v1/message/${partnerId}/read`);
      await fetchUnreadChatCount();
    } catch (err) {
      console.error("markChatAsRead error:", err);
    }
  }, [user?._id, fetchUnreadChatCount]);

  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const fetchConnectedUsers = useCallback(async (force = false) => {
    if (!user?._id) {
      setConnectedUsers([]);
      connectedUsersFetchedRef.current = false;
      pendingPromiseRef.current = null;
      return [];
    }
    // Return cached list if available and not forced
    if (!force && connectedUsersFetchedRef.current) {
      return connectedUsers;
    }
    // Reuse pending in-flight promise if multiple components trigger fetch simultaneously
    if (!force && pendingPromiseRef.current) {
      return pendingPromiseRef.current;
    }

    setLoadingConnectedUsers(true);

    const promise = (async () => {
      try {
        const [fRes, gRes] = await Promise.all([
          api.get(`/api/v1/user/${user._id}/followers`),
          api.get(`/api/v1/user/${user._id}/following`),
        ]);
        const followers = Array.isArray(fRes.data?.users) ? fRes.data.users : [];
        const following = Array.isArray(gRes.data?.users) ? gRes.data.users : [];

        const map = new Map();
        const myId = String(user._id);
        [...followers, ...following].forEach((u) => {
          if (u?._id && String(u._id) !== myId && !map.has(String(u._id))) {
            map.set(String(u._id), u);
          }
        });

        const list = Array.from(map.values()).sort((a, b) =>
          (a.username || "").localeCompare(b.username || "")
        );
        setConnectedUsers(list);
        connectedUsersFetchedRef.current = true;
        return list;
      } catch (err) {
        console.error("fetchConnectedUsers error:", err);
        return [];
      } finally {
        setLoadingConnectedUsers(false);
        pendingPromiseRef.current = null;
      }
    })();

    pendingPromiseRef.current = promise;
    return promise;
  }, [user?._id, connectedUsers]);

  const invalidateConnectedUsers = useCallback(() => {
    connectedUsersFetchedRef.current = false;
    pendingPromiseRef.current = null;
  }, []);

  // --- Real-time Notification State ---
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const fetchUnreadNotifCount = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await api.get('/api/v1/notification/unread-count');
      if (res.data?.success && typeof res.data.count === "number") {
        setUnreadNotifCount(res.data.count);
      }
    } catch (err) {
      console.error("fetchUnreadNotifCount error:", err);
    }
  }, [user?._id]);

  useEffect(() => {
    if (user?._id) {
      fetchUnreadNotifCount();
    } else {
      setUnreadNotifCount(0);
    }
  }, [user?._id, fetchUnreadNotifCount]);

  // --- Socket State & Centralized Lifecycle ---
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const socketUserIdRef = useRef(null);

  useEffect(() => {
    const userId = user?._id ? String(user._id) : null;

    if (!userId) {
      // Logged out — tear down socket completely
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
        socketRef.current = null;
        socketUserIdRef.current = null;
      }
      setSocket(null);
      setOnlineUsers([]);
      return;
    }

    // Create a new socket only when needed (first time or different user)
    if (!socketRef.current || socketUserIdRef.current !== userId) {
      if (socketRef.current) {
        socketRef.current.off();
        socketRef.current.disconnect();
      }

      const socketio = io(API_URL, {
        query: { userId },
        transports: ["polling", "websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,   // keep retrying forever
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      socketRef.current = socketio;
      socketUserIdRef.current = userId;
      setSocket(socketio);
    }

    // successful reconnection —  re-register the userId.
    const socketio = socketRef.current;

    const onConnect = () => {
      console.log("Socket connected:", socketio.id);
    };

    const onGetOnlineUsers = (users) => {
      setOnlineUsers(Array.isArray(users) ? users.map(String) : []);
    };

    const onUserOnline = (onlineUserId) => {
      if (!onlineUserId) return;
      const idStr = String(onlineUserId);
      setOnlineUsers((prev) => {
        const list = Array.isArray(prev) ? prev.map(String) : [];
        return list.includes(idStr) ? list : [...list, idStr];
      });
    };

    const onUserOffline = (offlineUserId) => {
      if (!offlineUserId) return;
      const idStr = String(offlineUserId);
      setOnlineUsers((prev) => {
        const list = Array.isArray(prev) ? prev.map(String) : [];
        return list.filter((id) => id !== idStr);
      });
    };

    const onNewNotification = (notification) => {
      fetchUnreadNotifCount();
      if (notification?.type === "follow") {
        syncAuth();
        fetchConnectedUsers(true);
      }
    };

    const onPostLikeRemoved = () => {
      fetchUnreadNotifCount();
    };

    const onNewMessage = (newMessage) => {
      if (!newMessage) return;
      const myId = String(userId);
      const senderId = newMessage.senderId?._id ? String(newMessage.senderId._id) : String(newMessage.senderId);
      if (senderId !== myId) {
        const activeChatUserId = selectedUserRef.current?._id ? String(selectedUserRef.current._id) : null;
        const isTabVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
        if (senderId !== activeChatUserId || !isTabVisible) {
          setUnreadChatCount((prev) => prev + 1);
          const name = newMessage.senderUsername || "Someone";
          const snippet = newMessage.message ? (newMessage.message.length > 35 ? newMessage.message.slice(0, 35) + "..." : newMessage.message) : "sent you a message";
          toast.info(`Message from ${name}: "${snippet}"`);
        }
      }
    };

    const onConnectError = (err) => {
      console.warn("Socket connect error:", err.message);
    };

    socketio.on("connect", onConnect);
    socketio.on("connect_error", onConnectError);
    socketio.on("getOnlineUsers", onGetOnlineUsers);
    socketio.on("userOnline", onUserOnline);
    socketio.on("userOffline", onUserOffline);
    socketio.on("newNotification", onNewNotification);
    socketio.on("postLikeRemoved", onPostLikeRemoved);
    socketio.on("newMessage", onNewMessage);

    return () => {
      // Remove only the handlers added in this effect run — never disconnect the socket
      socketio.off("connect", onConnect);
      socketio.off("connect_error", onConnectError);
      socketio.off("getOnlineUsers", onGetOnlineUsers);
      socketio.off("userOnline", onUserOnline);
      socketio.off("userOffline", onUserOffline);
      socketio.off("newNotification", onNewNotification);
      socketio.off("postLikeRemoved", onPostLikeRemoved);
      socketio.off("newMessage", onNewMessage);
    };
  }, [user?._id, fetchUnreadNotifCount, syncAuth, fetchConnectedUsers]);

  const value = useMemo(() => ({
    // Auth
    user,
    setAuthUser,
    mergeAuthUser,
    suggestedUsers,
    setSuggestedUsers,
    fetchSuggestedUsers,
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
    unreadChatCount,
    setUnreadChatCount,
    fetchUnreadChatCount,
    markChatAsRead,

    // Notification
    unreadNotifCount,
    setUnreadNotifCount,
    fetchUnreadNotifCount,

    // Connections
    connectedUsers,
    loadingConnectedUsers,
    fetchConnectedUsers,
    invalidateConnectedUsers,

    // Socket
    socket,
    setSocket,
  }), [
    user,
    setAuthUser,
    mergeAuthUser,
    suggestedUsers,
    userProfile,
    selectedUser,
    posts,
    selectedPost,
    onlineUsers,
    messages,
    unreadNotifCount,
    unreadChatCount,
    fetchUnreadChatCount,
    fetchSuggestedUsers,
    markChatAsRead,
    fetchUnreadNotifCount,
    connectedUsers,
    loadingConnectedUsers,
    fetchConnectedUsers,
    invalidateConnectedUsers,
    socket,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
