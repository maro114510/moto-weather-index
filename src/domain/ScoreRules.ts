/**
 * Touring Comfort Score Calculation Logic
 * ---------------------------------------
 * This module provides scoring functions for each meteorological factor
 * used to compute a "Touring Comfort Index" (0-100) for motorcycle trips.
 * Each function translates a weather parameter into a weighted subscore
 * based on how favorable it is for motorcycling, and the sum determines
 * the overall index.
 *
 * Overall Formula:
 *   Touring Index (0-100) =
 *     weatherScore (max 30)
 *   + temperatureScore (max 20)
 *   + windScore (max 15)
 *   + humidityScore (max 10)
 *   + visibilityScore (max 5)
 *   + precipitationProbabilityScore (max 10)
 *   + uvIndexScore (max 5)
 *   + airQualityScore (max 5)
 *
 * Each scoring function below maps raw weather input to a subscore,
 * according to motorcycle touring best practices and physical comfort.
 */

import { z } from "zod";
import type { AirQualityLevel, WeatherCondition } from "./Weather";

/**
 * Zod schema for weather condition.
 */
const _WeatherConditionSchema = z.enum([
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

/**
 * Zod schema for air quality level.
 */
const AirQualityLevelSchema = z.enum(["low", "medium", "high"]);

/**
 * Convert weather condition to score (max 30 points).
 * - 'clear': ideal, full 30 points.
 * - 'mostly_clear': almost ideal, 28 points.
 * - 'partly_cloudy': good, 23 points.
 * - 'cloudy': less ideal, partial score.
 * - 'overcast': overcast sky, reduced score.
 * - 'fog': poor visibility, very low score.
 * - 'drizzle'/'rain'/'snow': not suitable, 0 points.
 * - 'unknown': fallback score, 10 points.
 */
export function weatherScore(condition: WeatherCondition): number {
  switch (condition) {
    case "clear":
      return 30;
    case "mostly_clear":
      return 28;
    case "partly_cloudy":
      return 23;
    case "cloudy":
      return 15;
    case "overcast":
      return 12;
    case "fog":
      return 5;
    case "drizzle":
    case "rain":
    case "snow":
      return 0;
    default:
      return 10; // unknown fallback score
  }
}

/**
 * Convert temperature (°C) to score (max 20 points).
 * - Ideal range is 18–25°C, center at 21.5°C.
 * - Deduct 1 point for each 1°C deviation from 21.5.
 * - Never returns less than 0 or more than 20.
 *   (e.g. 21.5°C = 20pts, 16.5°C/26.5°C = 15pts,
 */
export function temperatureScore(temp: number): number {
  // Type and value validation: -50°C to 60°C
  z.number().min(-50).max(60).parse(temp);

  const ideal = 21.5;
  const diff = Math.abs(temp - ideal);
  const score = 20 - diff * 1; // 1 point per degree deviation
  return Math.max(0, Math.min(20, Math.round(score)));
}
/**
 * Convert wind speed (m/s) to score (max 15 points).
 * - 1–4 m/s: ideal wind, full points.
 * - 0 m/s or 5–7 m/s: some discomfort, but still rideable.
 * - >7 m/s: dangerous or uncomfortable, no points.
 */
export function windScore(wind: number): number {
  // Type and value validation: 0–100 m/s (extended for daily max values)
  z.number().min(0).max(100).parse(wind);

  if (wind >= 1 && wind <= 4) return 15; // Ideal breeze for touring
  if (wind === 0 || (wind > 4 && wind <= 7)) return 10; // Either no wind or slightly strong wind
  if (wind > 7) return 0; // Too strong, may be unsafe
  return 10; // For negative/invalid input, fallback to mid score
}

/**
 * Convert relative humidity (%) to score (max 10 points).
 * - Ideal is 40–60% (centered at 50%).
 * - Deduct 1 point for every 5% deviation from 50%.
 * - Minimum 0, maximum 10.
 */
export function humidityScore(humidity: number): number {
  // Type and value validation: 0–100%
  z.number().min(0).max(100).parse(humidity);

  const diff = Math.abs(humidity - 50);
  const score = 10 - diff / 5;
  return Math.max(0, Math.min(10, Math.round(score)));
}

/**
 * Convert visibility (km) to score (max 5 points).
 * - 15km or more: best, 5 points.
 * - 10–14km: good, 4 points.
 * - 6–9km: moderate, 2 points.
 * - <6km: poor, 0 points.
 */
export function visibilityScore(visibility: number): number {
  // Type and value validation: 0–100km
  z.number().min(0).max(100).parse(visibility);

  if (visibility >= 15) return 5; // Panoramic view, best for touring
  if (visibility >= 10) return 4; // Good, but not perfect
  if (visibility >= 6) return 2; // Average, but still manageable
  return 0; // Poor visibility, not recommended
}

/**
 * Convert precipitation probability (%) to score (max 10 points).
 * - 0% chance = 10 points (ideal).
 * - Subtract 1 point for every 10% chance of precipitation.
 * - e.g. 30% = 7pts, 50% = 5pts, 100% = 0pts.
 */
export function precipitationProbabilityScore(prob: number): number {
  // Type and value validation: 0–100%
  z.number().min(0).max(100).parse(prob);

  const score = 10 - prob / 10;
  return Math.max(0, Math.min(10, Math.round(score)));
}

/**
 * Convert UV index to score (max 5 points).
 * - 0–4: comfortable, 5 points.
 * - 5–6: some risk of sunburn, 3 points.
 * - 7 or higher: high risk, 0 points.
 */
export function uvIndexScore(uv: number): number {
  // Type and value validation: 0–20
  z.number().min(0).max(20).parse(uv);

  if (uv <= 4) return 5; // Low UV, no concern
  if (uv <= 6) return 3; // Moderate UV, some caution needed
  return 0; // High UV, uncomfortable or risky
}

/**
 * Convert air quality/pollen level to score (max 5 points).
 * - 'low': ideal, 5 points.
 * - 'medium': moderate, 3 points.
 * - 'high': bad, 0 points.
 * - undefined: treat as 'low' (best case).
 */
export function airQualityScore(level: AirQualityLevel | undefined): number {
  // Allow undefined (treat as 'low'), otherwise must be valid
  if (level !== undefined) {
    AirQualityLevelSchema.parse(level);
  }

  if (level === "low" || !level) return 5; // No pollen/smog, perfect
  if (level === "medium") return 3; // Some discomfort
  return 0; // Bad air, not recommended for outdoor activity
}
