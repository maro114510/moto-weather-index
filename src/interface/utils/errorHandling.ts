import type { Context } from "hono";
import { z } from "zod";
import { HTTP_STATUS } from "../../constants/httpStatus";

/**
 * Format ZodError into user-friendly error message
 * @param error ZodError instance
 * @returns Formatted error message string
 */
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");
}

/**
 * Handle ZodError by formatting and returning appropriate HTTP response
 * @param c Hono context
 * @param error ZodError instance
 * @returns HTTP response with formatted error message
 */
export function handleZodError(c: Context, error: z.ZodError) {
  const errorMessage = formatZodError(error);
  return c.json({ error: errorMessage }, HTTP_STATUS.BAD_REQUEST);
}

/**
 * Wrapper for validation that automatically handles ZodError
 * @param validationFn Function that performs validation and may throw ZodError
 * @param c Hono context for error response
 * @returns Validation result or error response
 */
export async function withValidation<T>(
  validationFn: () => T,
  c: Context,
): Promise<T | Response> {
  try {
    return validationFn();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleZodError(c, error);
    }
    throw error;
  }
}