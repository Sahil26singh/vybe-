import axios from "axios";

const getApiUrl = () => {
  const isLocalBrowser =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  const envUrl = (import.meta.env.VITE_API_URL || "").trim();
  const envIsLocalhost = envUrl.includes("localhost") || envUrl.includes("127.0.0.1");

  // Use VITE_API_URL only when: It's set (non-empty, length > 5)
  if (envUrl && envUrl.length > 5 && (!envIsLocalhost || isLocalBrowser)) {
    return envUrl;
  }

  if (!isLocalBrowser && typeof window !== "undefined") {
    return window.location.origin;
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