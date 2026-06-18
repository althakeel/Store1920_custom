import OpenAI from "openai";

// Lazy initialize OpenAI to avoid build-time crashes when env vars are missing
let _openai = null;
let _openaiKey = null;
let _openaiBaseUrl = null;

export function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function ensureOpenAI() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const baseURL = process.env.OPENAI_BASE_URL || undefined;
  if (!apiKey) {
    throw new Error("OpenAI is not configured");
  }

  if (_openai && _openaiKey === apiKey && _openaiBaseUrl === baseURL) {
    return _openai;
  }

  _openaiKey = apiKey;
  _openaiBaseUrl = baseURL;
  _openai = new OpenAI({
    apiKey,
    baseURL,
  });
  return _openai;
}

// Default-like named export that defers initialization until first use
export const openai = new Proxy({}, {
  get(_target, prop) {
    const client = ensureOpenAI();
    // @ts-ignore dynamic access
    return client[prop];
  }
});

