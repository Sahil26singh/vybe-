import express from 'express';
import { listNotifications, markRead, markAllRead, deleteNotification } from '../controllers/notification.controller.js';
import isAuthenticated from "../middlewares/isAuthenticated.js";


const router = express.Router();
router.get('/', isAuthenticated, listNotifications);
router.put('/:id/read', isAuthenticated, markRead);
router.put('/markall', isAuthenticated, markAllRead);
router.delete('/:id', isAuthenticated, deleteNotification);

export default router;