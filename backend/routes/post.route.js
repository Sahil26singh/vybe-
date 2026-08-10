import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import upload from "../middlewares/multer.js";
import { addComment, addNewPost, bookmarkPost, deleteComment, deletePost, dislikePost, generateCaption, getAllPost, getCommentsOfPost, getUserPost, likePost } from "../controllers/post.controller.js";

const router = express.Router();

router.route("/addpost").post(isAuthenticated, upload.single('image'), addNewPost);
router.route("/generate-caption").post(isAuthenticated, upload.single('image'), generateCaption);
router.route("/all").get(isAuthenticated,getAllPost);
router.route("/userpost/all").get(isAuthenticated, getUserPost);
router.route("/:id/like").get(isAuthenticated, likePost);
router.route("/:id/dislike").get(isAuthenticated, dislikePost);
router.route("/:id/comment").post(isAuthenticated, addComment); 
router.route("/:id/comment/all").post(isAuthenticated, getCommentsOfPost);
router.route("/delete/:id").delete(isAuthenticated, deletePost);
router.route("/:id/bookmark").get(isAuthenticated, bookmarkPost);
router.route("/:postId/comment/:commentId").delete(isAuthenticated, deleteComment);


export default router;
