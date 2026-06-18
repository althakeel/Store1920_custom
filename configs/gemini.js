// configs/gemini.js
// Google Gemini API client setup
import { GoogleGenerativeAI } from "@google/generative-ai";

let _gemini = null;
let _geminiKey = null;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function ensureGemini() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error("Gemini is not configured");
  }

  if (_gemini && _geminiKey === apiKey) {
    return _gemini;
  }

  _geminiKey = apiKey;
  _gemini = new GoogleGenerativeAI(apiKey);
  return _gemini;
}

export const gemini = new Proxy({}, {
  get(target, prop) {
    const client = ensureGemini();
    return client[prop];
  }
});
