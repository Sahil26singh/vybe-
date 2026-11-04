import { useApp } from "@/context/AppContext";
import { useEffect } from "react";

const useGetRTM = () => {
  const { socket, setMessages, selectedUser, user } = useApp();

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
};

export default useGetRTM;
