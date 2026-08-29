/**
 * In-Memory Sliding Window Rate Limiter
 * Protects API routes against spam, brute-force, and DDoS attacks.
 */

const tracker = new Map()

// Cleanup expired buckets every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of tracker.entries()) {
    if (now > record.resetTime) {
      tracker.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Check if a request exceeds rate limit for a given key/IP
 * @param {string} identifier - Unique client identifier (e.g., IP address or route key)
 * @param {number} maxRequests - Maximum allowed requests within the window
 * @param {number} windowMs - Time window in milliseconds (default: 60,000ms = 1 min)
 * @returns {{ success: boolean, remaining: number, resetTime: number }}
 */
export function checkRateLimit(identifier, maxRequests = 60, windowMs = 60000) {
  const now = Date.now()
  const record = tracker.get(identifier)

  if (!record || now > record.resetTime) {
    const newRecord = {
      count: 1,
      resetTime: now + windowMs,
    }
    tracker.set(identifier, newRecord)
    return {
      success: true,
      remaining: maxRequests - 1,
      resetTime: newRecord.resetTime,
    }
  }

  if (record.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: record.resetTime,
    }
  }

  record.count += 1
  return {
    success: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  }
}

/**
 * Extract client IP address from Next.js Request headers securely
 * @param {Request} request 
 * @returns {string}
 */
export function getClientIp(request) {
  if (!request || !request.headers) return '127.0.0.1'
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}
