import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { setSelectedUser } from "@/redux/authSlice";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { MessageCircleCode } from "lucide-react";
import Messages from "./Messages";
import axios from "axios";
import { setMessages } from "@/redux/chatSlice";
import { useParams, useNavigate } from "react-router-dom";

const ChatPage = () => {
  const [textMessage, setTextMessage] = useState("");
  const { user, suggestedUsers, selectedUser } = useSelector(
    (store) => store.auth
  );
  const { onlineUsers, messages } = useSelector((store) => store.chat);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id: routeUserId } = useParams() || {};

  // Send message
  const sendMessageHandler = async (receiverId) => {
    try {
      const res = await axios.post(
        `http://localhost:8000/api/v1/message/send/${receiverId}`,
        { textMessage },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );
      if (res.data.success) {
        dispatch(setMessages([...(messages || []), res.data.newMessage]));
        setTextMessage("");
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (!routeUserId) {
      if (selectedUser) dispatch(setSelectedUser(null));
      if ((messages || []).length) dispatch(setMessages([]));
      return;
    }

    const wantId = String(routeUserId);
    const currId = selectedUser?._id ? String(selectedUser._id) : null;

    if (currId === wantId) return; // already showing correct chat

    // Clear current messages immediately to avoid flashing last conversation
    if ((messages || []).length) dispatch(setMessages([]));

    // Try local list first (fast header)
    const found = (suggestedUsers || []).find((u) => String(u?._id) === wantId);
    if (found) {
      dispatch(setSelectedUser(found));
      return;
    }

    // Set minimal shape so Messages hook can fetch
    dispatch(setSelectedUser({ _id: wantId }));

    // Hydrate header details
    axios
      .get(`http://localhost:8000/api/v1/user/profile/${wantId}`, {
        withCredentials: true,
      })
      .then((res) => {
        const p = res?.data?.user;
        if (!p) throw new Error("not-found");
        dispatch(
          setSelectedUser({
            _id: wantId,
            username: p.username,
            profilePicture: p.profilePicture,
          })
        );
      })
      .catch(() => {
        // invalid user id -> reset to empty chat page
        dispatch(setSelectedUser(null));
        dispatch(setMessages([]));
        navigate("/chat", { replace: true });
      });
  }, [routeUserId, suggestedUsers, dispatch, navigate]); 

  // Cleanup on unmount 
  useEffect(() => {
    return () => {
      dispatch(setSelectedUser(null));
      dispatch(setMessages([]));
    };
  }, [dispatch]);

  return (
    <div className="flex ml-[10%] h-screen">
      {/* LEFT: People list */}
      <section className="w-full md:w-2/6 my-8">
        <h1 className="font-semibold flex mb-4 px-3 text-xl"><Avatar className="w-14 h-14">
                      <AvatarImage src={user?.profilePicture} />
                      <AvatarFallback>
                        {(user?.username || "X").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar><span className="mt-2 ml-6">{user.username}</span></h1>
        <hr className="mb-4 border-gray-300" />

        {/* Only followers or following */}
        {(() => {
          const visibleUsers = (suggestedUsers || []).filter((u) => {
            const myId = user?._id;
            if (!myId || !u?._id) return false;
            const isFollowing = (user?.following || [])
              .map(String)
              .includes(String(u._id));
            const isFollower = (user?.followers || [])
              .map(String)
              .includes(String(u._id));
            return (
              (isFollowing || isFollower) && String(u._id) !== String(myId)
            );
          });

          if (visibleUsers.length === 0)
            return (
              <p className="text-center text-gray-500 py-4">
                No connected users yet.
              </p>
            );

          return (
            <div className="overflow-y-auto h-[80vh]">
              {visibleUsers.map((u) => {
                const isOnline = (onlineUsers || []).includes(u?._id);
                const isActive =
                  String(selectedUser?._id || "") === String(u?._id || "");
                return (
                  <div
                    key={u?._id}
                    onClick={() => {
                      if (u?._id) navigate(`/chat/${u._id}`);
                      dispatch(setSelectedUser(u));
                    }}
                    className={`flex gap-3 items-center p-3 hover:bg-gray-50 cursor-pointer ${
                      isActive ? "bg-gray-100" : ""
                    }`}
                  >
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={u?.profilePicture} />
                      <AvatarFallback>
                        {(u?.username || "X").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
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
          );
        })()}
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
