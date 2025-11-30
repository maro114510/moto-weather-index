// Interface Layer - Rate Limit Middleware

import type { Context, Next } from "hono";
import type { EnforceRateLimitUseCase } from "../../usecase/EnforceRateLimit";

export function createRateLimitMiddleware(
  enforceRateLimitUseCase: EnforceRateLimitUseCase,
) {
  return async (c: Context, next: Next) => {
    // 1. Extract client IP
    const clientIP = extractClientIP(c);

    // 2. Apply use case
    const result = await enforceRateLimitUseCase.checkRateLimit(clientIP);

    // 3. Handle result
    if (!result.allowed) {
      return c.json(
        {
          error: "Rate Limit Exceeded",
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(result.retryAfterMs / 1000),
          limit: 10,
          remaining: result.tokensRemaining,
          resetTime: Date.now() + result.retryAfterMs,
        },
        429,
        {
          "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
        },
      );
    }

    // 4. Continue request pipeline
    return next();
  };
}

function extractClientIP(c: Context): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}
