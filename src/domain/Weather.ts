import { z } from "zod";

/**
 * Enum schema for weather condition.
 * Allowed values: 'clear', 'mostly_clear', 'partly_cloudy', 'cloudy', 'overcast', 'fog', 'drizzle', 'rain', 'snow', 'unknown'.
 */
export const WeatherConditionSchema = z.enum([
  "clear",
  "mostly_clear",
  "partly_cloudy",
  "cloudy",
  "overcast",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "unknown",
]);
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

/**
 * Enum schema for air quality or pollen/PM2.5 level.
 * Allowed values: 'low', 'medium', 'high'.
 */
export const AirQualityLevelSchema = z.enum(["low", "medium", "high"]);
export type AirQualityLevel = z.infer<typeof AirQualityLevelSchema>;
