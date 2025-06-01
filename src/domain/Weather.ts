import { z } from "zod";

/**
 * Enum schema for weather condition.
 * Allowed values: 'clear', 'cloudy', 'rain', 'snow', 'unknown'.
 */
export const WeatherConditionSchema = z.enum([
  "clear",
  "cloudy",
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

/**
 * Main schema for weather data object.
 * All fields are strictly validated by range and type.
 */
export const WeatherSchema = z.object({
  // ISO8601 date string
  datetime: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "datetime must be a valid ISO8601 string",
  }),

  // Weather condition (see enum)
  condition: WeatherConditionSchema,

  // Temperature in Celsius: -50 to 60 (reasonable Earth range)
  temperature: z
    .number()
    .min(-50, "temperature is too low")
    .max(60, "temperature is too high"),

  // Wind speed in m/s: 0 to 50
  windSpeed: z
    .number()
    .min(0, "windSpeed must be >= 0")
    .max(50, "windSpeed is too high"),

  // Humidity in %: 0 to 100
  humidity: z
    .number()
    .min(0, "humidity must be >= 0")
    .max(100, "humidity is too high"),

  // Visibility in km: 0 to 100
  visibility: z
    .number()
    .min(0, "visibility must be >= 0")
    .max(100, "visibility is too high"),

  // Precipitation probability in %: 0 to 100
  precipitationProbability: z
    .number()
    .min(0, "precipitationProbability must be >= 0")
    .max(100, "precipitationProbability is too high"),

  // UV index: 0 to 20
  uvIndex: z
    .number()
    .min(0, "uvIndex must be >= 0")
    .max(20, "uvIndex is too high"),

  // Air quality level (optional, see enum)
  airQuality: AirQualityLevelSchema.optional(),
});
export type Weather = z.infer<typeof WeatherSchema>;

/**
 * Helper to validate and construct a Weather object from raw input.
 * Throws if any value is invalid.
 * @param params - Raw weather data (possibly untrusted)
 * @returns Validated Weather object
 * @throws ZodError if invalid input
 */
export function createWeather(params: unknown): Weather {
  return WeatherSchema.parse(params);
}
