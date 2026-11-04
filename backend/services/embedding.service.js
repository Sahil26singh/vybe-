import mongoose from "mongoose";
import pLimit from "p-limit";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { generateUserEmbedding } from "../utils/gemini.js";

// Concurrency limiter: max 3 simultaneous Gemini embedding API calls
const limit = pLimit(3);

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastProcessedAt = new Map(); // userId (string) -> timestamp (ms)
const trailingTimers = new Map();   // userId (string) -> setTimeout handle
const inFlight = new Set();        // userId (string)

/**
 * Builds representative text for a user using their bio + up to 5 recent post captions.
 * Does NOT include the username.
 * If total text is shorter than 20 characters, returns null (not enough signal).
 */
export const buildProfileText = async (user) => {
  if (!user) return null;

  const bio = (user.bio || "").trim();
  const recentPosts = await Post.find({ author: user._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("caption")
    .lean();

  const captions = recentPosts
    .map((p) => (p.caption || "").trim())
    .filter(Boolean);

  const parts = [];
  if (bio) parts.push(bio);
  if (captions.length > 0) parts.push(captions.join(". "));

  const combined = parts.join(". ").trim();
  if (combined.length < 20) {
    return null;
  }
  return combined;
};

/**
 * Internal worker to process embedding with up to 3 attempts and exponential backoff
 */
export const processUserEmbedding = async (userId) => {
  const user = await User.findById(userId).select("+embedding");
  if (!user) return;

  const profileText = await buildProfileText(user);

  if (!profileText) {
    // Insufficient text signal (<20 chars): mark status 'none' and clear embedding
    user.embeddingStatus = "none";
    user.embedding = undefined;
    user.embeddingUpdatedAt = new Date();
    await user.save();
    return;
  }

  // Set pending status
  user.embeddingStatus = "pending";
  user.embeddingUpdatedAt = new Date();
  await user.save();

  let result = null;
  let attempts = user.embeddingAttempts || 0;
  const maxAttempts = 3;

  for (let i = 1; i <= maxAttempts; i++) {
    attempts += 1;
    result = await generateUserEmbedding(profileText);
    if (result && Array.isArray(result.values) && result.values.length === 768) {
      break;
    }
    if (i < maxAttempts) {
      const backoffMs = 1000 * Math.pow(2, i); // 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  if (result && Array.isArray(result.values) && result.values.length === 768) {
    user.embedding = result.values;
    user.embeddingModel = result.model;
    user.embeddingStatus = "ready";
    user.embeddingAttempts = attempts;
    user.embeddingUpdatedAt = new Date();
    await user.save();
    console.log(`[Embedding Service] Ready: 768-dim vector for @${user.username} using [${result.model}]`);
  } else {
    user.embeddingStatus = "failed";
    user.embeddingAttempts = attempts;
    user.embeddingUpdatedAt = new Date();
    await user.save();
    console.warn(`[Embedding Service] Failed: embedding generation for @${user.username} after ${attempts} attempts`);
  }
};

/**
 * Public queue function:
 * - Capped at 3 concurrent calls via p-limit
 * - In-flight deduplication via Set
 * - 5-minute cooldown per user
 * - If called during cooldown, schedules ONE trailing refresh after cooldown
 * - Never throws to caller
 */
export const queueEmbedding = (userId) => {
  try {
    const id = String(userId);
    if (!id || !mongoose.isValidObjectId(id)) return;

    const lastRun = lastProcessedAt.get(id) || 0;
    const elapsed = Date.now() - lastRun;

    // Check if cooldown is active
    if (elapsed < COOLDOWN_MS) {
      // Schedule ONE trailing refresh if not already scheduled
      if (!trailingTimers.has(id)) {
        const delay = Math.max(1000, COOLDOWN_MS - elapsed + 500);
        const timer = setTimeout(() => {
          trailingTimers.delete(id);
          queueEmbedding(id);
        }, delay);
        if (timer.unref) timer.unref();
        trailingTimers.set(id, timer);
      }
      return;
    }

    // Check if currently actively executing in the queue
    if (inFlight.has(id)) {
      if (!trailingTimers.has(id)) {
        const timer = setTimeout(() => {
          trailingTimers.delete(id);
          queueEmbedding(id);
        }, COOLDOWN_MS);
        if (timer.unref) timer.unref();
        trailingTimers.set(id, timer);
      }
      return;
    }

    inFlight.add(id);
    lastProcessedAt.set(id, Date.now());

    limit(async () => {
      try {
        await processUserEmbedding(id);
      } catch (err) {
        console.error(`[Embedding Queue] Error processing user ${id}:`, err.message);
      } finally {
        inFlight.delete(id);
      }
    });
  } catch (err) {
    console.error("[Embedding Queue] queueEmbedding caught error:", err.message);
  }
};

