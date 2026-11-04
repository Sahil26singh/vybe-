import { useApp } from "@/context/AppContext";
import api from "@/lib/axios";
import { useEffect } from "react";

const useGetRTM = () => {
  const { socket, setMessages, selectedUser, user, fetchUnreadChatCount } = useApp();

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      if (!newMessage?._id) return;
      const myId = String(user?._id || "");
      const senderId = newMessage.senderId?._id ? String(newMessage.senderId._id) : String(newMessage.senderId);
      const receiverId = newMessage.receiverId?._id ? String(newMessage.receiverId._id) : String(newMessage.receiverId);
      const otherId = senderId === myId ? receiverId : senderId;
      if (otherId !== String(selectedUser?._id)) return;

      setMessages((prev) => {
        // Deduplicate: skip if a message with this _id already exists
        if ((prev || []).some((m) => m._id === newMessage._id)) return prev;
        return [...(prev || []), newMessage];
      });

      // If message is from the partner while chat is open, only mark read if the tab is visible
      if (senderId !== myId) {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          api.post(`/api/v1/message/${senderId}/read`).catch((err) => {
            console.error("Failed to mark incoming message as read:", err);
          });
        }
      }
    };

    const handleMessageEdited = (editedMsg) => {
      if (!editedMsg?._id) return;
      setMessages((prev) =>
        (prev || []).map((m) => (m?._id === editedMsg._id ? editedMsg : m))
      );
    };

    const handleMessageDeleted = (payload) => {
      const msgId = payload?.messageId ?? payload;
      if (!msgId) return;
      setMessages((prev) => (prev || []).filter((m) => m?._id !== msgId));
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messageEdited", handleMessageEdited);
    socket.on("messageDeleted", handleMessageDeleted);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("messageDeleted", handleMessageDeleted);
    };
  }, [socket, setMessages, selectedUser?._id, user?._id]);

  // Mark open chat messages as read when switching back to a visible tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && selectedUser?._id) {
        api.post(`/api/v1/message/${selectedUser._id}/read`).then(() => {
          if (typeof fetchUnreadChatCount === "function") {
            fetchUnreadChatCount();
          }
        }).catch((err) => {
          console.error("Failed to mark chat as read on tab visible:", err);
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedUser?._id, fetchUnreadChatCount]);
};

export default useGetRTM;
