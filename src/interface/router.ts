import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";
import { ZodError } from "zod";
import { HTTP_STATUS } from "../constants/httpStatus";
import { HttpError } from "../domain/HttpError";
import type { AppEnv } from "../types/env";
import { logger } from "../utils/logger";
import { healthCheck } from "./handlers/healthHandler";
import { getPrefectures } from "./handlers/prefectureHandler";
import {
	getTouringIndex,
	getTouringIndexHistory,
} from "./handlers/touringIndexHandler";
import { getWeather } from "./handlers/weatherHandler";
import { corsMiddleware } from "./middleware/cors";
import { loggingMiddleware } from "./middleware/logging";
import {
	healthRoute,
	prefectureListRoute,
	touringIndexHistoryRoute,
	touringIndexRoute,
	weatherRoute,
} from "./routes/openapi";

export const app = new OpenAPIHono<AppEnv>();

// Apply global middleware
app.use("*", corsMiddleware);
app.use("*", requestId());
app.use("*", loggingMiddleware);

// Global error handler — single source of truth for error → response conversion
app.onError((error, c) => {
	const requestContext = c.get("requestContext") || {};
	const startTime = c.get("startTime");

	if (error instanceof ZodError) {
		logger.warn(
			"Validation error",
			{
				...requestContext,
				operation: "validation",
				validationErrors: error.issues.map((e) => ({
					path: e.path.join("."),
					message: e.message,
					code: e.code,
				})),
			},
			error,
		);

		logErrorResponse(
			c.req.method,
			c.req.path,
			HTTP_STATUS.BAD_REQUEST,
			startTime,
			requestContext,
		);

		return c.json(
			{
				error: "Invalid parameters",
				details: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
				requestId: c.get("requestId"),
			},
			HTTP_STATUS.BAD_REQUEST,
		);
	}

	if (error instanceof HttpError) {
		const statusCode = error.status;

		if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
			logger.error(
				"Server error",
				{
					...requestContext,
					operation: "server_error",
					statusCode,
					errorCode: error.code,
					errorMessage: error.message,
				},
				error,
			);
		} else {
			logger.warn(
				"Client error",
				{
					...requestContext,
					operation: "client_error",
					statusCode,
					errorCode: error.code,
					errorMessage: error.message,
				},
				error,
			);
		}

		logErrorResponse(
			c.req.method,
			c.req.path,
			statusCode,
			startTime,
			requestContext,
		);

		return c.json(
			{
				error: error.message,
				requestId: c.get("requestId"),
			},
			statusCode as any,
		);
	}

	if (error instanceof TypeError && error.message.includes("fetch")) {
		logger.error(
			"Network error - external API unreachable",
			{
				...requestContext,
				operation: "network_error",
				errorType: "fetch_error",
			},
			error,
		);

		logErrorResponse(
			c.req.method,
			c.req.path,
			HTTP_STATUS.SERVICE_UNAVAILABLE,
			startTime,
			requestContext,
		);

		return c.json(
			{
				error: "External service unavailable",
				requestId: c.get("requestId"),
			},
			HTTP_STATUS.SERVICE_UNAVAILABLE,
		);
	}

	logger.error(
		"Unhandled internal server error",
		{
			...requestContext,
			operation: "internal_error",
			errorType: error?.constructor?.name || "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		},
		error instanceof Error ? error : new Error(String(error)),
	);

	logErrorResponse(
		c.req.method,
		c.req.path,
		HTTP_STATUS.INTERNAL_SERVER_ERROR,
		startTime,
		requestContext,
	);

	return c.json(
		{
			error: "Internal server error",
			message: "An unexpected error occurred",
			requestId: c.get("requestId"),
		},
		HTTP_STATUS.INTERNAL_SERVER_ERROR,
	);
});

/**
 * Log API response for error cases handled by app.onError.
 *
 * app.onError runs outside the middleware chain, so loggingMiddleware's
 * post-next response logging does not execute for error paths.
 * This helper ensures error responses are still logged with duration.
 */
function logErrorResponse(
	method: string,
	path: string,
	statusCode: number,
	startTime: number | undefined,
	requestContext: Record<string, unknown>,
) {
	const duration = startTime ? Date.now() - startTime : 0;
	logger.apiResponse(method, path, statusCode, duration, {
		...requestContext,
		responseSize: "unknown",
	});
}

// Register OpenAPI routes
app.openapi(healthRoute, healthCheck);
app.openapi(weatherRoute, getWeather);
app.openapi(touringIndexRoute, getTouringIndex);
app.openapi(touringIndexHistoryRoute, getTouringIndexHistory);
app.openapi(prefectureListRoute, getPrefectures);

// OpenAPI documentation endpoint
app.doc("/specification", {
	openapi: "3.0.0",
	info: {
		title: "Moto Weather Index API",
		version: "1.0.0",
		description:
			"API for calculating motorcycle touring weather index based on weather conditions",
	},
	servers: [
		{
			url: "http://localhost:3000",
			description: "Development server",
		},
	],
});

// Swagger UI endpoint
app.get("/doc", swaggerUI({ url: "/specification" }));
