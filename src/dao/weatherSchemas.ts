import { z } from "@hono/zod-openapi";

const NUMERIC_INPUT_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function isValidDatePart(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidIsoDatetime(value: string): boolean {
  if (!ISO_DATETIME_PATTERN.test(value)) return false;

  const datePart = value.slice(0, 10);
  return (
    isValidDatePart(datePart) && Number.isFinite(new Date(value).getTime())
  );
}

const latitude = z
  .string()
  .min(1)
  .max(32)
  .regex(NUMERIC_INPUT_PATTERN, "lat must be a valid number")
  .transform(Number)
  .refine(Number.isFinite, "lat must be a valid number")
  .refine(
    (value) => value >= -90 && value <= 90,
    "lat must be between -90 and 90",
  );

const longitude = z
  .string()
  .min(1)
  .max(32)
  .regex(NUMERIC_INPUT_PATTERN, "lon must be a valid number")
  .transform(Number)
  .refine(Number.isFinite, "lon must be a valid number")
  .refine(
    (value) => value >= -180 && value <= 180,
    "lon must be between -180 and 180",
  );

export const datetime = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidIsoDatetime, "datetime must be a valid ISO 8601 datetime")
  .openapi({ pattern: ISO_DATETIME_PATTERN.source });

export const coordinates = {
  lat: latitude.openapi({
    example: "35.6762",
    description: "Latitude (-90 to 90)",
    minimum: -90,
    maximum: 90,
  }),
  lon: longitude.openapi({
    example: "139.6503",
    description: "Longitude (-180 to 180)",
    minimum: -180,
    maximum: 180,
  }),
};

// Validation schema for weather query parameters
export const getWeatherSchema = z.object({
  ...coordinates,
  datetime: datetime.optional().openapi({
    example: "2024-01-01T12:00:00Z",
    description: "ISO 8601 datetime (optional, defaults to current time)",
  }),
});

// Type inference from schema
export type GetWeatherParams = z.infer<typeof getWeatherSchema>;
