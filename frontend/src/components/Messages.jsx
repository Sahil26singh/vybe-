import React, { useEffect, useMemo, useRef, useState } from "react";
import api, { API_URL } from "@/lib/axios";
import { useApp } from "@/context/AppContext";
import useGetAllMessage from "@/hooks/useGetAllMessage";
import useGetRTM from "@/hooks/useGetRTM";
import useGetSuggestedUsers from "@/hooks/useGetSuggestedUsers";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

const API_BASE = API_URL;
const MESSAGE_API = `${API_BASE}/api/v1/message`;

const idStr = (v) => (v == null ? "" : String(v));
const safe = (v, fallback = "") => (v == null ? fallback : v);

function tryParse(jsonLike) {
  if (typeof jsonLike !== "string") return null;
  try {
    return JSON.parse(jsonLike);
  } catch {
    return null;
  }
}

function SharedPostCard({ data }) {
  const navigate = useNavigate();
  const post = data?.post || {};
  const author = post?.author || data?.author || null;

  const img = post?.image;
  const caption = safe(post?.caption, "");
  const username = safe(author?.username || data?.authorName || post?.authorName, "Unknown");
  const authorId = author?._id || data?.authorId || null;
  const pfp = author?.profilePicture || data?.profilePicture || null;

  return (
    <div className="border rounded-lg overflow-hidden max-w-xs bg-white shadow-sm">
      {img && <img src={img} alt="shared-post" className="w-full aspect-square object-cover" />}
      <div className="p-3 flex items-center gap-2 border-t">
        <Avatar className="w-8 h-8">
          <AvatarImage src={pfp} />
          <AvatarFallback>{(username || "X").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-semibold text-sm">{username}</span>
        {authorId && (
          <div className="ml-auto">
            <Button size="sm" variant="secondary" onClick={() => navigate(`/profile/${authorId}`)}>
              View Profile
            </Button>
          </div>
        )}
      </div>
      {caption ? (
        <div className="p-1 pl-4 pb-2 text-sm">
          <span>caption: </span>
          <span className="ml-1 text-gray-700 font-semibold">{caption}</span>
        </div>
      ) : null}
    </div>
  );
}

function Modal({ open, onClose, children, widthClass = "w-full max-w-sm" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className={`relative bg-white rounded-xl shadow-xl ${widthClass} mx-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="font-semibold">{title}</div>
      <button
        onClick={onClose}
        className="h-8 w-8 rounded-md hover:bg-gray-100 flex items-center justify-center"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

function ModalFooter({ children }) {
  return <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">{children}</div>;
}

const Messages = () => {
  useGetRTM();
  useGetAllMessage();
  useGetSuggestedUsers();

  const { messages, setMessages, user, suggestedUsers } = useApp();
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto-scroll to the bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [activeMsg, setActiveMsg] = useState(null);

  const [showAction, setShowAction] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [editText, setEditText] = useState("");
  const [forwardFilter, setForwardFilter] = useState("");

  const isMine = (m) => idStr(m?.senderId) === idStr(user?._id);

  const [connections, setConnections] = useState([]);

  useEffect(() => {
    if (!showForward || !user?._id) return;
    const fetchConnections = async () => {
      try {
        const [followersRes, followingRes] = await Promise.all([
          api.get(`${API_URL}/api/v1/user/${user._id}/followers`, { withCredentials: true }),
          api.get(`${API_URL}/api/v1/user/${user._id}/following`, { withCredentials: true }),
        ]);

        const followersList = followersRes.data?.success ? followersRes.data.users : [];
        const followingList = followingRes.data?.success ? followingRes.data.users : [];

        const pool = [];
        const seen = new Set();
        const me = idStr(user._id);

        const add = (u) => {
          if (!u || !u._id) return;
          const uid = idStr(u._id);
          if (uid === me || seen.has(uid)) return;
          seen.add(uid);
          pool.push(u);
        };

        followersList.forEach(add);
        followingList.forEach(add);

        setConnections(pool.sort((a, b) => (safe(a.username).toLowerCase()).localeCompare(safe(b.username).toLowerCase())));
      } catch (err) {
        console.error(err);
      }
    };
    fetchConnections();
  }, [showForward, user?._id]);

  const filteredCandidates = useMemo(() => {
    const q = forwardFilter.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((u) => safe(u.username).toLowerCase().includes(q));
  }, [connections, forwardFilter]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!containerRef.current?.contains(e.target)) setShowAction(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const parseActivePayload = () => tryParse(activeMsg?.message);
  const activeIsShared = () => parseActivePayload()?.type === "post-share";

  const doEdit = async () => {
    const m = activeMsg;
    if (!m) return;

    let nextTextRaw = editText.trim();
    if (activeIsShared()) {
      const payload = parseActivePayload() || {};
      const nextPayload = {
        ...payload,
        post: { ...(payload.post || {}), caption: nextTextRaw },
      };
      nextTextRaw = JSON.stringify(nextPayload);
    } else {
      if (!nextTextRaw || nextTextRaw === m.message) return;
    }

    try {
      // Optimistic update using functional form to avoid stale closure
      setMessages((prev) =>
        prev.map((x) => (x._id === m._id ? { ...x, message: nextTextRaw } : x))
      );

      const res = await api.put(
        `${MESSAGE_API}/${m._id}`,
        { text: nextTextRaw },
        { withCredentials: true }
      );

      if (res.data?.success && res.data.message) {
        setMessages((prev) =>
          prev.map((x) => (x._id === m._id ? res.data.message : x))
        );
      }
      closeAll();
    } catch (e) {
      console.error(e);
      closeAll();
    }
  };

  const doDelete = async () => {
    const m = activeMsg;
    if (!m) return;
    try {
      setMessages(messages.filter((x) => x._id !== m._id));
      await api.delete(`${MESSAGE_API}/${m._id}`, { withCredentials: true });
      closeAll();
    } catch (e) {
      console.error(e);
      closeAll();
    }
  };

  const shareToUser = async (u) => {
    const m = activeMsg;
    if (!m?._id || !u?._id) return;
    try {
      await api.post(
        `${MESSAGE_API}/forward/${m._id}`,
        { toUserId: u._id },
        { withCredentials: true }
      );
      setShowForward(false);
      setShowAction(false);
      setActiveMsg(null);
    } catch (e) {
      console.error(e);
    }
  };

  const closeAll = () => {
    setShowAction(false);
    setShowEdit(false);
    setShowForward(false);
    setShowDelete(false);
    setActiveMsg(null);
    setEditText("");
    setForwardFilter("");
  };

  const renderBubble = (msg) => {
    const mine = isMine(msg);
    const payload = tryParse(msg?.message);
    const isShare = payload?.type === "post-share";

    const bubble = isShare ? (
      <SharedPostCard data={payload} />
    ) : (
      <div
        className={`p-2 rounded-lg max-w-[80%] break-words ${
          mine ? "bg-blue-500 text-white" : "bg-gray-200 text-black"
        }`}
      >
        {safe(msg?.message, "")}
        {msg?.createdAt && (
          <div className="mt-1 text-[10px] opacity-70">
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
    );

    return (
      <div
        key={msg._id}
        className={`relative flex my-2 ${mine ? "justify-end" : "justify-start"}`}
        onClick={(e) => {
          e.stopPropagation();
          setActiveMsg(msg);
          const p = tryParse(msg?.message);
          if (p?.type === "post-share") setEditText(safe(p?.post?.caption, ""));
          else setEditText(safe(msg?.message, ""));
          setShowAction(true);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setActiveMsg(msg);
          const p = tryParse(msg?.message);
          if (p?.type === "post-share") setEditText(safe(p?.post?.caption, ""));
          else setEditText(safe(msg?.message, ""));
          setShowAction(true);
        }}
      >
        {bubble}
      </div>
    );
  };

  return (
    <>
      <div className="overflow-y-auto flex-1 p-4" ref={containerRef}>
        <div className="flex justify-center">
          <div className="max-w-2xl w-full">
            {messages.map((m) => renderBubble(m))}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      <Modal open={!!showAction && !!activeMsg} onClose={() => setShowAction(false)}>
        <ModalHeader title="Message actions" onClose={() => setShowAction(false)} />
        <div className="px-4 py-2">
          <div className="flex flex-col divide-y">
            {isMine(activeMsg) && (
              <button
                className="py-3 text-left hover:bg-gray-50"
                onClick={() => {
                  setShowAction(false);
                  setShowEdit(true);
                }}
              >
                ✏️ Edit{activeIsShared() ? " caption" : ""}
              </button>
            )}
            <button
              className="py-3 text-left hover:bg-gray-50"
              onClick={() => {
                setShowAction(false);
                setShowForward(true);
              }}
            >
              📤 Forward
            </button>
            {isMine(activeMsg) && (
              <button
                className="py-3 text-left text-red-600 hover:bg-gray-50"
                onClick={() => {
                  setShowAction(false);
                  setShowDelete(true);
                }}
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowAction(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)}>
        <ModalHeader title={activeIsShared() ? "Edit shared post caption" : "Edit message"} onClose={() => setShowEdit(false)} />
        <div className="p-4">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-24 p-2 border rounded-md outline-none text-sm focus:border-blue-500"
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowEdit(false)}>
            Cancel
          </Button>
          <Button onClick={doEdit}>Save</Button>
        </ModalFooter>
      </Modal>

      <Modal open={showForward} onClose={() => setShowForward(false)} widthClass="w-full max-w-md">
        <ModalHeader title="Forward message to..." onClose={() => setShowForward(false)} />
        <div className="p-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Search connections..."
            value={forwardFilter}
            onChange={(e) => setForwardFilter(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-blue-500"
          />
          <div className="max-h-60 overflow-y-auto divide-y border rounded-md">
            {filteredCandidates.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">No matching connections</div>
            ) : (
              filteredCandidates.map((u) => (
                <div key={u._id} className="flex items-center justify-between p-2 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={u.profilePicture} />
                      <AvatarFallback>{(u.username || "X").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{u.username}</span>
                  </div>
                  <Button size="sm" onClick={() => shareToUser(u)}>
                    Send
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowForward(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={showDelete} onClose={() => setShowDelete(false)}>
        <ModalHeader title="Delete message" onClose={() => setShowDelete(false)} />
        <div className="p-4 text-sm text-gray-600">Are you sure you want to delete this message?</div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={doDelete}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default Messages;
