import type { ExecutionContext } from "@cloudflare/workers-types";
import { APP_CONFIG } from "../../constants/appConfig";
import {
  createBatchCalculateTouringIndexUsecase,
  createRecordScheduledRunOutcomeUseCase,
  createScheduledRunRepository,
  createTouringIndexRepository,
  createWeatherRepository,
} from "../../di/container";
import type { AppEnv } from "../../types/env";
import { BatchCalculateTouringIndexUsecase } from "../../usecase/BatchCalculateTouringIndex";
import { logger } from "../../utils/logger";

export async function scheduledHandler(
  _controller: ScheduledController,
  env: AppEnv["Bindings"],
  _ctx: ExecutionContext,
): Promise<void> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  logger.info("Starting scheduled batch calculation", {
    operation: "batch_processing",
    runId,
    timestamp: startedAt,
  });

  const scheduledRunRepo = createScheduledRunRepository(env.DB);
  const recordOutcomeUseCase =
    createRecordScheduledRunOutcomeUseCase(scheduledRunRepo);

  let outcomeRecorded = false;

  try {
    // Default parameters for scheduled execution
    const days = APP_CONFIG.MAX_FORECAST_DAYS;

    // Create repositories and usecase
    const weatherRepo = createWeatherRepository(env.WEATHERAPI_KEY);
    const touringIndexRepo = createTouringIndexRepository(env.DB);
    const batchUsecase = createBatchCalculateTouringIndexUsecase(
      weatherRepo,
      touringIndexRepo,
    );

    // Generate target dates - use custom start date if provided
    let targetDates: string[];
    if (env.BATCH_START_DATE) {
      logger.info("Using custom start date for batch processing", {
        operation: "batch_processing",
        runId,
        startDate: env.BATCH_START_DATE,
      });
      targetDates =
        BatchCalculateTouringIndexUsecase.generateTargetDatesFromStart(
          env.BATCH_START_DATE,
          days,
        );
    } else {
      logger.info("Using default start date for batch processing", {
        operation: "batch_processing",
        runId,
        startDate: "today",
      });
      targetDates = BatchCalculateTouringIndexUsecase.generateTargetDates(days);
    }

    logger.info("Starting batch processing", {
      operation: "batch_processing",
      runId,
      days,
      totalDates: targetDates.length,
      dateRange: {
        from: targetDates[0],
        to: targetDates[targetDates.length - 1],
      },
    });

    // Execute batch processing
    const result = await batchUsecase.execute(targetDates);

    // Measure actual D1 coverage rather than trusting the usecase's own
    // success/failure counters, which are only accurate at whole-prefecture
    // granularity (see #107). Filtering by this run's start time (rather
    // than counting any row in the date range) matters: without it, rows
    // left over from a previous successful run would mask a partial
    // failure in this run for overlapping dates.
    const committedCount = await touringIndexRepo.getCommittedCoverageCount(
      targetDates[0],
      targetDates[targetDates.length - 1],
      startedAt,
    );

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    const outcome = await recordOutcomeUseCase.recordOutcome({
      runId,
      startedAt,
      finishedAt,
      expectedCount: result.total_processed,
      committedCount,
      failureCount: result.errors.length,
      durationMs,
      errorSummary:
        result.errors.length > 0
          ? `${result.errors.length} prefecture batch(es) failed`
          : undefined,
    });
    outcomeRecorded = true;

    logger.info("Batch processing completed", {
      operation: "batch_processing",
      runId,
      duration: durationMs,
      summary: {
        successfulInserts: result.successful_inserts,
        totalProcessed: result.total_processed,
        committedCount,
        status: outcome.status,
      },
    });

    if (result.errors.length > 0) {
      logger.warn("Batch processing completed with errors", {
        operation: "batch_processing",
        runId,
        errorCount: result.errors.length,
        errors: result.errors,
      });

      // Incomplete coverage must fail the scheduled invocation so Cloudflare
      // reports the run as failed instead of a silent partial success.
      throw new Error(
        `Scheduled batch processing incomplete: ${result.failed_inserts}/${result.total_processed} records failed`,
      );
    }
  } catch (error) {
    // If the batch failed before an outcome could be measured (e.g. the
    // usecase itself rejected), record a best-effort failure so the run is
    // still visible to the readiness check and correlatable by runId.
    if (!outcomeRecorded) {
      try {
        await recordOutcomeUseCase.recordFailure({
          runId,
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          errorSummary: error instanceof Error ? error.message : String(error),
        });
      } catch (recordError) {
        logger.error(
          "Failed to record scheduled run failure outcome",
          { operation: "batch_processing", runId },
          recordError as Error,
        );
      }
    }

    logger.error(
      "Scheduled batch processing failed",
      {
        runId,
        timestamp: new Date().toISOString(),
        hasDb: !!env.DB,
        hasWeatherApiKey: !!env.WEATHERAPI_KEY,
        hasBatchStartDate: !!env.BATCH_START_DATE,
      },
      error as Error,
    );
    throw error; // Re-throw to mark the execution as failed
  }
}
