// Date validation constants
const DATE_CONSTANTS = {
  FORMAT_REGEX: /^\d{4}-\d{2}-\d{2}$/,
  MAX_FUTURE_DAYS: 16,
  MAX_LOOKBACK_DAYS: 7,
  MAX_DATE_RANGE_DAYS: 30,
} as const;

/**
 * Validate that a date string is in YYYY-MM-DD format and represents a valid date
 * @param dateString Date string to validate
 * @param fieldName Name of the field for error messages
 * @throws Error if date format is invalid or results in Invalid Date
 */
function validateDateFormat(dateString: string, fieldName: string): void {
  // Check format: YYYY-MM-DD (exactly 10 characters)
  if (!DATE_CONSTANTS.FORMAT_REGEX.test(dateString)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }

  // Check if it results in a valid date
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} is not a valid date`);
  }

  // Additional check: ensure the date string matches what Date constructor parsed
  // This catches cases like "2025-02-30" which gets silently converted
  const [year, month, day] = dateString.split("-").map(Number);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
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

  // Don't allow future dates beyond configured limit
  const maxFutureDate = new Date();
  maxFutureDate.setDate(maxFutureDate.getDate() + DATE_CONSTANTS.MAX_FUTURE_DAYS);

  if (end > maxFutureDate) {
    throw new Error(`endDate cannot be more than ${DATE_CONSTANTS.MAX_FUTURE_DAYS} days in the future`);
  }

  // Limit to maximum configured days for performance
  // Calculate the number of days in the range (inclusive of both dates)
  // For example: 2025-06-01 to 2025-07-01 = 30 days (June has 30 days)
  const daysDiff = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysDiff > DATE_CONSTANTS.MAX_DATE_RANGE_DAYS) {
    throw new Error(`Date range cannot exceed ${DATE_CONSTANTS.MAX_DATE_RANGE_DAYS} days`);
  }

  // Note: We allow queries for old dates even if no data exists
  // The API will return empty array if no records are found
}

/**
 * Validate batch start date - must be within the last 7 days
 * @param startDate Start date in YYYY-MM-DD format
 * @throws Error if start date is invalid
 */
export function validateBatchStartDate(startDate: string): void {
  // Validate date format first
  validateDateFormat(startDate, "startDate");

  const start = new Date(startDate);
  const today = new Date();

  // Set time to start of day for accurate comparison
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // Check if start date is within the configured lookback period (including today)
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - DATE_CONSTANTS.MAX_LOOKBACK_DAYS);

  if (start < weekAgo) {
    throw new Error(`Batch start date must be within the last ${DATE_CONSTANTS.MAX_LOOKBACK_DAYS} days`);
  }

  // Don't allow future dates beyond configured limit
  const maxFutureDate = new Date(today);
  maxFutureDate.setDate(today.getDate() + DATE_CONSTANTS.MAX_FUTURE_DAYS);

  if (start > maxFutureDate) {
    throw new Error(
      `Batch start date cannot be more than ${DATE_CONSTANTS.MAX_FUTURE_DAYS} days in the future`,
    );
  }
}
