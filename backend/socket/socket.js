import { Server } from "socket.io";
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";

const app = express();

const server = http.createServer(app);

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:8000,https://vybe-ymdg.onrender.com";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map(o => o.trim());

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
});

io.use((socket, next) => {
    try {
        const raw = socket.handshake.headers.cookie || "";
        const token = raw
            .split(";")
            .map(c => c.trim())
            .find(c => c.startsWith("token="))
            ?.split("=")[1];
        if (!token) {
            return next(new Error("Unauthorized"));
        }
        const { userId } = jwt.verify(token, process.env.SECRET_KEY);
        if (!userId) {
            return next(new Error("Unauthorized"));
        }
        socket.userId = userId;   // use this instead of the query userId
        next();
    } catch {
        next(new Error("Unauthorized"));
    }
});

const userSocketMap = {}; //userId -> socketId

export const getReceiverSocketId = (receiverId) => userSocketMap[receiverId];

io.on('connection', async (socket) => {
    const userId = socket.userId;
    if (userId) {
        userSocketMap[userId] = socket.id;
        console.log(`User connected: ${userId} -> ${socket.id}`);
    }

    io.emit('getOnlineUsers', Object.keys(userSocketMap));

    socket.on('disconnect', () => {
        if (userId) {
            delete userSocketMap[userId];
            console.log(`User disconnected: ${userId}`);
        }
        io.emit('getOnlineUsers', Object.keys(userSocketMap));
    });
});

export { app, server, io };
