import type { ExecutionContext } from "@cloudflare/workers-types";
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
}

export async function scheduledHandler(
  _controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  console.log(
    "Starting scheduled batch calculation at",
    new Date().toISOString(),
  );

  try {
    // Check if database is available
    if (!env.DB) {
      throw new Error("Database not available in scheduled environment");
    }

    // Default parameters for scheduled execution
    const days = 16; // Calculate for next 16 days
    const maxRetries = 3;

    // Create repositories and usecase
    const weatherRepo = createWeatherRepository(env.OPEN_METEO_CACHE);
    const touringIndexRepo = createTouringIndexRepository(env.DB);
    const batchUsecase = createBatchCalculateTouringIndexUsecase(
      weatherRepo,
      touringIndexRepo,
    );

    // Generate target dates
    const targetDates =
      BatchCalculateTouringIndexUsecase.generateTargetDates(days);

    console.log(
      `Starting batch processing for ${days} days (${targetDates.length} dates)...`,
    );

    // Execute batch processing
    const startTime = Date.now();
    const result = await batchUsecase.execute(targetDates, maxRetries);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`Batch processing completed in ${duration}ms`);
    console.log(
      `Summary: ${result.successful_inserts}/${result.total_processed} successful inserts`,
    );

    if (result.errors.length > 0) {
      console.warn("Batch processing completed with errors:", result.errors);
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
