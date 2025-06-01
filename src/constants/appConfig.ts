/**
 * Application Configuration Constants
 *
 * Centralized configuration values for consistent usage across the application.
 */

export const APP_CONFIG = {
  // Timezone settings
  DEFAULT_TIMEZONE: "Asia/Tokyo",

  // Cache settings
  CACHE_EXPIRATION_HOURS: 3,

  // API URLs
  OPEN_METEO_API_BASE_URL: "https://api.open-meteo.com/v1",
  OPEN_METEO_FORECAST_ENDPOINT: "/forecast",
} as const;

// Helper to get full API URL
export const getOpenMeteoForecastUrl = () =>
  `${APP_CONFIG.OPEN_METEO_API_BASE_URL}${APP_CONFIG.OPEN_METEO_FORECAST_ENDPOINT}`;
