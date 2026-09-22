// src/lib/errorHandler.js

export function handleError(error, request = null, requestId = null) {
  const finalRequestId = requestId || request?.headers?.get('x-request-id') || crypto.randomUUID();
  const code = error.code || 'INTERNAL_ERROR';
  const statusCode = error.statusCode || 500;
  
  // Safe client-facing message
  const message = (statusCode >= 500 && process.env.NODE_ENV === 'production')
    ? 'An unexpected error occurred. Please contact support.'
    : error.message;

  console.warn(`[API Error] [${finalRequestId}] ${code}: ${error.message}`);

  const response = {
    success: false,
    error: {
      code,
      message,
      ...(error.field && { field: error.field, value: error.value }),
      ...(error.retryAfter && { retryAfter: error.retryAfter }),
      ...(error.constraint && {
        constraint: error.constraint,
        current: error.currentValue,
        safeRange: error.safeRange
      })
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: finalRequestId
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      originalMessage: error.message,
      stack: error.stack
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': finalRequestId
  };

  if (error.retryAfter) {
    headers['Retry-After'] = error.retryAfter.toString();
  }

  return Response.json(response, { status: statusCode, headers });
}