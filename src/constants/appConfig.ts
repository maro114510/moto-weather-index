/**
 * Application Configuration Constants
 *
 * Centralized configuration values for consistent usage across the application.
 */

export const APP_CONFIG = {
  // Timezone settings
  DEFAULT_TIMEZONE: "Asia/Tokyo",

  // Weather provider forecast window: WeatherAPI's forecast.json endpoint only
  // returns data for "today" (day 1) through day MAX_FORECAST_DAYS, so the
  // furthest valid forecast date is today + (MAX_FORECAST_DAYS - 1).
  MAX_FORECAST_DAYS: 14,

  // WeatherAPI request policy. `MAX_ATTEMPTS` includes the initial request.
  WEATHER_API_REQUEST_TIMEOUT_MS: 10_000,
  WEATHER_API_MAX_ATTEMPTS: 3,

  // Scheduled batch runs once per 24h (see wrangler.toml crons). Readiness
  // is considered stale after this many hours without a successful run,
  // allowing a grace window beyond one cron cycle for transient delays.
  FRESHNESS_THRESHOLD_HOURS: 26,
} as const;
