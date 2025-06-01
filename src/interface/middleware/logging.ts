import type { Context, Next } from "hono";
import { logger, generateRequestId, createRequestContext } from "../../utils/logger";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    requestContext: ReturnType<typeof createRequestContext>;
    startTime: number;
  }
}

export async function loggingMiddleware(c: Context, next: Next) {
  // Generate unique request ID
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Store in context for use in handlers
  c.set("requestId", requestId);
  c.set("startTime", startTime);

  // Create base request context
  const requestContext = createRequestContext(requestId, {
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("user-agent"),
    ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown",
  });

  c.set("requestContext", requestContext);

  // Log incoming request
  logger.apiRequest(c.req.method, c.req.path, requestContext);

  try {
    await next();
  } catch (error) {
    // Log unhandled errors at middleware level
    logger.error("Unhandled error in request processing", requestContext, error as Error);

    // Re-throw to let error handling middleware deal with it
    throw error;
  } finally {
    // Log response
    const duration = Date.now() - startTime;
    const statusCode = c.res.status;

    logger.apiResponse(c.req.method, c.req.path, statusCode, duration, {
      ...requestContext,
      responseSize: c.res.headers.get("content-length") || "unknown",
    });
  }
}
