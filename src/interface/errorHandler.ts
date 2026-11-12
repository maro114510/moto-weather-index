import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { ERROR_CODES } from "../constants/errorCodes";
import { HTTP_STATUS } from "../constants/httpStatus";
import { HttpError } from "../domain/HttpError";
import type { AppEnv } from "../types/env";
import { logger } from "../utils/logger";
import { sanitizeLogData } from "../utils/logSanitizer";

function sanitizeMessage(message: string): string {
  return String(sanitizeLogData(message));
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

// Global error handler — single source of truth for error → response conversion.
export const errorHandler: ErrorHandler<AppEnv> = (error, c) => {
  const requestContext = c.get("requestContext") || {};

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

    return c.json(
      {
        error: "Invalid parameters",
        details: error.issues.map((e) =>
          sanitizeMessage(`${e.path.join(".")}: ${e.message}`),
        ),
        requestId: c.get("requestId"),
      },
      HTTP_STATUS.BAD_REQUEST,
    );
  }

  // Hono built-in HTTPException (thrown by bearerAuth, jwt, etc.)
  if (error instanceof HTTPException) {
    const statusCode = error.status as ContentfulStatusCode;
    const errorMessage = sanitizeMessage(error.message);

    if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      logger.error(
        "HTTP exception",
        {
          ...requestContext,
          operation: "http_exception",
          statusCode,
          errorMessage,
        },
        error,
      );

      return c.json(
        {
          error: "Internal server error",
          requestId: c.get("requestId"),
        },
        statusCode,
      );
    }

    logger.warn(
      "HTTP exception",
      {
        ...requestContext,
        operation: "http_exception",
        statusCode,
        errorMessage,
      },
      error,
    );

    return c.json(
      {
        error: errorMessage,
        requestId: c.get("requestId"),
      },
      statusCode,
    );
  }

  if (error instanceof HttpError) {
    const statusCode = error.status as ContentfulStatusCode;
    const errorMessage = sanitizeMessage(error.message);

    if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      logger.error(
        "Server error",
        {
          ...requestContext,
          operation: "server_error",
          statusCode,
          errorCode: error.code,
          errorMessage,
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
          errorMessage,
        },
        error,
      );
    }

    return c.json(
      {
        error: errorMessage,
        ...(error.code === ERROR_CODES.WEATHER_DATA_INCOMPLETE
          ? { missingFactors: error.details?.missingFactors }
          : {}),
        requestId: c.get("requestId"),
      },
      statusCode,
    );
  }

  if (isTimeoutError(error)) {
    logger.error(
      "Request timed out",
      {
        ...requestContext,
        operation: "timeout_error",
        errorType: error.name,
      },
      error,
    );

    return c.json(
      {
        error: "Gateway timeout",
        requestId: c.get("requestId"),
      },
      HTTP_STATUS.GATEWAY_TIMEOUT,
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
      errorMessage: sanitizeMessage(
        error instanceof Error ? error.message : String(error),
      ),
    },
    error instanceof Error ? error : new Error(String(error)),
  );

  return c.json(
    {
      error: "Internal server error",
      message: "An unexpected error occurred",
      requestId: c.get("requestId"),
    },
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
  );
};
