import axios from "axios";

// Single source of truth for the backend URL.
// Set VITE_API_URL in a .env file for local dev, e.g.:
//   VITE_API_URL=http://localhost:8000
// Falls back to production so existing behavior is unchanged if unset.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export default api;
