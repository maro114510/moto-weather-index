// Domain Layer - Scheduled Run Freshness Rule

export interface FreshnessCheckInput {
  lastRunAt: Date;
  now: Date;
  thresholdMs: number;
}

export interface FreshnessResult {
  isFresh: boolean;
  ageMs: number;
}

export function evaluateFreshness({
  lastRunAt,
  now,
  thresholdMs,
}: FreshnessCheckInput): FreshnessResult {
  const ageMs = now.getTime() - lastRunAt.getTime();
  return { isFresh: ageMs <= thresholdMs, ageMs };
}
