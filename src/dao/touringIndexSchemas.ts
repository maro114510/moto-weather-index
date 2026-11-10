import { z } from "@hono/zod-openapi";
import { coordinates, datetime } from "./weatherSchemas";

const dateOnly = (fieldName: string) =>
  z
    .string()
    .length(10)
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${fieldName} must be in YYYY-MM-DD format`)
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(`${value}T00:00:00Z`);
      return (
        Number.isFinite(date.getTime()) &&
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, `${fieldName} must be a valid date`);

const defaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString().split("T")[0];
};

const defaultEndDate = () => new Date().toISOString().split("T")[0];

const prefectureId = z
  .string()
  .min(1)
  .max(2)
  .regex(/^(?:[1-9]|[1-3]\d|4[0-7])$/, "prefectureId must be between 1 and 47")
  .transform(Number);

// Validation schema for touring index query parameters
export const getTouringIndexSchema = z.object({
  ...coordinates,
  datetime: datetime.optional().openapi({
    example: "2024-01-01T12:00:00Z",
    description: "ISO 8601 datetime (optional, defaults to current time)",
  }),
});

// Validation schema for touring index history query parameters
export const getTouringIndexHistorySchema = z.object({
  ...coordinates,
  startDate: dateOnly("startDate")
    .optional()
    .transform((value) => value ?? defaultStartDate())
    .openapi({
      example: "2024-05-25",
      description:
        "Start date in YYYY-MM-DD format (optional, defaults to 7 days ago)",
    }),
  endDate: dateOnly("endDate")
    .optional()
    .transform((value) => value ?? defaultEndDate())
    .openapi({
      example: "2024-06-01",
      description:
        "End date in YYYY-MM-DD format (optional, defaults to today)",
    }),
  prefectureId: prefectureId.optional().openapi({
    example: "13",
    description:
      "Prefecture ID (1-47, optional, auto-detected from coordinates if not provided)",
  }),
});

// Type inference from schemas
export type GetTouringIndexParams = z.infer<typeof getTouringIndexSchema>;
export type GetTouringIndexHistoryParams = z.infer<
  typeof getTouringIndexHistorySchema
>;
