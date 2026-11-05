import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const isRateLimitDisabled = () => process.env.DISABLE_RATE_LIMIT === "true";

const getUserOrIpKey = (req) => {
  if (req.id) return String(req.id);
  return ipKeyGenerator(req);
};

// Global limiter: 500 requests per 15 minutes per IP across all /api routes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  skip: isRateLimitDisabled,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth limiter: 10 failed login/register attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  skip: isRateLimitDisabled,
  message: { success: false, message: "Too many attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI route limiter: 20 calls per 15 minutes per user/IP (protects Gemini quota & costs)
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: getUserOrIpKey,
  skip: isRateLimitDisabled,
  message: { success: false, message: "AI rate limit reached. Please wait before generating more captions or posts." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Messaging limiter: 60 messages per minute per user/IP (prevents chat flooding & DoS)
export const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  keyGenerator: getUserOrIpKey,
  skip: isRateLimitDisabled,
  message: { success: false, message: "You are sending messages too quickly. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
