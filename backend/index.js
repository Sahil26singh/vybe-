import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import connectDB from "./utils/db.js";
import userRoute from "./routes/user.route.js";
import postRoute from "./routes/post.route.js";
import messageRoute from "./routes/message.route.js";
import { app, server } from "./socket/socket.js";
import notificationRoute from './routes/notification.route.js';
import path from "path";

const PORT = process.env.PORT || 8000;

const __dirname = path.resolve();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:8000,https://vybe-ymdg.onrender.com";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
  .split(",")
  .map((o) => o.trim());

const corsOptions = {
  origin: allowedOrigins,
  credentials: true
};
app.use(cors(corsOptions));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/v1/user/login", authLimiter);
app.use("/api/v1/user/register", authLimiter);

app.use("/api/v1/notification", notificationRoute);
app.use("/api/v1/user", userRoute);
app.use("/api/v1/post", postRoute);
app.use("/api/v1/message", messageRoute);

// Error handling middleware for API routes (including Multer limit/type errors)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "An error occurred"
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, "/frontend/dist")));
app.get("{*path}", (req, res) => {
  res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
});

const startServer = async () => {
  try {
    await connectDB(); 
    server.listen(PORT, () => {
      console.log(`Server is listening at port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
