import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
const isValidKey = apiKey && !apiKey.toLowerCase().includes("your_") && apiKey.length > 20;

const genAI = isValidKey ? new GoogleGenerativeAI(apiKey) : null;

// Uses a fast/cheap Gemini model — plenty for short alt-text + moderation checks.
const MODEL_NAME = "gemini-2.0-flash";

const bufferToInlinePart = (imageBuffer) => ({
    inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: "image/jpeg",
    },
});

/**
 * Generates a short, descriptive alt-text string for an image.
 */
export const generateAltText = async (imageBuffer) => {
    if (!genAI) return "";
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent([
            "Write a concise, factual alt-text description of this image for accessibility (screen readers). One sentence, no more than 20 words. Do not start with 'Image of' or 'Photo of'.",
            bufferToInlinePart(imageBuffer),
        ]);
        return result.response.text().trim();
    } catch (error) {
        console.log("generateAltText error:", error.message);
        return "";
    }
};

/**
 * Generates an engaging social media caption with hashtags for an image.
 */
export const generateAICaption = async (imageBuffer) => {
    if (!genAI) {
        return "Peaceful moments and good vibes ✨🌅 #sunset #peace #vibes";
    }
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const result = await model.generateContent([
            "Write an engaging, aesthetic social media caption for this image. Include 2-3 emojis and 2-3 relevant trending hashtags. Keep it under 2 sentences.",
            bufferToInlinePart(imageBuffer),
        ]);
        return result.response.text().trim();
    } catch (error) {
        console.log("generateAICaption error:", error.message);
        return "Catching sunsets and quiet thoughts ✨🌅 #sunset #peace #vibes";
    }
};

/**
 * Checks an image + caption for policy violations.
 */
export const moderateContent = async (imageBuffer, caption = "") => {
    if (!genAI) return { safe: true, reason: "" };
    try {
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" },
        });
        const prompt = `You are a content moderation classifier for a social media app.
Look at this image and caption, and decide if it violates policy.
Flag as unsafe: graphic violence/gore, sexual/nude content, hate symbols, or content promoting self-harm.
Do NOT flag ordinary content (people, food, pets, memes, everyday photos) just because it's imperfect.
Caption: ${JSON.stringify(caption || "")}

Respond ONLY with JSON: {"safe": boolean, "reason": string}. "reason" should be empty if safe.`;

        const result = await model.generateContent([
            prompt,
            bufferToInlinePart(imageBuffer),
        ]);
        const parsed = JSON.parse(result.response.text());
        return {
            safe: parsed.safe !== false,
            reason: parsed.reason || "",
        };
    } catch (error) {
        console.log("moderateContent error:", error.message);
        return { safe: true, reason: "" };
    }
};

/**
 * Generates a 768-dimensional vector embedding for user text.
 * Uses Gemini text-embedding-004 model if GEMINI_API_KEY is present,
 * or a deterministic feature vector fallback if key is absent.
 */
export const generateUserEmbedding = async (text) => {
    if (!text || !text.trim()) return [];

    // 1. Try Gemini AI if valid API key exists
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
            const result = await model.embedContent(text.trim());
            if (result?.embedding?.values?.length) {
                return result.embedding.values;
            }
        } catch (error) {
            console.log("Gemini API embedding error (using fallback vector):", error.message);
        }
    }

    // 2. Fallback: Generate deterministic 768-dim normalized feature vector
    const dim = 768;
    const vector = new Array(dim).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");

    for (let i = 0; i < cleaned.length; i++) {
        const charCode = cleaned.charCodeAt(i);
        const idx1 = (charCode * 31 + i * 17) % dim;
        const idx2 = (charCode * 53 + i * 29) % dim;
        vector[idx1] += 1.0;
        vector[idx2] += 0.5;
    }

    // Normalize vector (Unit L2 norm) for Cosine Similarity
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
        for (let i = 0; i < dim; i++) vector[i] /= norm;
    }

    return vector;
};

/**
 * Computes Cosine Similarity between two numerical vectors.
 * Returns a value between -1.0 and 1.0 (higher = more similar).
 */
export const calculateCosineSimilarity = (vecA, vecB) => {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
        return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
