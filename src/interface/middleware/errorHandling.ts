import type { Context, Next } from "hono";
import { ZodError } from "zod";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { logger } from "../../utils/logger";

export async function errorHandlingMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const requestContext = c.get("requestContext") || {};

    // Handle different types of errors
    if (error instanceof ZodError) {
      // Validation errors - these are client errors, log as warning
      logger.warn(
        "Validation error",
        {
          ...requestContext,
          operation: "validation",
          validationErrors: error.errors.map((e) => ({
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
          details: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
          requestId: c.get("requestId"),
        },
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // Check if it's a known API error (has status code)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      typeof error.status === "number"
    ) {
      const statusCode = error.status as number;
      const message = (error as any).message || "Unknown error";

      if (statusCode >= 500) {
        // Server errors - log as error
        logger.error(
          "Server error",
          {
            ...requestContext,
            operation: "server_error",
            statusCode,
            errorMessage: message,
          },
          error as unknown as Error,
        );
      } else if (statusCode >= 400) {
        // Client errors - log as warning
        logger.warn(
          "Client error",
          {
            ...requestContext,
            operation: "client_error",
            statusCode,
            errorMessage: message,
          },
          error as unknown as Error,
        );
      }

      return c.json(
        {
          error: message,
          requestId: c.get("requestId"),
        },
        statusCode as any,
      );
    }

    // Check for fetch/network errors
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

    // Default to internal server error for all other errors
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

    return c.json(
      {
        error: "Internal server error",
        message: "An unexpected error occurred",
        requestId: c.get("requestId"),
      },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
