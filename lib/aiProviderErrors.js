export function getAiErrorStatus(error) {
  const direct = Number(error?.status || error?.response?.status || error?.statusCode || 0);
  if (direct === 429) return 429;

  const message = String(
    error?.error?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    ''
  ).toLowerCase();

  if (
    message.includes('api key not valid') ||
    message.includes('invalid api key') ||
    message.includes('incorrect api key')
  ) {
    return 401;
  }

  if (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota') ||
    message.includes('resource_exhausted') ||
    message.includes('resource exhausted')
  ) {
    return 429;
  }

  return Number.isFinite(direct) && direct >= 400 && direct < 600 ? direct : 500;
}

export function isAiRateLimitError(error) {
  return getAiErrorStatus(error) === 429;
}

export function getAiErrorMessage(error, provider = 'AI') {
  const providerLabel = provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : 'AI';
  const raw = String(
    error?.error?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    ''
  ).trim();

  if (isAiRateLimitError(error)) {
    return `${providerLabel} quota or rate limit reached. Enable billing on the ${providerLabel} account, or set PRODUCT_AI_PROVIDER=openai (or gemini) on the server and redeploy/restart so the new API key loads.`;
  }

  if (getAiErrorStatus(error) === 401) {
    return `${providerLabel} API key is invalid. Update the key in AWS env vars and redeploy/restart the server.`;
  }

  return raw || `${providerLabel} autofill failed`;
}

export async function callWithRateLimitRetry(fn, { maxRetries = 3, baseDelayMs = 2000 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isAiRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }

  throw lastError || new Error('AI request failed');
}
