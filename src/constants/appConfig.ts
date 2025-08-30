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
} as const;
