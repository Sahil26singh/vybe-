import express from "express";
import { editProfile, followOrUnfollow, getFollowers, getFollowing, getMe, getProfile, getSuggestedUsers, login, logout, register, searchUsersByUsername } from "../controllers/user.controller.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import upload from "../middlewares/multer.js";
import { validateParamId } from "../middlewares/validateObjectId.js";
import { validateBody, editProfileSchema } from "../middlewares/validate.js";

const router = express.Router();

router.param('id', validateParamId('id'));

router.route('/register').post(register);
router.route('/login').post(login);
router.route('/logout').post(logout);
router.route('/me').get(isAuthenticated, getMe);

router.route('/search').get(isAuthenticated, searchUsersByUsername);
router.route('/suggested').get(isAuthenticated, getSuggestedUsers);
router.route('/edit/profile').post(isAuthenticated, upload.single('profilePhoto'), validateBody(editProfileSchema), editProfile);
router.route('/followorunfollow/:id').post(isAuthenticated, followOrUnfollow);

router.route('/:id/followers').get(isAuthenticated, getFollowers);
router.route('/:id/following').get(isAuthenticated, getFollowing);
router.route('/:id/profile').get(isAuthenticated, getProfile);

export default router;
