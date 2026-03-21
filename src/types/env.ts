import type { LogContext } from "../utils/logger";

/**
 * Hono application environment type.
 *
 * - Bindings: Cloudflare Workers runtime bindings (D1, KV, secrets, vars)
 * - Variables: Request-scoped values set via c.set() in middleware
 */
export type AppEnv = {
	Bindings: {
		DB: D1Database;
		OPEN_METEO_CACHE: KVNamespace;
		WEATHERAPI_KEY: string;
		BATCH_START_DATE?: string;
		LOG_LEVEL?: string;
	};
	Variables: {
		requestId: string;
		requestContext: LogContext;
		startTime: number;
	};
};
