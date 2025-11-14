import { createSlice } from "@reduxjs/toolkit";

const normalizeId = (x) =>
  typeof x === "string" ? x : String(x?._id ?? x?.toString?.() ?? x);

const normalizeUser = (u) => {
  if (!u) return u;
  const safe = { ...u };
  safe.bookmarks = (u.bookmarks || []).map(normalizeId);
  return safe;
};

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    suggestedUsers: [],
    userProfile: null,
    selectedUser: null,
  },
  reducers: {
    setAuthUser: (state, action) => {
      state.user = normalizeUser(action.payload);
    },
    setSuggestedUsers: (state, action) => {
      state.suggestedUsers = action.payload;
    },
    setUserProfile: (state, action) => {
      state.userProfile = action.payload;
    },
    setSelectedUser: (state, action) => {
      state.selectedUser = action.payload;
    },
    mergeAuthUser: (state, action) => {
      state.user = normalizeUser({ ...(state.user || {}), ...(action.payload || {}) });
    },
  },
});

export const {
  setAuthUser,
  setSuggestedUsers,
  setUserProfile,
  setSelectedUser,
  mergeAuthUser,
} = authSlice.actions;

export default authSlice.reducer;
