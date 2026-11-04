import { Server } from "socket.io";
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";
import { allowedOrigins } from "../config/allowedOrigins.js";

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
});

io.use((socket, next) => {
    try {
        const raw = socket.handshake.headers.cookie || "";
        const tokenCookie = raw
            .split(";")
            .map(c => c.trim())
            .find(c => c.startsWith("token="));
        const token = tokenCookie ? tokenCookie.slice(6) : null;
        if (!token) {
            return next(new Error("Unauthorized"));
        }
        const { userId } = jwt.verify(token, process.env.SECRET_KEY);
        if (!userId) {
            return next(new Error("Unauthorized"));
        }
        socket.userId = String(userId);   // normalized userId string
        next();
    } catch {
        next(new Error("Unauthorized"));
    }
});

// Map<userId, Set<socketId>>: tracks active sockets per user for multi-tab presence
const userSocketMap = new Map();

io.on('connection', (socket) => {
    const userId = socket.userId ? String(socket.userId) : null;
    if (!userId) return;

    // Join room for this user so io.to(userId) reaches all open tabs/devices
    socket.join(userId);

    let userSockets = userSocketMap.get(userId);
    const isFirstConnection = !userSockets || userSockets.size === 0;

    if (!userSockets) {
        userSockets = new Set();
        userSocketMap.set(userId, userSockets);
    }
    userSockets.add(socket.id);
    console.log(`User connected: ${userId} (socket ${socket.id}, active tabs: ${userSockets.size})`);

    // 1. Send the initial online users list ONLY to this newly connected socket (no global broadcast)
    socket.emit('getOnlineUsers', Array.from(userSocketMap.keys()));

    // 2. Broadcast lightweight delta ONLY when user actually transitions from offline to online (0 -> 1 tabs)
    if (isFirstConnection) {
        socket.broadcast.emit('userOnline', userId);
    }

    // Allow on-demand request for online users
    socket.on('getOnlineUsers', () => {
        socket.emit('getOnlineUsers', Array.from(userSocketMap.keys()));
    });

    socket.on('disconnect', () => {
        const sockets = userSocketMap.get(userId);
        if (sockets) {
            sockets.delete(socket.id);
            console.log(`User socket disconnected: ${userId} (socket ${socket.id}, remaining tabs: ${sockets.size})`);

            if (sockets.size === 0) {
                userSocketMap.delete(userId);
                console.log(`User went offline: ${userId}`);
                // Broadcast lightweight delta ONLY when user truly goes offline (last tab closed)
                io.emit('userOffline', userId);
            }
        }
    });
});

export { app, server, io };
