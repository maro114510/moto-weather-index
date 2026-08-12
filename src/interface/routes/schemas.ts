import { z } from "@hono/zod-openapi";
import { WeatherConditionSchema } from "../../domain/Weather";

// === Shared schemas ===

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ example: "Something went wrong" }),
  })
  .openapi("ErrorResponse");

export const LocationSchema = z
  .object({
    lat: z.number().openapi({ example: 35.6762 }),
    lon: z.number().openapi({ example: 139.6503 }),
  })
  .openapi("Location");

// === Response schemas ===

export const HealthResponseSchema = z
  .object({
    status: z.string().openapi({ example: "ok" }),
    timestamp: z.string().openapi({ example: "2024-01-01T00:00:00.000Z" }),
  })
  .openapi("HealthResponse");

export const ReadinessResponseSchema = z
  .object({
    ready: z.boolean().openapi({ example: true }),
    reason: z
      .enum(["ok", "no_run_recorded", "incomplete_coverage", "stale"])
      .openapi({ example: "ok" }),
    lastRun: z
      .object({
        runId: z.string().openapi({ example: "b3b1f7e0-..." }),
        status: z.enum(["success", "partial", "failed"]).openapi({
          example: "success",
        }),
        finishedAt: z.string().openapi({ example: "2024-01-01T04:05:00.000Z" }),
        expectedCount: z.number().openapi({ example: 658 }),
        committedCount: z.number().openapi({ example: 658 }),
      })
      .nullable()
      .openapi({ description: "The most recently recorded scheduled run" }),
    ageMs: z.number().nullable().openapi({ example: 3_600_000 }),
    thresholdMs: z.number().openapi({ example: 93_600_000 }),
    timestamp: z.string().openapi({ example: "2024-01-01T00:00:00.000Z" }),
  })
  .openapi("ReadinessResponse");

export const WeatherResponseSchema = z
  .object({
    datetime: z.string().openapi({ example: "2024-01-01T12:00:00Z" }),
    condition: z
      .enum(WeatherConditionSchema.options)
      .openapi({ example: "clear" }),
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
  })
  .openapi("WeatherResponse");

export const TouringIndexResponseSchema = z
  .object({
    location: LocationSchema,
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
  })
  .openapi("TouringIndexResponse");

export const TouringIndexHistoryItemSchema = z
  .object({
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
    calculated_at: z.string().openapi({ example: "2024-06-01T06:00:00Z" }),
  })
  .openapi("TouringIndexHistoryItem");

export const TouringIndexHistoryResponseSchema = z
  .object({
    location: LocationSchema,
    prefecture_id: z.number().openapi({ example: 13 }),
    data: z.array(TouringIndexHistoryItemSchema),
  })
  .openapi("TouringIndexHistoryResponse");

export const PrefectureSchema = z
  .object({
    id: z.number().openapi({ example: 13 }),
    name_ja: z.string().openapi({ example: "東京都" }),
    name_en: z.string().openapi({ example: "Tokyo" }),
    latitude: z.number().openapi({ example: 35.6762 }),
    longitude: z.number().openapi({ example: 139.6503 }),
  })
  .openapi("Prefecture");

export const PrefectureListResponseSchema = z
  .object({
    prefectures: z.array(PrefectureSchema),
    count: z.number().openapi({ example: 47 }),
  })
  .openapi("PrefectureListResponse");
