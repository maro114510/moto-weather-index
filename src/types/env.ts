import type { LogContext } from "../utils/logger";

/**
 * Hono application environment type.
 *
 * - Bindings: Cloudflare Workers runtime bindings (vars)
 * - Variables: Request-scoped values set via c.set() in middleware
 */
export type AppEnv = {
  Bindings: {
    LOG_LEVEL?: string;
  };
  Variables: {
    requestId: string;
    requestContext: LogContext;
    startTime: number;
  };
};
