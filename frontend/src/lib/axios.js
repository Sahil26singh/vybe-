import axios from "axios";

// Bulletproof backend URL resolver.
// If browsing on any deployed domain (not localhost/127.0.0.1), always use window.location.origin.
const getApiUrl = () => {
  const envUrl = (import.meta.env.VITE_API_URL || "").trim();
  if (envUrl && envUrl.length > 5) return envUrl;

  if (typeof window !== "undefined" && window.location && window.location.origin) {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isLocal) {
      return window.location.origin;
    }
  }

  return "http://localhost:8000";
};

export const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Interceptor to handle expired or invalid JWT sessions globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("vybe_user");
      if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/signup")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
