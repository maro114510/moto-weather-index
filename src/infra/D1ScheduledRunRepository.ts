import type {
  ScheduledRunRecord,
  ScheduledRunRepository,
  ScheduledRunStatus,
} from "../usecase/RecordScheduledRunOutcome";
import { logger } from "../utils/logger";

interface ScheduledRunRow {
  run_id: string;
  started_at: string;
  finished_at: string;
  status: string;
  expected_count: number;
  committed_count: number;
  failure_count: number;
  duration_ms: number;
  error_summary: string | null;
}

function toRecord(row: ScheduledRunRow): ScheduledRunRecord {
  return {
    runId: row.run_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status as ScheduledRunStatus,
    expectedCount: row.expected_count,
    committedCount: row.committed_count,
    failureCount: row.failure_count,
    durationMs: row.duration_ms,
    errorSummary: row.error_summary ?? undefined,
  };
}

export class D1ScheduledRunRepository implements ScheduledRunRepository {
  constructor(private db: D1Database) {
    logger.info("D1ScheduledRunRepository initialized", {
      operation: "repository_init",
      database: "D1",
    });
  }

  async recordRun(record: ScheduledRunRecord): Promise<void> {
    const context = {
      operation: "record_scheduled_run",
      runId: record.runId,
      status: record.status,
    };

    logger.debug("Recording scheduled run outcome", context);

    const sql = `
      INSERT INTO scheduled_run_log
      (run_id, started_at, finished_at, status, expected_count, committed_count, failure_count, duration_ms, error_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.db
        .prepare(sql)
        .bind(
          record.runId,
          record.startedAt,
          record.finishedAt,
          record.status,
          record.expectedCount,
          record.committedCount,
          record.failureCount,
          record.durationMs,
          record.errorSummary ?? null,
        )
        .run();

      logger.debug("Scheduled run outcome recorded successfully", context);
    } catch (error) {
      logger.error(
        "Failed to record scheduled run outcome",
        {
          ...context,
          sql: sql.replace(/\s+/g, " ").trim(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error as Error,
      );

      throw new Error(
        `Failed to record scheduled run outcome for run ${record.runId}: ${error}`,
      );
    }
  }

  async getLatestRun(): Promise<ScheduledRunRecord | null> {
    const context = { operation: "get_latest_scheduled_run" };

    logger.debug("Fetching latest scheduled run", context);

    const sql = `
      SELECT run_id, started_at, finished_at, status, expected_count, committed_count, failure_count, duration_ms, error_summary
      FROM scheduled_run_log
      ORDER BY finished_at DESC, id DESC
      LIMIT 1
    `;

    try {
      const row = await this.db.prepare(sql).first<ScheduledRunRow>();

      logger.debug("Latest scheduled run fetch completed", {
        ...context,
        found: !!row,
      });

      return row ? toRecord(row) : null;
    } catch (error) {
      logger.error(
        "Failed to fetch latest scheduled run",
        {
          ...context,
          sql: sql.replace(/\s+/g, " ").trim(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error as Error,
      );

      throw new Error(`Failed to fetch latest scheduled run: ${error}`);
    }
  }
}
