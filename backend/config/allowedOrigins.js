const isProd = process.env.NODE_ENV === "production";
const DEFAULT_ALLOWED_ORIGINS = isProd
    ? ""
    : "http://localhost:5173,http://localhost:3000,http://localhost:8000";

const rawOrigins = process.env.ALLOWED_ORIGINS !== undefined
    ? process.env.ALLOWED_ORIGINS
    : DEFAULT_ALLOWED_ORIGINS;

export const allowedOrigins = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

export default allowedOrigins;

