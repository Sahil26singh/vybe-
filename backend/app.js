import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { globalLimiter, authLimiter } from "./middlewares/rateLimiter.js";
import userRoute from "./routes/user.route.js";
import postRoute from "./routes/post.route.js";
import messageRoute from "./routes/message.route.js";
import notificationRoute from "./routes/notification.route.js";
import path from "path";
import { allowedOrigins } from "./config/allowedOrigins.js";
import { app, server, io } from "./socket/socket.js";

const __dirname = path.resolve();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        connectSrc: [
          "'self'",
          "ws:",
          "wss:",
          "https://res.cloudinary.com",
          ...(process.env.NODE_ENV !== "production"
            ? ["ws://localhost:*", "http://localhost:*"]
            : []),
        ],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
};
app.use(cors(corsOptions));

// Apply global rate limiter to all API endpoints
app.use("/api", globalLimiter);

// Auth rate limiter on sensitive endpoints
app.use("/api/v1/user/login", authLimiter);
app.use("/api/v1/user/register", authLimiter);

app.use("/api/v1/notification", notificationRoute);
app.use("/api/v1/user", userRoute);
app.use("/api/v1/post", postRoute);
app.use("/api/v1/message", messageRoute);

// Explicit 404 handler for unknown API routes
app.all(/^\/api(\/.*)?$/, (req, res) => {
  return res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware for API routes (including Multer limit/type errors)
app.use((err, req, res, next) => {
  if (err) {
    const isClientError = err.name === "MulterError" || err.name === "ValidationError" || err.message?.includes("Only images allowed") || (err.status && err.status < 500) || (err.statusCode && err.statusCode < 500);
    const statusCode = isClientError ? (err.status || err.statusCode || 400) : 500;
    const message = statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : (err.message || "An error occurred");

    if (statusCode >= 500) {
      console.error("Internal Server Error:", err);
    }
    return res.status(statusCode).json({
      success: false,
      message
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, "/frontend/dist")));
app.get("{*path}", (req, res) => {
  res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
});

export { app, server, io };

