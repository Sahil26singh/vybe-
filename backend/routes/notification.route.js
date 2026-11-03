import express from 'express';
import { listNotifications, getUnreadNotificationCount, markRead, markAllRead, deleteNotification } from '../controllers/notification.controller.js';
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { validateParamId } from "../middlewares/validateObjectId.js";

const router = express.Router();

router.param('id', validateParamId('id'));

router.get('/', isAuthenticated, listNotifications);
router.get('/unread-count', isAuthenticated, getUnreadNotificationCount);
router.put('/markall', isAuthenticated, markAllRead);
router.put('/:id/read', isAuthenticated, markRead);
router.delete('/:id', isAuthenticated, deleteNotification);

export default router;
