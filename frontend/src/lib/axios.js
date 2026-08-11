import axios from "axios";

// Bulletproof backend URL resolver.
// Priority:
//  1. VITE_API_URL env var — but ONLY if it's not a localhost URL while we're on a live domain
//  2. window.location.origin — when running on any non-localhost deployment
//  3. http://localhost:8000 — local dev fallback
const getApiUrl = () => {
  const isLocalBrowser =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  const envUrl = (import.meta.env.VITE_API_URL || "").trim();
  const envIsLocalhost = envUrl.includes("localhost") || envUrl.includes("127.0.0.1");

  // Use VITE_API_URL only when:
  // - It's set (non-empty, length > 5)
  // - AND it's a production URL (not localhost), OR we're running locally anyway
  if (envUrl && envUrl.length > 5 && (!envIsLocalhost || isLocalBrowser)) {
    return envUrl;
  }

  // On any deployed (non-localhost) domain → use current site origin
  if (!isLocalBrowser && typeof window !== "undefined") {
    return window.location.origin;
  }

  // Local dev fallback
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

// ── Keep-alive ping ──────────────────────────────────────────────────────────
// Render free tier sleeps the server after 15 minutes of inactivity, causing
// a 30-60s cold start on the next request. Pinging every 14 minutes keeps it
// awake. Only runs in production (skip on localhost dev).
const isLocalDev =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

if (!isLocalDev) {
  const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
  setInterval(() => {
    api.get("/api/v1/user/suggested", { withCredentials: true }).catch(() => {
      // Silently ignore — this is just a heartbeat
    });
  }, PING_INTERVAL_MS);
}
