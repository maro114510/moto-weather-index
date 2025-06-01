import type { Context } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { logger } from "../../utils/logger";

export function healthCheck(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.debug("Health check request", {
    ...requestContext,
    operation: "health_check",
  });

  return c.json({ status: "ok", timestamp: new Date().toISOString() }, HTTP_STATUS.OK);
}
