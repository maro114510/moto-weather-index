import { factory } from "../../factory";
import { createRequestContext, logger } from "../../utils/logger";

export const loggingMiddleware = factory.createMiddleware(async (c, next) => {
  const requestId = c.get("requestId");
  const startTime = Date.now();

  // Store in context for use in handlers and app.onError
  c.set("startTime", startTime);

  // Create base request context
  const requestContext = createRequestContext(requestId, {
    method: c.req.method,
    path: c.req.path,
    userAgent: c.req.header("user-agent"),
    ip:
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for") ||
      "unknown",
  });

  c.set("requestContext", requestContext);

  // Log incoming request
  logger.apiRequest(c.req.method, c.req.path, requestContext);

  await next();

  // Log response — only runs for successful responses.
  // Error responses are logged by app.onError via logErrorResponse().
  const duration = Date.now() - startTime;
  const statusCode = c.res.status;

  logger.apiResponse(c.req.method, c.req.path, statusCode, duration, {
    ...requestContext,
    responseSize: c.res.headers.get("content-length") || "unknown",
  });
});
