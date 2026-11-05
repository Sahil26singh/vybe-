import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { validateParamId } from "../middlewares/validateObjectId.js";
import { validateBody, sendMessageSchema, forwardMessageSchema } from "../middlewares/validate.js";
import { messageLimiter } from "../middlewares/rateLimiter.js";
import { 
    getMessage, 
    sendMessage, 
    editMessage, 
    deleteMessage, 
    forwardMessage,
    getUnreadMessagesCount,
    markMessagesAsRead
} from "../controllers/message.controller.js";

const router = express.Router();

router.get('/unread-count', isAuthenticated, getUnreadMessagesCount);

router.param('id', validateParamId('id'));

// Send & Get messages
router.post('/send/:id', isAuthenticated, messageLimiter, validateBody(sendMessageSchema), sendMessage);
router.get('/all/:id', isAuthenticated, getMessage);
router.post('/:id/read', isAuthenticated, markMessagesAsRead);

// Message actions
router.put('/:id', isAuthenticated, editMessage);           
router.delete('/:id', isAuthenticated, deleteMessage);      // Delete message
router.post('/forward/:id', isAuthenticated, messageLimiter, validateBody(forwardMessageSchema), forwardMessage); // Forward message

export default router;
