import type { Context } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";
import {
  createCheckScheduledRunReadinessUseCase,
  createScheduledRunRepository,
} from "../../di/container";
import type { AppEnv } from "../../types/env";
import { logger } from "../../utils/logger";

// Liveness: reports whether the process itself is running. Must stay
// healthy even while readiness reports stale/incomplete data.
export function healthCheck(c: Context<AppEnv>) {
  const requestContext = c.get("requestContext") || {};

  logger.debug("Health check request", {
    ...requestContext,
    operation: "health_check",
  });

  return c.json(
    { status: "ok", timestamp: new Date().toISOString() },
    HTTP_STATUS.OK,
  );
}

// Readiness: reports whether the latest scheduled run achieved full
// coverage within the freshness threshold.
export async function readinessCheck(c: Context<AppEnv>) {
  const requestContext = c.get("requestContext") || {};

  logger.debug("Readiness check request", {
    ...requestContext,
    operation: "readiness_check",
  });

  const scheduledRunRepo = createScheduledRunRepository(c.env.DB);
  const useCase = createCheckScheduledRunReadinessUseCase(scheduledRunRepo);
  const result = await useCase.check();

  logger.info("Readiness check completed", {
    ...requestContext,
    operation: "readiness_check",
    ready: result.ready,
    reason: result.reason,
  });

  return c.json(
    {
      ready: result.ready,
      reason: result.reason,
      lastRun: result.lastRun
        ? {
            runId: result.lastRun.runId,
            status: result.lastRun.status,
            finishedAt: result.lastRun.finishedAt,
            expectedCount: result.lastRun.expectedCount,
            committedCount: result.lastRun.committedCount,
          }
        : null,
      ageMs: result.ageMs,
      thresholdMs: result.thresholdMs,
      timestamp: new Date().toISOString(),
    },
    result.ready ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE,
  );
}
