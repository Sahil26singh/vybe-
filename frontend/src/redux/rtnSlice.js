import { createSlice } from "@reduxjs/toolkit";

const rtnSlice = createSlice({
  name: "rtn",
  initialState: {
    likeNotification: [],
  },
  reducers: {
    setLikeNotification: (state, action) => {
      if (action.payload.type === "like") {
        state.likeNotification.unshift(action.payload); // newest first
      } else if (action.payload.type === "dislike") {
        state.likeNotification = state.likeNotification.filter(
          (n) => n.userId !== action.payload.userId || n.postId !== action.payload.postId
        );
      }
    },

    // NEW: remove a single notification when viewed
    removeNotification: (state, action) => {
      const id = action.payload; // our computed id
      state.likeNotification = state.likeNotification.filter((n) => {
        const nid = n._id ?? `${n.type}:${n.postId}:${n.userId}`;
        return nid !== id;
      });
    },

    // (optional) clear all when popover is opened
    clearAllNotifications: (state) => {
      state.likeNotification = [];
    },
  },
});

export const { setLikeNotification, removeNotification, clearAllNotifications } = rtnSlice.actions;
export default rtnSlice.reducer;
