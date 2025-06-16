/**
 * Validate that a date range is reasonable for history queries
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @throws Error if date range is invalid
 */
export function validateDateRange(startDate: string, endDate: string): void {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start > end) {
    throw new Error("startDate must be before endDate");
  }

  // Don't allow future dates beyond 16 days from today
  const maxFutureDate = new Date();
  maxFutureDate.setDate(maxFutureDate.getDate() + 16);

  if (end > maxFutureDate) {
    throw new Error("endDate cannot be more than 16 days in the future");
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
 * Validate batch start date - must be within the last 7 days
 * @param startDate Start date in YYYY-MM-DD format
 * @throws Error if start date is invalid
 */
export function validateBatchStartDate(startDate: string): void {
  const start = new Date(startDate);
  const today = new Date();

  // Set time to start of day for accurate comparison
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // Check if start date is within the last 7 days (including today)
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  if (start < weekAgo) {
    throw new Error("Batch start date must be within the last 7 days");
  }

  // Don't allow future dates beyond 16 days from today
  const maxFutureDate = new Date(today);
  maxFutureDate.setDate(today.getDate() + 16);

  if (start > maxFutureDate) {
    throw new Error(
      "Batch start date cannot be more than 16 days in the future",
    );
  }
}
