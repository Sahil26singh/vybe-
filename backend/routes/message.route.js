import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { 
    getMessage, 
    sendMessage, 
    editMessage, 
    deleteMessage, 
    forwardMessage 
} from "../controllers/message.controller.js";

const router = express.Router();

// Send & Get messages
router.post('/send/:id', isAuthenticated, sendMessage);
router.get('/all/:id', isAuthenticated, getMessage);

// Message actions
router.put('/:id', isAuthenticated, editMessage);           
router.delete('/:id', isAuthenticated, deleteMessage);      // Delete message
router.post('/forward/:id', isAuthenticated, forwardMessage); // Forward message

export default router;
