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
