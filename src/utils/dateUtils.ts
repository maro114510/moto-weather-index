import { APP_CONFIG } from "../constants/appConfig";

/**
 * Get the current calendar date in the app's business timezone (Asia/Tokyo),
 * regardless of the runtime's local/UTC clock.
 * @param date Reference instant (defaults to now)
 * @returns Date string in YYYY-MM-DD format
 */
export function getJstDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_CONFIG.DEFAULT_TIMEZONE,
  }).format(date);
}

/**
 * Add a number of calendar days to a YYYY-MM-DD date string using pure UTC
 * arithmetic, so the result never depends on the runtime's local timezone.
 * @param dateString Date string in YYYY-MM-DD format
 * @param days Number of days to add (may be negative)
 * @returns Date string in YYYY-MM-DD format
 */
export function addDaysToDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

/**
 * Validate that a date string is in YYYY-MM-DD format and represents a valid date
 * @param dateString Date string to validate
 * @param fieldName Name of the field for error messages
 * @throws Error if date format is invalid or results in Invalid Date
 */
function validateDateFormat(dateString: string, fieldName: string): void {
  // Check format: YYYY-MM-DD (exactly 10 characters)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }

  // Check if it results in a valid date
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is not a valid date`);
  }

  // Additional check: ensure the date string matches what Date constructor parsed
  // This catches cases like "2025-02-30" which gets silently converted.
  // Use UTC getters: a date-only string like "2025-06-15" is parsed as UTC
  // midnight, so local getters would misread it on non-UTC hosts.
  const [year, month, day] = dateString.split("-").map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} is not a valid date`);
  }
}

/**
 * Validate that a date range is reasonable for history queries
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @throws Error if date range is invalid
 */
export function validateDateRange(startDate: string, endDate: string): void {
  // Validate date formats first
  validateDateFormat(startDate, "startDate");
  validateDateFormat(endDate, "endDate");

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    throw new Error("startDate must be before endDate");
  }

  // Don't allow dates beyond the provider's forecast window, anchored to the
  // Asia/Tokyo business date (see APP_CONFIG.MAX_FORECAST_DAYS)
  const maxFutureDays = APP_CONFIG.MAX_FORECAST_DAYS - 1;
  const maxFutureDate = new Date(
    `${addDaysToDateString(getJstDateString(), maxFutureDays)}T00:00:00Z`,
  );

  if (end > maxFutureDate) {
    throw new Error(
      `endDate cannot be more than ${maxFutureDays} days in the future`,
    );
  }

  // Limit to maximum 30 days for performance
  // Calculate the number of days in the range (inclusive of both dates)
  // For example: 2025-06-01 to 2025-07-01 = 30 days (June has 30 days)
  const daysDiff = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysDiff > 30) {
    throw new Error("Date range cannot exceed 30 days");
  }

  // Note: We allow queries for old dates even if no data exists
  // The API will return empty array if no records are found
}

/**
 * Validate batch start date - must be within the forecast window
 * @param startDate Start date in YYYY-MM-DD format
 * @throws Error if start date is invalid
 */
export function validateBatchStartDate(startDate: string): void {
  // Validate date format first
  validateDateFormat(startDate, "startDate");

  // Both are already UTC midnight (a date-only string is parsed as such);
  // use UTC accessors throughout so this doesn't depend on the host's local
  // timezone.
  const start = new Date(startDate);
  const today = new Date(`${getJstDateString()}T00:00:00Z`);

  // Set time to start of day for accurate comparison
  start.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);

  if (start < today) {
    throw new Error("Batch start date must be today or later");
  }

  // Don't allow dates beyond the provider's forecast window, anchored to the
  // Asia/Tokyo business date (see APP_CONFIG.MAX_FORECAST_DAYS)
  const maxFutureDays = APP_CONFIG.MAX_FORECAST_DAYS - 1;
  const maxFutureDate = new Date(today);
  maxFutureDate.setUTCDate(today.getUTCDate() + maxFutureDays);

  if (start > maxFutureDate) {
    throw new Error(
      `Batch start date cannot be more than ${maxFutureDays} days in the future`,
    );
  }
}
