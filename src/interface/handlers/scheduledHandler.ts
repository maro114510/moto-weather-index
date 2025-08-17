import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  validateCloudflareBindings,
  validateEnvironment,
} from "../../config/environmentValidation";
import {
  createBatchCalculateTouringIndexUsecase,
  createTouringIndexRepository,
  createWeatherRepository,
} from "../../di/container";
import { BatchCalculateTouringIndexUsecase } from "../../usecase/BatchCalculateTouringIndex";
import { logger } from "../../utils/logger";

interface Env {
  OPEN_METEO_CACHE?: KVNamespace;
  DB?: D1Database;
  BATCH_START_DATE?: string; // Optional custom start date for batch processing (YYYY-MM-DD format)
}

export async function scheduledHandler(
  _controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  logger.info("Starting scheduled batch calculation", {
    operation: "batch_processing",
    timestamp: new Date().toISOString(),
  });

  try {
    // Validate environment bindings
    let validatedBindings: ReturnType<typeof validateCloudflareBindings>;
    let validatedEnv: ReturnType<typeof validateEnvironment>;

    try {
      validatedBindings = validateCloudflareBindings(env);
      validatedEnv = validateEnvironment(env);
    } catch (error) {
      logger.error("Environment validation failed in scheduled handler", {
        operation: "scheduled_env_validation_error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // Default parameters for scheduled execution
    const days = 16; // Calculate for next 16 days
    const maxRetries = 3;

    // Create repositories and usecase
    const weatherRepo = createWeatherRepository(
      validatedBindings.OPEN_METEO_CACHE,
    );
    const touringIndexRepo = createTouringIndexRepository(validatedBindings.DB);
    const batchUsecase = createBatchCalculateTouringIndexUsecase(
      weatherRepo,
      touringIndexRepo,
    );

    // Generate target dates - use custom start date if provided
    let targetDates: string[];
    if (validatedEnv.BATCH_START_DATE) {
      logger.info("Using custom start date for batch processing", {
        operation: "batch_processing",
        startDate: validatedEnv.BATCH_START_DATE,
      });
      targetDates =
        BatchCalculateTouringIndexUsecase.generateTargetDatesFromStart(
          validatedEnv.BATCH_START_DATE,
          days,
        );
    } else {
      logger.info("Using default start date for batch processing", {
        operation: "batch_processing",
        startDate: "today",
      });
      targetDates = BatchCalculateTouringIndexUsecase.generateTargetDates(days);
    }

    logger.info("Starting batch processing", {
      operation: "batch_processing",
      days,
      totalDates: targetDates.length,
      dateRange: {
        from: targetDates[0],
        to: targetDates[targetDates.length - 1],
      },
    });

    // Execute batch processing
    const startTime = Date.now();
    const result = await batchUsecase.execute(targetDates, maxRetries);
    const endTime = Date.now();
    const duration = endTime - startTime;

    logger.info("Batch processing completed", {
      operation: "batch_processing",
      duration,
      summary: {
        successfulInserts: result.successful_inserts,
        totalProcessed: result.total_processed,
      },
    });

    if (result.errors.length > 0) {
      logger.warn("Batch processing completed with errors", {
        operation: "batch_processing",
        errorCount: result.errors.length,
        errors: result.errors,
      });
    }
  } catch (error) {
    logger.error(
      "Scheduled batch processing failed",
      { timestamp: new Date().toISOString(), env },
      error as Error,
    );
    throw error; // Re-throw to mark the execution as failed
  }
}
