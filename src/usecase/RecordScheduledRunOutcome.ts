export type ScheduledRunStatus = "success" | "partial" | "failed";

export interface ScheduledRunRecord {
  runId: string;
  startedAt: string; // ISO 8601
  finishedAt: string; // ISO 8601
  status: ScheduledRunStatus;
  expectedCount: number;
  committedCount: number;
  failureCount: number;
  durationMs: number;
  errorSummary?: string;
}

export interface ScheduledRunRepository {
  recordRun(record: ScheduledRunRecord): Promise<void>;
  getLatestRun(): Promise<ScheduledRunRecord | null>;
}

export interface RecordOutcomeInput {
  runId: string;
  startedAt: string;
  finishedAt: string;
  expectedCount: number;
  committedCount: number;
  failureCount: number;
  durationMs: number;
  errorSummary?: string;
}

export interface RecordFailureInput {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorSummary: string;
}

export class RecordScheduledRunOutcomeUseCase {
  constructor(private repository: ScheduledRunRepository) {}

  /**
   * Records the outcome of a run that reached D1 coverage measurement.
   * Status is derived from actual committed coverage, not from the batch
   * usecase's self-reported counters.
   */
  async recordOutcome(input: RecordOutcomeInput): Promise<ScheduledRunRecord> {
    const status: ScheduledRunStatus =
      input.expectedCount > 0 && input.committedCount >= input.expectedCount
        ? "success"
        : input.committedCount > 0
          ? "partial"
          : "failed";

    const record: ScheduledRunRecord = { ...input, status };
    await this.repository.recordRun(record);
    return record;
  }

  /**
   * Records a run that failed before coverage could be measured (e.g. the
   * batch usecase itself threw before returning a result).
   */
  async recordFailure(input: RecordFailureInput): Promise<ScheduledRunRecord> {
    const record: ScheduledRunRecord = {
      ...input,
      expectedCount: 0,
      committedCount: 0,
      failureCount: 1,
      status: "failed",
    };
    await this.repository.recordRun(record);
    return record;
  }
}
