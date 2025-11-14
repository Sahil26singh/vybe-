import express from "express";
import { editProfile, followOrUnfollow, getFollowers, getFollowing, getProfile, getSuggestedUsers, login, logout, register, searchUsersByUsername } from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import upload from "../middlewares/multer.js";

const router = express.Router();
// ...existing routes...
router.route('/:id/followers').get(isAuthenticated, getFollowers);
router.route('/:id/following').get(isAuthenticated, getFollowing);

router.route('/register').post(register);
router.route('/login').post(login);
router.route('/logout').get(logout);
router.route('/search').get(isAuthenticated, searchUsersByUsername);
router.route('/:id/profile').get(isAuthenticated, getProfile);
router.route('/edit/profile').post(isAuthenticated, upload.single('profilePhoto'), editProfile);
router.route('/suggested').get(isAuthenticated, getSuggestedUsers);
router.route('/followorunfollow/:id').post(isAuthenticated, followOrUnfollow);

export default router;