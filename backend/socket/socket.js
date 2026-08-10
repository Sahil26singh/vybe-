import {Server} from "socket.io";
import express from "express";
import http from "http";


const app = express();

const server = http.createServer(app);

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:5174,http://localhost:3000,http://localhost:8000,https://vybe-ymdg.onrender.com";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map(o => o.trim());

const io = new Server(server, {
    cors:{
  origin: allowedOrigins,
  methods: ['GET', 'POST']
}
})

const userSocketMap = {} ; // this map stores socket id corresponding the user id; userId -> socketId

export const getReceiverSocketId = (receiverId) => userSocketMap[receiverId];

io.on('connection', async (socket)=>{
    const userId = socket.handshake.query.userId;
    console.log(userId);
    if(userId){
        userSocketMap[userId] = socket.id;

    }

    io.emit('getOnlineUsers', Object.keys(userSocketMap));

    socket.on('disconnect',()=>{
        if(userId){
            delete userSocketMap[userId];
        }
        io.emit('getOnlineUsers', Object.keys(userSocketMap));
    });
})

export {app, server, io};