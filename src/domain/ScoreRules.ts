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

// Scoring constants for touring index calculation
const SCORING_CONSTANTS = {
  // Weather condition scoring (max 30 points)
  WEATHER: {
    CLEAR: 30,
    MOSTLY_CLEAR: 28,
    PARTLY_CLOUDY: 23,
    CLOUDY: 15,
    OVERCAST: 12,
    FOG: 5,
    PRECIPITATION: 0, // drizzle, rain, snow
    UNKNOWN_FALLBACK: 10,
  },

  // Temperature scoring (max 20 points)
  TEMPERATURE: {
    IDEAL: 21.5,
    MAX_SCORE: 20,
    PENALTY_PER_DEGREE: 1,
    MIN_CELSIUS: -50,
    MAX_CELSIUS: 60,
  },

  // Wind speed scoring (max 15 points)
  WIND: {
    MAX_SCORE: 15,
    MODERATE_SCORE: 10,
    IDEAL_MIN: 1,
    IDEAL_MAX: 4,
    SAFE_MAX: 7,
    MAX_SPEED: 100,
  },

  // Humidity scoring (max 10 points)
  HUMIDITY: {
    MAX_SCORE: 10,
    IDEAL: 50,
    DEVIATION_DIVISOR: 5,
  },

  // Visibility scoring (max 5 points)
  VISIBILITY: {
    EXCELLENT: 15, // km or more
    GOOD: 10, // km
    MODERATE: 6, // km
    SCORE_EXCELLENT: 5,
    SCORE_GOOD: 4,
    SCORE_MODERATE: 2,
    SCORE_POOR: 0,
    MAX_KM: 100,
  },

  // Precipitation probability scoring (max 10 points)
  PRECIPITATION_PROB: {
    MAX_SCORE: 10,
    DIVISOR: 10,
  },

  // UV index scoring (max 5 points)
  UV: {
    SAFE_THRESHOLD: 4,
    MODERATE_THRESHOLD: 6,
    SCORE_SAFE: 5,
    SCORE_MODERATE: 3,
    SCORE_HIGH: 0,
    MAX_INDEX: 20,
  },

  // Air quality scoring (max 5 points)
  AIR_QUALITY: {
    SCORE_LOW: 5,
    SCORE_MEDIUM: 3,
    SCORE_HIGH: 0,
  },
} as const;

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
      return SCORING_CONSTANTS.WEATHER.CLEAR;
    case "mostly_clear":
      return SCORING_CONSTANTS.WEATHER.MOSTLY_CLEAR;
    case "partly_cloudy":
      return SCORING_CONSTANTS.WEATHER.PARTLY_CLOUDY;
    case "cloudy":
      return SCORING_CONSTANTS.WEATHER.CLOUDY;
    case "overcast":
      return SCORING_CONSTANTS.WEATHER.OVERCAST;
    case "fog":
      return SCORING_CONSTANTS.WEATHER.FOG;
    case "drizzle":
    case "rain":
    case "snow":
      return SCORING_CONSTANTS.WEATHER.PRECIPITATION;
    default:
      return SCORING_CONSTANTS.WEATHER.UNKNOWN_FALLBACK;
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
  z.number()
    .min(SCORING_CONSTANTS.TEMPERATURE.MIN_CELSIUS)
    .max(SCORING_CONSTANTS.TEMPERATURE.MAX_CELSIUS)
    .parse(temp);

  const diff = Math.abs(temp - SCORING_CONSTANTS.TEMPERATURE.IDEAL);
  const score =
    SCORING_CONSTANTS.TEMPERATURE.MAX_SCORE -
    diff * SCORING_CONSTANTS.TEMPERATURE.PENALTY_PER_DEGREE;
  return Math.max(
    0,
    Math.min(SCORING_CONSTANTS.TEMPERATURE.MAX_SCORE, Math.round(score)),
  );
}
/**
 * Convert wind speed (m/s) to score (max 15 points).
 * - 1–4 m/s: ideal wind, full points.
 * - 0 m/s or 5–7 m/s: some discomfort, but still rideable.
 * - >7 m/s: dangerous or uncomfortable, no points.
 */
export function windScore(wind: number): number {
  // Type and value validation: 0–100 m/s (extended for daily max values)
  z.number().min(0).max(SCORING_CONSTANTS.WIND.MAX_SPEED).parse(wind);

  if (
    wind >= SCORING_CONSTANTS.WIND.IDEAL_MIN &&
    wind <= SCORING_CONSTANTS.WIND.IDEAL_MAX
  ) {
    return SCORING_CONSTANTS.WIND.MAX_SCORE; // Ideal breeze for touring
  }
  if (
    wind === 0 ||
    (wind > SCORING_CONSTANTS.WIND.IDEAL_MAX &&
      wind <= SCORING_CONSTANTS.WIND.SAFE_MAX)
  ) {
    return SCORING_CONSTANTS.WIND.MODERATE_SCORE; // Either no wind or slightly strong wind
  }
  if (wind > SCORING_CONSTANTS.WIND.SAFE_MAX) {
    return 0; // Too strong, may be unsafe
  }
  return SCORING_CONSTANTS.WIND.MODERATE_SCORE; // Fallback to mid score
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

  const diff = Math.abs(humidity - SCORING_CONSTANTS.HUMIDITY.IDEAL);
  const score =
    SCORING_CONSTANTS.HUMIDITY.MAX_SCORE -
    diff / SCORING_CONSTANTS.HUMIDITY.DEVIATION_DIVISOR;
  return Math.max(
    0,
    Math.min(SCORING_CONSTANTS.HUMIDITY.MAX_SCORE, Math.round(score)),
  );
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
  z.number().min(0).max(SCORING_CONSTANTS.VISIBILITY.MAX_KM).parse(visibility);

  if (visibility >= SCORING_CONSTANTS.VISIBILITY.EXCELLENT) {
    return SCORING_CONSTANTS.VISIBILITY.SCORE_EXCELLENT; // Panoramic view, best for touring
  }
  if (visibility >= SCORING_CONSTANTS.VISIBILITY.GOOD) {
    return SCORING_CONSTANTS.VISIBILITY.SCORE_GOOD; // Good, but not perfect
  }
  if (visibility >= SCORING_CONSTANTS.VISIBILITY.MODERATE) {
    return SCORING_CONSTANTS.VISIBILITY.SCORE_MODERATE; // Average, but still manageable
  }
  return SCORING_CONSTANTS.VISIBILITY.SCORE_POOR; // Poor visibility, not recommended
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

  const score =
    SCORING_CONSTANTS.PRECIPITATION_PROB.MAX_SCORE -
    prob / SCORING_CONSTANTS.PRECIPITATION_PROB.DIVISOR;
  return Math.max(
    0,
    Math.min(SCORING_CONSTANTS.PRECIPITATION_PROB.MAX_SCORE, Math.round(score)),
  );
}

/**
 * Convert UV index to score (max 5 points).
 * - 0–4: comfortable, 5 points.
 * - 5–6: some risk of sunburn, 3 points.
 * - 7 or higher: high risk, 0 points.
 */
export function uvIndexScore(uv: number): number {
  // Type and value validation: 0–20
  z.number().min(0).max(SCORING_CONSTANTS.UV.MAX_INDEX).parse(uv);

  if (uv <= SCORING_CONSTANTS.UV.SAFE_THRESHOLD) {
    return SCORING_CONSTANTS.UV.SCORE_SAFE; // Low UV, no concern
  }
  if (uv <= SCORING_CONSTANTS.UV.MODERATE_THRESHOLD) {
    return SCORING_CONSTANTS.UV.SCORE_MODERATE; // Moderate UV, some caution needed
  }
  return SCORING_CONSTANTS.UV.SCORE_HIGH; // High UV, uncomfortable or risky
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

  if (level === "low" || !level) {
    return SCORING_CONSTANTS.AIR_QUALITY.SCORE_LOW; // No pollen/smog, perfect
  }
  if (level === "medium") {
    return SCORING_CONSTANTS.AIR_QUALITY.SCORE_MEDIUM; // Some discomfort
  }
  return SCORING_CONSTANTS.AIR_QUALITY.SCORE_HIGH; // Bad air, not recommended for outdoor activity
}
