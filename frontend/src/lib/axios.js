import axios from "axios";

// Single source of truth for the backend URL.
// In production, fallback to window.location.origin so requests hit the live server instead of localhost.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === "production" ? window.location.origin : "http://localhost:8000");

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
