// src/lib/retry.js

export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 150,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    jitter = true,
    shouldRetry = isRetryable
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      let delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      if (jitter) {
        delayMs *= (0.8 + Math.random() * 0.4);
      }
      delayMs = Math.min(delayMs, maxDelayMs);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export function isRetryable(error) {
  const retryableCodes = [
    'NETWORK_ERROR',
    'CONNECTION_TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'MONGODB_CONNECTION_ERROR',
    'FIREBASE_ERROR',
    'GEMINI_TIMEOUT'
  ];

  return (
    retryableCodes.includes(error.code) ||
    error.statusCode === 503 ||
    error.statusCode === 504 ||
    error.statusCode === 408
  );
}