import { evaluateFreshness } from "../domain/ScheduledRunFreshness";
import type {
  ScheduledRunRecord,
  ScheduledRunRepository,
} from "./RecordScheduledRunOutcome";

export type ReadinessReason =
  | "ok"
  | "no_run_recorded"
  | "incomplete_coverage"
  | "stale";

export interface ReadinessResult {
  ready: boolean;
  reason: ReadinessReason;
  lastRun: ScheduledRunRecord | null;
  ageMs: number | null;
  thresholdMs: number;
}

export class CheckScheduledRunReadinessUseCase {
  constructor(
    private repository: ScheduledRunRepository,
    private thresholdMs: number,
  ) {}

  async check(now: Date = new Date()): Promise<ReadinessResult> {
    const lastRun = await this.repository.getLatestRun();

    if (!lastRun) {
      return {
        ready: false,
        reason: "no_run_recorded",
        lastRun: null,
        ageMs: null,
        thresholdMs: this.thresholdMs,
      };
    }

    if (lastRun.status !== "success") {
      return {
        ready: false,
        reason: "incomplete_coverage",
        lastRun,
        ageMs: null,
        thresholdMs: this.thresholdMs,
      };
    }

    const { isFresh, ageMs } = evaluateFreshness({
      lastRunAt: new Date(lastRun.finishedAt),
      now,
      thresholdMs: this.thresholdMs,
    });

    return {
      ready: isFresh,
      reason: isFresh ? "ok" : "stale",
      lastRun,
      ageMs,
      thresholdMs: this.thresholdMs,
    };
  }
}
