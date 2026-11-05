import { z } from "zod";
import mongoose from "mongoose";

/**
 * Express middleware generator that validates request body against a Zod schema
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.issues?.[0]?.message || "Validation failed";
      return res.status(400).json({
        message: firstError,
        errors: result.error.issues || [],
        success: false,
      });
    }
    // Assign validated/sanitized data back to req.body
    req.body = result.data;
    next();
  };
};

export const addCommentSchema = z.object({
  text: z
    .string({ error: "text is required" })
    .trim()
    .min(1, "text is required")
    .max(1000, "Comment cannot exceed 1000 characters"),
});

export const editProfileSchema = z.object({
  bio: z
    .string()
    .max(500, "Bio cannot exceed 500 characters")
    .optional()
    .nullable(),
  gender: z
    .string()
    .max(50, "Gender cannot exceed 50 characters")
    .optional()
    .nullable(),
});

export const forwardMessageSchema = z.object({
  toUserId: z
    .string({ error: "toUserId is required" })
    .trim()
    .min(1, "toUserId is required")
    .refine((val) => mongoose.isValidObjectId(val), {
      message: "toUserId must be a valid ObjectId",
    }),
});

export const sendMessageSchema = z.object({
  textMessage: z
    .string()
    .max(2000, "Message cannot exceed 2000 characters")
    .optional()
    .nullable(),
  message: z
    .string()
    .max(2000, "Message cannot exceed 2000 characters")
    .optional()
    .nullable(),
  postId: z
    .string()
    .trim()
    .refine((val) => !val || mongoose.isValidObjectId(val), {
      message: "postId must be a valid ObjectId",
    })
    .optional()
    .nullable(),
});

