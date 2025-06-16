import { createRoute, z } from "@hono/zod-openapi";
import { WeatherConditionSchema } from "../../domain/Weather";

// Health check route
export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  summary: "Health check endpoint",
  description: "Returns the health status of the API",
  tags: ["Health"],
  responses: {
    200: {
      description: "Health check successful",
      content: {
        "application/json": {
          schema: z.object({
            status: z.string().openapi({ example: "ok" }),
            timestamp: z
              .string()
              .openapi({ example: "2024-01-01T00:00:00.000Z" }),
          }),
        },
      },
    },
  },
});

// Weather route
export const weatherRoute = createRoute({
  method: "get",
  path: "/api/v1/weather",
  summary: "Get weather information",
  description: "Retrieve current weather data for specified coordinates",
  tags: ["Weather"],
  request: {
    query: z.object({
      lat: z.string().openapi({
        example: "35.6762",
        description: "Latitude (-90 to 90)",
      }),
      lon: z.string().openapi({
        example: "139.6503",
        description: "Longitude (-180 to 180)",
      }),
      datetime: z.string().optional().openapi({
        example: "2024-01-01T12:00:00Z",
        description: "ISO 8601 datetime (optional, defaults to current time)",
      }),
    }),
  },
  responses: {
    200: {
      description: "Weather data retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            datetime: z.string().openapi({ example: "2024-01-01T12:00:00Z" }),
            condition: WeatherConditionSchema.openapi({ example: "clear" }),
            temperature: z.number().openapi({ example: 25.5 }),
            windSpeed: z.number().openapi({ example: 5.2 }),
            humidity: z.number().openapi({ example: 60 }),
            visibility: z.number().openapi({ example: 10 }),
            precipitationProbability: z.number().openapi({ example: 20 }),
            uvIndex: z.number().openapi({ example: 5 }),
            airQuality: z
              .enum(["low", "medium", "high"])
              .optional()
              .openapi({ example: "low" }),
          }),
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: z.object({
            error: z
              .string()
              .openapi({ example: "lat must be between -90 and 90" }),
          }),
        },
      },
    },
  },
});

// Touring index route
export const touringIndexRoute = createRoute({
  method: "get",
  path: "/api/v1/touring-index",
  summary: "Calculate touring index",
  description:
    "Calculate touring suitability index based on weather conditions",
  tags: ["Touring Index"],
  request: {
    query: z.object({
      lat: z.string().openapi({
        example: "35.6762",
        description: "Latitude (-90 to 90)",
      }),
      lon: z.string().openapi({
        example: "139.6503",
        description: "Longitude (-180 to 180)",
      }),
      datetime: z.string().optional().openapi({
        example: "2024-01-01T12:00:00Z",
        description: "ISO 8601 datetime (optional, defaults to current time)",
      }),
    }),
  },
  responses: {
    200: {
      description: "Touring index calculated successfully",
      content: {
        "application/json": {
          schema: z.object({
            location: z.object({
              lat: z.number().openapi({ example: 35.6762 }),
              lon: z.number().openapi({ example: 139.6503 }),
            }),
            datetime: z.string().openapi({ example: "2024-01-01T12:00:00Z" }),
            score: z.number().openapi({ example: 85.5 }),
            factors: z.record(z.string(), z.number()).openapi({
              example: {
                temperature: 20,
                weather: 25,
                wind: 15,
                visibility: 10,
                humidity: 15,
              },
            }),
          }),
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: z.object({
            error: z
              .string()
              .openapi({ example: "lat must be between -90 and 90" }),
          }),
        },
      },
    },
  },
});

// Touring index history route
export const touringIndexHistoryRoute = createRoute({
  method: "get",
  path: "/api/v1/touring-index/history",
  summary: "Get touring index history",
  description:
    "Retrieve historical touring index data for a specific location and date range",
  tags: ["Touring Index"],
  request: {
    query: z.object({
      lat: z.string().openapi({
        example: "35.6762",
        description: "Latitude (-90 to 90)",
      }),
      lon: z.string().openapi({
        example: "139.6503",
        description: "Longitude (-180 to 180)",
      }),
      startDate: z.string().optional().openapi({
        example: "2024-05-25",
        description:
          "Start date in YYYY-MM-DD format (optional, defaults to 7 days ago)",
      }),
      endDate: z.string().optional().openapi({
        example: "2024-06-01",
        description:
          "End date in YYYY-MM-DD format (optional, defaults to today)",
      }),
      prefectureId: z.string().optional().openapi({
        example: "13",
        description:
          "Prefecture ID (1-47, optional, auto-detected from coordinates if not provided)",
      }),
    }),
  },
  responses: {
    200: {
      description: "Historical touring index data retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            location: z.object({
              lat: z.number().openapi({ example: 35.6762 }),
              lon: z.number().openapi({ example: 139.6503 }),
            }),
            prefecture_id: z.number().openapi({ example: 13 }),
            data: z.array(
              z.object({
                date: z.string().openapi({ example: "2024-06-01" }),
                score: z.number().openapi({ example: 85.5 }),
                factors: z.record(z.string(), z.number()).openapi({
                  example: {
                    temperature: 20,
                    weather: 25,
                    wind: 15,
                    visibility: 10,
                    humidity: 15,
                  },
                }),
                calculated_at: z
                  .string()
                  .openapi({ example: "2024-06-01T06:00:00Z" }),
              }),
            ),
          }),
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string().openapi({
              example: "Date range cannot exceed 30 days",
            }),
          }),
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string().openapi({
              example: "Database not available",
            }),
          }),
        },
      },
    },
  },
});

// Touring index batch route
export const touringIndexBatchRoute = createRoute({
  method: "post",
  path: "/api/v1/touring-index/batch",
  summary: "Execute batch touring index calculation",
  description:
    "Calculate touring index for all prefectures for multiple days (requires authentication). " +
    "Start date can be specified as query parameter or environment variable (BATCH_START_DATE). " +
    "Start date must be within the last 7 days or up to 16 days in the future.",
  tags: ["Touring Index", "Batch Operations"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      days: z.string().optional().openapi({
        example: "7",
        description: "Number of days to calculate (1-30, default: 16)",
      }),
      maxRetries: z.string().optional().openapi({
        example: "3",
        description: "Maximum retry attempts (1-10, default: 3)",
      }),
      startDate: z.string().optional().openapi({
        example: "2025-06-15",
        description:
          "Custom start date in YYYY-MM-DD format (optional). Must be within last 7 days or up to 16 days in future. Falls back to BATCH_START_DATE environment variable if not provided.",
      }),
    }),
  },
  responses: {
    200: {
      description: "Batch processing completed",
      content: {
        "application/json": {
          schema: z.object({
            status: z.string().openapi({ example: "completed" }),
            duration_ms: z.number().openapi({ example: 15432 }),
            start_date: z.string().optional().openapi({
              example: "2025-06-15",
              description:
                "The actual start date used for batch processing (may be from parameter, environment variable, or default)",
            }),
            target_dates: z.array(z.string()).openapi({
              example: ["2024-01-01", "2024-01-02", "2024-01-03"],
            }),
            summary: z.object({
              total_processed: z.number().openapi({ example: 141 }),
              successful_inserts: z.number().openapi({ example: 138 }),
              failed_inserts: z.number().openapi({ example: 3 }),
              success_rate: z.number().openapi({ example: 98 }),
            }),
            errors: z
              .array(z.string())
              .optional()
              .openapi({
                example: ["Prefecture 01: Weather data unavailable"],
              }),
          }),
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string().openapi({
              example: "Batch start date must be within the last 7 days",
            }),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string().openapi({ example: "Unauthorized" }),
          }),
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string().openapi({ example: "Database not available" }),
          }),
        },
      },
    },
  },
});

// Prefecture list route
export const prefectureListRoute = createRoute({
  method: "get",
  path: "/api/v1/prefectures",
  summary: "Get all prefectures",
  description: "Retrieve the list of all 47 Japanese prefectures",
  tags: ["Prefecture"],
  responses: {
    200: {
      description: "Prefecture list retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            prefectures: z.array(
              z.object({
                id: z.number().openapi({ example: 13 }),
                name_ja: z.string().openapi({ example: "東京都" }),
                name_en: z.string().openapi({ example: "Tokyo" }),
                latitude: z.number().openapi({ example: 35.6762 }),
                longitude: z.number().openapi({ example: 139.6503 }),
              }),
            ),
            count: z.number().openapi({ example: 47 }),
          }),
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string().openapi({ example: "Internal server error" }),
          }),
        },
      },
    },
  },
});
