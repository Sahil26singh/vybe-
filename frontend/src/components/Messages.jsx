import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { setMessages } from "@/redux/chatSlice";
import useGetAllMessage from "@/hooks/useGetAllMessage";
import useGetRTM from "@/hooks/useGetRTM";
import useGetSuggestedUsers from "@/hooks/useGetSuggestedUsers"; // populate suggestions
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

const API_BASE ="http://localhost:8000";
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
      <div className="p-3 flex items-center gap-2">
        <Avatar className="w-8 h-8">
          <AvatarImage src={pfp || undefined} />
          <AvatarFallback>{(username || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="text-sm">
          <div className="font-semibold">{username}</div>
        </div>
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

/* ---------- Lightweight modal components---------- */
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
  useGetSuggestedUsers(); // fills suggestions in store

  const dispatch = useDispatch();
  const { messages, onlineUsers } = useSelector((s) => s.chat);
  const { user, suggestedUsers } = useSelector((s) => s.auth);
  const containerRef = useRef(null);

  // which message we clicked
  const [activeMsg, setActiveMsg] = useState(null);

  // popups
  const [showAction, setShowAction] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showForward, setShowForward] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // form state
  const [editText, setEditText] = useState("");
  const [forwardFilter, setForwardFilter] = useState("");

  const isMine = (m) => idStr(m?.senderId) === idStr(user?._id);

  // build share candidates = followers/following intersection from suggestedUsers
  const shareCandidates = useMemo(() => {
    const me = idStr(user?._id);
    const following = (user?.following || []).map(idStr);
    const followers = (user?.followers || []).map(idStr);
    const isConnected = (uid) => following.includes(idStr(uid)) || followers.includes(idStr(uid));
    const list = (suggestedUsers || []).filter(
      (u) => u?._id && idStr(u._id) !== me && isConnected(u._id)
    );
    return list.sort((a, b) => (safe(a.username).toLowerCase()).localeCompare(safe(b.username).toLowerCase()));
  }, [suggestedUsers, user]);

  const filteredCandidates = useMemo(() => {
    const q = forwardFilter.trim().toLowerCase();
    if (!q) return shareCandidates;
    return shareCandidates.filter((u) => safe(u.username).toLowerCase().includes(q));
  }, [shareCandidates, forwardFilter]);

  // Close action popup if clicking outside messages area
  useEffect(() => {
    const onDocClick = (e) => {
      if (!containerRef.current?.contains(e.target)) setShowAction(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Helpers for shared message detection
  const parseActivePayload = () => tryParse(activeMsg?.message);
  const activeIsShared = () => parseActivePayload()?.type === "post-share";
  const activeSharedCaption = () => safe(parseActivePayload()?.post?.caption, "");

  const doEdit = async () => {
    const m = activeMsg;
    if (!m) return;

    // If shared post, only edit the caption inside payload
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
      // optimistic UI
      const optimistic = messages.map((x) =>
        x._id === m._id ? { ...x, message: nextTextRaw } : x
      );
      dispatch(setMessages(optimistic));

      const res = await axios.put(
        `${MESSAGE_API}/${m._id}`,
        { text: nextTextRaw },
        { withCredentials: true }
      );

      if (res.data?.success && res.data.message) {
        const synced = messages.map((x) => (x._id === m._id ? res.data.message : x));
        dispatch(setMessages(synced));
      }
      closeAll();
    } catch (e) {
      console.error(e);
      // rollback by refetch in a real app; here just close
      closeAll();
    }
  };

  const doDelete = async () => {
    const m = activeMsg;
    if (!m) return;
    try {
      // optimistic remove
      dispatch(setMessages(messages.filter((x) => x._id !== m._id)));
      await axios.delete(`${MESSAGE_API}/${m._id}`, { withCredentials: true });
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
      await axios.post(
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

  // ---------- UI ----------
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
          // Prefill edit text appropriately
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
          <div className="max-w-2xl w-full">{messages.map((m) => renderBubble(m))}</div>
        </div>
      </div>

      {/* ---------- Action Popup ---------- */}
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

      {/* ---------- Edit Popup (caption for shared / text otherwise) ---------- */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)}>
        <ModalHeader
          title={activeIsShared() ? "Edit shared caption" : "Edit message"}
          onClose={() => setShowEdit(false)}
        />
        <div className="px-4 py-3">
          <textarea
            className="w-full border rounded-md p-2 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder={activeIsShared() ? "Update caption" : "Update your message"}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowEdit(false)}>
            Cancel
          </Button>
          <Button onClick={doEdit}>Save</Button>
        </ModalFooter>
      </Modal>

      {/* ---------- Forward Popup (followers/following suggestions) ---------- */}
      <Modal open={showForward} onClose={() => setShowForward(false)} widthClass="w-full max-w-md">
        <ModalHeader title="Forward message" onClose={() => setShowForward(false)} />
        <div className="px-4 py-3 flex flex-col gap-3">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Search follower/following…"
            value={forwardFilter}
            onChange={(e) => setForwardFilter(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto">
            {filteredCandidates.length === 0 ? (
              <p className="text-sm text-gray-500">No matches.</p>
            ) : (
              filteredCandidates.map((u) => {
                const online = (onlineUsers || []).includes(u._id);
                return (
                  <div key={u._id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.profilePicture} />
                        <AvatarFallback>
                          {(safe(u.username, "X")).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{safe(u.username)}</span>
                        <span
                          className={`text-[11px] font-semibold ${
                            online ? "text-green-600" : "text-gray-400"
                          }`}
                        >
                          {online ? "online" : "offline"}
                        </span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => shareToUser(u)}>
                      Send
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowForward(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {/* ---------- Delete Confirm Popup ---------- */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)}>
        <ModalHeader
          title={activeIsShared() ? "Delete this post" : "Delete message"}
          onClose={() => setShowDelete(false)}
        />
        <div className="px-4 py-3">
          <p className="text-sm text-gray-700">
            {activeIsShared()
              ? "Are you sure you want to delete this shared post message?"
              : "Are you sure you want to delete this message?"}
          </p>
          <div className="mt-2 text-xs text-gray-500 break-words">
            “
            {activeIsShared()
              ? (() => {
                  const cap = activeSharedCaption();
                  return cap.length > 160 ? cap.slice(0, 160) + "…" : cap;
                })()
              : (() => {
                  const txt = safe(activeMsg?.message, "");
                  return txt.length > 160 ? txt.slice(0, 160) + "…" : txt;
                })()}
            ”
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={doDelete}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default Messages;
