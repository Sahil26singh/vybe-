const DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:3000,http://localhost:8000,https://vybe-ymdg.onrender.com";

export const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map((o) => o.trim());

export default allowedOrigins;

