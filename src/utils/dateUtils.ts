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
