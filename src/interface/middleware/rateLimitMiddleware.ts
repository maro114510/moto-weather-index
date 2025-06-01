import { Context } from "hono";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix?: string; // Prefix for KV keys
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

/**
 * Rate limiting middleware using KV storage
 * Limits requests per IP address to prevent abuse
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const {
    windowMs = 60 * 1000, // Default: 1 minute
    maxRequests = 100, // Default: 100 requests
    keyPrefix = "rate_limit"
  } = config;

  return async (c: Context, next: () => Promise<void>) => {
    const kv = c.env?.OPEN_METEO_CACHE;

    if (!kv) {
      // If KV is not available, skip rate limiting
      console.warn("KV namespace not available, skipping rate limit");
      await next();
      return;
    }

    // Get client IP address
    const clientIP = getClientIP(c);
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const rateLimitKey = `${keyPrefix}:${clientIP}:${windowStart}`;

    try {
      // Get current rate limit info
      const existingData = await kv.get(rateLimitKey, "json") as RateLimitInfo | null;

      let currentCount = 1;

      if (existingData) {
        currentCount = existingData.count + 1;
      }

      // Check if limit exceeded
      if (currentCount > maxRequests) {
        const resetTime = windowStart + windowMs;
        const retryAfter = Math.ceil((resetTime - now) / 1000);

        // Set rate limit headers
        c.header("X-RateLimit-Limit", maxRequests.toString());
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", Math.floor(resetTime / 1000).toString());
        c.header("Retry-After", retryAfter.toString());

        return c.json(
          {
            error: "Rate limit exceeded",
            message: `Too many requests. Limit: ${maxRequests} requests per minute.`,
            retryAfter: retryAfter
          },
          429
        );
      }

      // Update rate limit info in KV
      const rateLimitInfo: RateLimitInfo = {
        count: currentCount,
        resetTime: windowStart + windowMs
      };

      // Store with expiration slightly longer than window to handle clock skew
      const expirationTtl = Math.ceil(windowMs / 1000) + 10;
      await kv.put(rateLimitKey, JSON.stringify(rateLimitInfo), {
        expirationTtl
      });

      // Set rate limit headers
      const remaining = Math.max(0, maxRequests - currentCount);
      const resetTime = windowStart + windowMs;

      c.header("X-RateLimit-Limit", maxRequests.toString());
      c.header("X-RateLimit-Remaining", remaining.toString());
      c.header("X-RateLimit-Reset", Math.floor(resetTime / 1000).toString());

    } catch (error) {
      console.error("Rate limit middleware error:", error);
      // On error, allow the request to proceed
    }

    await next();
  };
}

/**
 * Extract client IP address from request
 * Handles various proxy headers
 */
function getClientIP(c: Context): string {
  // Check common proxy headers
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = c.req.header("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = c.req.header("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a default IP if none found
  return "unknown";
}

/**
 * Pre-configured rate limiter for API endpoints
 * 100 requests per minute per IP
 */
export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  keyPrefix: "api_rate_limit"
});

/**
 * Stricter rate limiter for auth endpoints
 * 10 requests per minute per IP
 */
export const authRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  keyPrefix: "auth_rate_limit"
});
