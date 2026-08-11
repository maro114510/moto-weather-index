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

  // Weather data defaults
  DEFAULT_VISIBILITY_KM: 20, // Default visibility in kilometers for daily weather data

  // Weather provider forecast window: WeatherAPI's forecast.json endpoint only
  // returns data for "today" (day 1) through day MAX_FORECAST_DAYS, so the
  // furthest valid forecast date is today + (MAX_FORECAST_DAYS - 1).
  MAX_FORECAST_DAYS: 14,

  // API URLs
  OPEN_METEO_API_BASE_URL: "https://api.open-meteo.com/v1",
  OPEN_METEO_FORECAST_ENDPOINT: "/forecast",
} as const;

// Helper to get full API URL
export const getOpenMeteoForecastUrl = () =>
  `${APP_CONFIG.OPEN_METEO_API_BASE_URL}${APP_CONFIG.OPEN_METEO_FORECAST_ENDPOINT}`;
