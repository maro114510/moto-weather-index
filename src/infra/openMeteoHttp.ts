import type { z } from "zod";
import { ERROR_CODES } from "../constants/errorCodes";
import { HTTP_STATUS } from "../constants/httpStatus";
import { HttpError } from "../domain/HttpError";

export function invalidResponse(field: string, detail?: unknown): HttpError {
  return new HttpError(
    HTTP_STATUS.BAD_GATEWAY,
    `Invalid Open-Meteo response: ${field}`,
    {
      code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
      details: { field, detail },
    },
  );
}

export function parseResponse<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw invalidResponse(issue?.path.join(".") || "response", issue?.message);
}

/** Every Open-Meteo call fails with the same upstream error codes. */
export async function fetchJson(
  fetchImpl: typeof fetch,
  requestTimeoutMs: number,
  base: string,
  params: Record<string, string>,
): Promise<unknown> {
  const url = `${base}?${new URLSearchParams(params).toString()}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new HttpError(
      timedOut ? HTTP_STATUS.GATEWAY_TIMEOUT : HTTP_STATUS.SERVICE_UNAVAILABLE,
      timedOut
        ? "Weather provider request timed out"
        : "Weather provider is unavailable",
      {
        code: timedOut
          ? ERROR_CODES.WEATHER_UPSTREAM_TIMEOUT
          : ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE,
        cause: error,
      },
    );
  }

  if (!response.ok) {
    const clientError = response.status >= 400 && response.status < 500;
    throw new HttpError(
      clientError ? HTTP_STATUS.BAD_GATEWAY : HTTP_STATUS.SERVICE_UNAVAILABLE,
      clientError
        ? "Failed to retrieve valid weather data from upstream provider"
        : "Weather provider is unavailable",
      {
        code: clientError
          ? ERROR_CODES.WEATHER_UPSTREAM_CLIENT_ERROR
          : ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE,
        details: { statusCode: response.status },
      },
    );
  }

  try {
    return await response.json();
  } catch {
    throw invalidResponse("body", "not JSON");
  }
}
