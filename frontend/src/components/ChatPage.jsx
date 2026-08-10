import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MessageCircleCode } from "lucide-react";
import Messages from "./Messages";
import api, { API_URL } from "@/lib/axios";
import { useParams, useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const ChatPage = () => {
  const [textMessage, setTextMessage] = useState("");
  const { user, selectedUser, setSelectedUser, onlineUsers, messages, setMessages } = useApp();
  const navigate = useNavigate();
  const { id: routeUserId } = useParams() || {};

  const [connectedUsers, setConnectedUsers] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Fetch all connected users (followers + following)
  useEffect(() => {
    const fetchConnections = async () => {
      if (!user?._id) return;
      setLoadingConnections(true);
      try {
        const [fRes, gRes] = await Promise.all([
          api.get(`/api/v1/user/${user._id}/followers`, { withCredentials: true }),
          api.get(`/api/v1/user/${user._id}/following`, { withCredentials: true }),
        ]);

        const followers = Array.isArray(fRes.data?.users) ? fRes.data.users : [];
        const following = Array.isArray(gRes.data?.users) ? gRes.data.users : [];

        const map = new Map();
        [...followers, ...following].forEach((u) => {
          if (u?._id && String(u._id) !== String(user._id)) {
            map.set(String(u._id), u);
          }
        });

        setConnectedUsers(Array.from(map.values()));
      } catch (err) {
        console.error("Failed to fetch connections for chat:", err);
      } finally {
        setLoadingConnections(false);
      }
    };

    fetchConnections();
  }, [user?._id]);

  // Send message
  const sendMessageHandler = async (receiverId) => {
    if (!textMessage.trim()) return;
    try {
      const res = await api.post(
        `${API_URL}/api/v1/message/send/${receiverId}`,
        { textMessage },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );
      if (res.data.success) {
        setMessages([...(messages || []), res.data.newMessage]);
        setTextMessage("");
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (!routeUserId) {
      if (selectedUser) setSelectedUser(null);
      if ((messages || []).length) setMessages([]);
      return;
    }

    const wantId = String(routeUserId);
    const currId = selectedUser?._id ? String(selectedUser._id) : null;

    if (currId === wantId) return;

    if ((messages || []).length) setMessages([]);

    const found = connectedUsers.find((u) => String(u?._id) === wantId);
    if (found) {
      setSelectedUser(found);
      return;
    }

    setSelectedUser({ _id: wantId });

    api
      .get(`${API_URL}/api/v1/user/${wantId}/profile`, {
        withCredentials: true,
      })
      .then((res) => {
        const p = res?.data?.user;
        if (!p) throw new Error("not-found");
        setSelectedUser({
          _id: wantId,
          username: p.username,
          profilePicture: p.profilePicture,
        });
      })
      .catch(() => {
        setSelectedUser(null);
        setMessages([]);
        navigate("/chat", { replace: true });
      });
  }, [routeUserId, connectedUsers, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setSelectedUser(null);
      setMessages([]);
    };
  }, []);

  return (
    <div className="flex ml-[10%] h-screen">
      {/* LEFT: People list */}
      <section className="w-full md:w-2/6 my-8">
        <h1 className="font-semibold flex mb-4 px-3 text-xl">
          <Avatar className="w-14 h-14">
            <AvatarImage src={user?.profilePicture} />
            <AvatarFallback>
              {(user?.username || "X").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="mt-2 ml-6">{user?.username}</span>
        </h1>
        <hr className="mb-4 border-gray-300" />

        {loadingConnections ? (
          <p className="text-center text-gray-500 py-4">Loading connections...</p>
        ) : connectedUsers.length === 0 ? (
          <p className="text-center text-gray-500 py-4">
            No connected users yet.
          </p>
        ) : (
          <div className="overflow-y-auto h-[80vh]">
            {connectedUsers.map((u) => {
              const onlineSet = new Set((onlineUsers || []).map(String));
              const isOnline = u?._id && onlineSet.has(String(u._id));
              const isActive =
                String(selectedUser?._id || "") === String(u?._id || "");
              return (
                <div
                  key={u?._id}
                  onClick={() => {
                    if (u?._id) navigate(`/chat/${u._id}`);
                    setSelectedUser(u);
                  }}
                  className={`flex gap-3 items-center p-3 hover:bg-gray-50 cursor-pointer ${
                    isActive ? "bg-gray-100" : ""
                  }`}
                >
                  <div className="relative">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={u?.profilePicture} />
                      <AvatarFallback>
                        {(u?.username || "X").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{u?.username}</span>
                    <span
                      className={`text-xs font-bold ${
                        isOnline ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isOnline ? "online" : "offline"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* RIGHT: Thread */}
      {selectedUser ? (
        <section className="flex-1 border-l border-l-gray-300 flex flex-col h-full">
          <div className="flex gap-3 items-center px-3 py-2 border-b border-gray-300 sticky top-0 bg-white z-10">
            <Avatar>
              <AvatarImage src={selectedUser?.profilePicture} alt="profile" />
              <AvatarFallback>
                {(selectedUser?.username || "X").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col font-semibold">
              <span>{selectedUser?.username || "..."}</span>
            </div>
            <Button className="m" size="sm" variant="secondary" onClick={() => navigate(`/profile/${selectedUser?._id}`)}>
              View profile
            </Button>
          </div>

          <Messages selectedUser={selectedUser} />

          <div className="flex items-center p-4 border-t border-t-gray-300">
            <Input
              value={textMessage}
              onChange={(e) => setTextMessage(e.target.value)}
              type="text"
              className="flex-1 mr-2 focus-visible:ring-transparent"
              placeholder="Messages..."
            />
            <Button
              onClick={() =>
                selectedUser?._id && sendMessageHandler(selectedUser._id)
              }
            >
              Send
            </Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center mx-auto">
          <MessageCircleCode className="w-32 h-32 my-4" />
          <h1 className="font-medium">Your messages</h1>
          <span>Send a message to start a chat.</span>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
