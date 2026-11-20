/**
 * Application Configuration Constants
 *
 * Centralized configuration values for consistent usage across the application.
 */

export const APP_CONFIG = {
  // Timezone settings
  DEFAULT_TIMEZONE: "Asia/Tokyo",

  // Open-Meteo serves today and the fifteen days after it.
  OPEN_METEO_FORECAST_DAYS: 16,
} as const;
