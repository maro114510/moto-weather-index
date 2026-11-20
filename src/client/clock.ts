const JST = "Asia/Tokyo";

/** Today's date in Japan Standard Time, as YYYY-MM-DD. */
export function jstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JST }).format(now);
}

/** The hour of day, 0 to 23, in Japan Standard Time. */
export function jstHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: JST,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

/** Pure UTC arithmetic, so the result never depends on the browser's zone. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
