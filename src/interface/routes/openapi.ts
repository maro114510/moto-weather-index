import { createRoute, z } from "@hono/zod-openapi";
import {
  ErrorResponseSchema,
  HealthResponseSchema,
  PrefectureListResponseSchema,
  TouringIndexHistoryResponseSchema,
  TouringIndexResponseSchema,
  WeatherResponseSchema,
} from "./schemas";

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
          schema: HealthResponseSchema,
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
          schema: WeatherResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Weather data is unavailable for specified coordinates/date",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
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
          schema: TouringIndexResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: "Weather data is unavailable for specified coordinates/date",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
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
          schema: TouringIndexHistoryResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid query parameters",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
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
          schema: PrefectureListResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});
