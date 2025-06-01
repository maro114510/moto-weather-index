import type { Context } from "hono";
import { logger } from "../../utils/logger";

export function healthCheck(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.debug("Health check request", {
    ...requestContext,
    operation: "health_check",
  });

  return c.json({ status: "ok", timestamp: new Date().toISOString() });
}
