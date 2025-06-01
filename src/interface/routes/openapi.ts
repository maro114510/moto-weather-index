import { createRoute, z } from "@hono/zod-openapi";

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
            timestamp: z.string().openapi({ example: "2024-01-01T00:00:00.000Z" }),
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
        description: "Latitude (-90 to 90)"
      }),
      lon: z.string().openapi({
        example: "139.6503",
        description: "Longitude (-180 to 180)"
      }),
      datetime: z.string().optional().openapi({
        example: "2024-01-01T12:00:00Z",
        description: "ISO 8601 datetime (optional, defaults to current time)"
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
            condition: z.enum(["clear", "cloudy", "rain", "snow", "unknown"]).openapi({ example: "clear" }),
            temperature: z.number().openapi({ example: 25.5 }),
            windSpeed: z.number().openapi({ example: 5.2 }),
            humidity: z.number().openapi({ example: 60 }),
            visibility: z.number().openapi({ example: 10 }),
            precipitationProbability: z.number().openapi({ example: 20 }),
            uvIndex: z.number().openapi({ example: 5 }),
            airQuality: z.enum(["low", "medium", "high"]).optional().openapi({ example: "low" }),
          }),
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string().openapi({ example: "lat must be between -90 and 90" }),
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
  description: "Calculate touring suitability index based on weather conditions",
  tags: ["Touring Index"],
  request: {
    query: z.object({
      lat: z.string().openapi({
        example: "35.6762",
        description: "Latitude (-90 to 90)"
      }),
      lon: z.string().openapi({
        example: "139.6503",
        description: "Longitude (-180 to 180)"
      }),
      datetime: z.string().optional().openapi({
        example: "2024-01-01T12:00:00Z",
        description: "ISO 8601 datetime (optional, defaults to current time)"
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
                humidity: 15
              }
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
            error: z.string().openapi({ example: "lat must be between -90 and 90" }),
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
  description: "Retrieve historical touring index data (not implemented yet)",
  tags: ["Touring Index"],
  request: {
    query: z.object({
      lat: z.string().openapi({
        example: "35.6762",
        description: "Latitude (-90 to 90)"
      }),
      lon: z.string().openapi({
        example: "139.6503",
        description: "Longitude (-180 to 180)"
      }),
    }),
  },
  responses: {
    200: {
      description: "History feature not implemented",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({ example: "History feature not implemented yet" }),
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
  description: "Calculate touring index for all prefectures for multiple days (requires authentication)",
  tags: ["Touring Index", "Batch Operations"],
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      days: z.string().optional().openapi({
        example: "7",
        description: "Number of days to calculate (1-30, default: 7)"
      }),
      maxRetries: z.string().optional().openapi({
        example: "3",
        description: "Maximum retry attempts (1-10, default: 3)"
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
            target_dates: z.array(z.string()).openapi({
              example: ["2024-01-01", "2024-01-02", "2024-01-03"]
            }),
            summary: z.object({
              total_processed: z.number().openapi({ example: 141 }),
              successful_inserts: z.number().openapi({ example: 138 }),
              failed_inserts: z.number().openapi({ example: 3 }),
              success_rate: z.number().openapi({ example: 98 }),
            }),
            errors: z.array(z.string()).optional().openapi({
              example: ["Prefecture 01: Weather data unavailable"]
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
