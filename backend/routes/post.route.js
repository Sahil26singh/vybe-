import express from "express";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import upload from "../middlewares/multer.js";
import { validateParamId } from "../middlewares/validateObjectId.js";
import { validateBody, addCommentSchema } from "../middlewares/validate.js";
import { 
    addComment, 
    addNewPost, 
    bookmarkPost, 
    deleteComment, 
    deletePost, 
    dislikePost, 
    generateCaption, 
    getAllPost, 
    getCommentsOfPost, 
    getUserPost, 
    likePost,
    getPostById,
    getLikedPosts,
    getBookmarkedPosts
} from "../controllers/post.controller.js";

const router = express.Router();

router.param('id', validateParamId('id'));
router.param('postId', validateParamId('postId'));
router.param('commentId', validateParamId('commentId'));

router.route("/addpost").post(isAuthenticated, upload.single('image'), addNewPost);
router.route("/generate-caption").post(isAuthenticated, upload.single('image'), generateCaption);
router.route("/all").get(isAuthenticated, getAllPost);
router.route("/userpost/all").get(isAuthenticated, getUserPost);
router.route("/liked").get(isAuthenticated, getLikedPosts);
router.route("/bookmarked").get(isAuthenticated, getBookmarkedPosts);
router.route("/:id").get(isAuthenticated, getPostById);
router.route("/:id/like").post(isAuthenticated, likePost);
router.route("/:id/dislike").post(isAuthenticated, dislikePost);
router.route("/:id/comment").post(isAuthenticated, validateBody(addCommentSchema), addComment); 
router.route("/:id/comment/all").get(isAuthenticated, getCommentsOfPost).post(isAuthenticated, getCommentsOfPost);
router.route("/:id/comments").get(isAuthenticated, getCommentsOfPost);
router.route("/delete/:id").delete(isAuthenticated, deletePost);
router.route("/:id/bookmark").post(isAuthenticated, bookmarkPost);
router.route("/:postId/comment/:commentId").delete(isAuthenticated, deleteComment);

export default router;
