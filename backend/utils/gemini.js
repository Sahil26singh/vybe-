import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
const isValidKey = apiKey && !apiKey.toLowerCase().includes("your_") && apiKey.length > 20;

const genAI = isValidKey ? new GoogleGenerativeAI(apiKey) : null;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";

// Real Google Gemini models with fallback cascade
const CANDIDATE_MODELS = [
    GEMINI_MODEL,
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-2.5-flash"
].filter((v, i, a) => a.indexOf(v) === i);

const CANDIDATE_EMBEDDING_MODELS = [
    GEMINI_EMBEDDING_MODEL,
    "gemini-embedding-2",
    "gemini-embedding-001"
].filter((v, i, a) => a.indexOf(v) === i);

let workingModelName = null;
let workingEmbeddingModelName = null;

const bufferToInlinePart = (imageBuffer) => ({
    inlineData: {
        data: imageBuffer.toString("base64"),
        mimeType: "image/jpeg",
    },
});

const generateContentWithFallback = async (contents, options = {}) => {
    if (!genAI) throw new Error("Google AI API Key not configured");

    const modelsToTry = workingModelName
        ? [workingModelName, ...CANDIDATE_MODELS.filter((m) => m !== workingModelName)]
        : CANDIDATE_MODELS;

    let lastError = null;
    for (const modelName of modelsToTry) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName, ...options });
            const result = await model.generateContent(contents);
            if (result && result.response) {
                workingModelName = modelName; // Cache working model for subsequent calls
                return result;
            }
        } catch (err) {
            lastError = err;
            const isRetryable =
                err.status === 404 ||
                err.status === 429 ||
                err.status === 503 ||
                err.message?.includes("404") ||
                err.message?.includes("not found") ||
                err.message?.includes("503") ||
                err.message?.includes("high demand") ||
                err.message?.includes("quota") ||
                err.message?.includes("RESOURCE_EXHAUSTED");

            if (isRetryable) {
                console.log(`[Gemini Fallback] Model [${modelName}] failed (${err.message?.slice(0, 80)}). Trying next candidate...`);
                continue;
            }
            throw err;
        }
    }
    throw lastError || new Error("No available Gemini model succeeded");
};

export const generateAltText = async (imageBuffer) => {
    if (!genAI) return "";
    try {
        const result = await generateContentWithFallback([
            "Write a concise, factual alt-text description of this image for accessibility (screen readers). One sentence, no more than 20 words. Do not start with 'Image of' or 'Photo of'.",
            bufferToInlinePart(imageBuffer),
        ]);
        return result.response.text().trim();
    } catch (error) {
        console.log("generateAltText error:", error.message);
        return "";
    }
};

export const generateAICaption = async (imageBuffer) => {
    if (!genAI) {
        throw new Error("AI service is not configured");
    }
    const result = await generateContentWithFallback([
        "Write an engaging, aesthetic social media caption for this image. Include 2-3 emojis and 2-3 relevant trending hashtags. Keep it under 2 sentences.",
        bufferToInlinePart(imageBuffer),
    ]);
    const text = result?.response?.text()?.trim();
    if (!text) {
        throw new Error("Could not generate a caption");
    }
    return text;
};

/**
 * Checks an image + caption for policy violations.
 * Fail-secure policy: if moderation fails or cannot be verified, blocks the post.
 */
export const moderateContent = async (imageBuffer, caption = "") => {
    if (!genAI) {
        return {
            safe: false,
            reason: "Content moderation check could not be completed. Please try again later.",
        };
    }
    try {
        const prompt = `You are a content moderation classifier for a social media app.
Look at this image and caption, and decide if it violates policy.
Flag as unsafe: graphic violence/gore, sexual/nude content, hate symbols, or content promoting self-harm.
Do NOT flag ordinary content (people, food, pets, memes, everyday photos) just because it's imperfect.
Caption: ${JSON.stringify(caption || "")}

Respond ONLY with JSON: {"safe": boolean, "reason": string}. "reason" should be empty if safe.`;

        const result = await generateContentWithFallback(
            [prompt, bufferToInlinePart(imageBuffer)],
            { generationConfig: { responseMimeType: "application/json" } }
        );
        const parsed = JSON.parse(result.response.text());
        return {
            safe: parsed.safe !== false,
            reason: parsed.reason || "",
        };
    } catch (error) {
        console.log("moderateContent error:", error.message);
        return {
            safe: false,
            reason: "Content moderation check could not be completed. Please try again later.",
        };
    }
};

/**
 * Generates a 768-dimensional vector embedding for user text.
 * Uses Gemini embedding model with Matryoshka outputDimensionality (768) and fallback.
 * Returns an object: { values: number[], source: "gemini" | "fallback" }
 */
export const generateUserEmbedding = async (text) => {
    if (!text || !text.trim()) return null;

    const TARGET_DIM = 768;

    if (genAI) {
        const modelsToTry = workingEmbeddingModelName
            ? [workingEmbeddingModelName, ...CANDIDATE_EMBEDDING_MODELS.filter((m) => m !== workingEmbeddingModelName)]
            : CANDIDATE_EMBEDDING_MODELS;

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.embedContent({
                    content: { parts: [{ text: text.trim() }] },
                    outputDimensionality: TARGET_DIM,
                });
                let values = result?.embedding?.values;
                if (values?.length) {
                    if (values.length > TARGET_DIM) {
                        values = values.slice(0, TARGET_DIM);
                    }
                    // Unit L2 normalization
                    let norm = 0;
                    for (let i = 0; i < values.length; i++) norm += values[i] * values[i];
                    norm = Math.sqrt(norm);
                    if (norm > 0) {
                        for (let i = 0; i < values.length; i++) values[i] /= norm;
                    }

                    workingEmbeddingModelName = modelName; // Cache working embedding model
                    return {
                        values,
                        source: "gemini",
                    };
                }
            } catch (error) {
                console.log(`[Gemini Embedding Fallback] Model [${modelName}] error: ${error.message?.slice(0, 80)}. Trying next...`);
                continue;
            }
        }
    }

    // Fallback: Generate deterministic 768-dim normalized feature vector
    const dim = TARGET_DIM;
    const vector = new Array(dim).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");

    for (let i = 0; i < cleaned.length; i++) {
        const charCode = cleaned.charCodeAt(i);
        const idx1 = (charCode * 31 + i * 17) % dim;
        const idx2 = (charCode * 53 + i * 29) % dim;
        vector[idx1] += 1.0;
        vector[idx2] += 0.5;
    }

    // Normalize vector (Unit L2 norm-euclidean distance) for Cosine Similarity
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
        for (let i = 0; i < dim; i++) vector[i] /= norm;
    }

    return {
        values: vector,
        source: "fallback",
    };
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
