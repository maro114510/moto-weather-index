// src/interface/handlers/touringIndexHandler.ts
import type { Context } from "hono";
import { z } from "zod";
import { APP_CONFIG } from "../../constants/appConfig";
import { HTTP_STATUS } from "../../constants/httpStatus";
import {
  batchParametersSchema,
  getTouringIndexSchema,
} from "../../dao/touringIndexSchemas";
import {
  createBatchCalculateTouringIndexUsecase,
  createTouringIndexRepository,
  createWeatherRepository,
} from "../../di/container";
import { BatchCalculateTouringIndexUsecase } from "../../usecase/BatchCalculateTouringIndex";
import { calculateTouringIndex } from "../../usecase/CalculateTouringIndex";
import { logger } from "../../utils/logger";

/**
 * Handler for GET /touring-index
 */
export async function getTouringIndex(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.businessLogic("calculate_touring_index_start", requestContext);

  try {
    // Validate query parameters
    const queryParams = getTouringIndexSchema.parse({
      lat: c.req.query("lat"),
      lon: c.req.query("lon"),
      datetime: c.req.query("datetime"),
    });

    const { lat, lon } = queryParams;
    const datetime =
      queryParams.datetime ||
      new Date(
        new Intl.DateTimeFormat("en-US", {
          timeZone: APP_CONFIG.DEFAULT_TIMEZONE,
          hour12: false,
        }).format(new Date()),
      ).toISOString();

    logger.info("Processing touring index request", {
      ...requestContext,
      operation: "touring_index_request",
      location: { lat, lon },
      datetime,
      datetimeSource: queryParams.datetime ? "provided" : "auto_generated",
    });

    // Get KV namespace from environment
    const kv = c.env?.OPEN_METEO_CACHE;
    const weatherRepo = createWeatherRepository(kv);

    const weather = await weatherRepo.getWeather(lat, lon, datetime);
    const { score, breakdown } = calculateTouringIndex(weather);

    const response = {
      location: { lat, lon },
      datetime,
      score,
      factors: breakdown,
    };

    logger.info("Touring index calculated successfully", {
      ...requestContext,
      operation: "touring_index_success",
      location: { lat, lon },
      datetime,
      score,
      weatherCondition: weather.condition,
      temperature: weather.temperature,
    });

    return c.json(response, HTTP_STATUS.OK);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return c.json({ error: errorMessage }, HTTP_STATUS.BAD_REQUEST);
    }
    throw error;
  }
}

/**
 * Handler for GET /touring-index/history
 * (stub example, actual logic needs time-series support)
 */
export async function getTouringIndexHistory(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.warn("History endpoint called but not implemented", {
    ...requestContext,
    operation: "history_not_implemented",
  });

  return c.json({ message: "History feature not implemented yet" }, HTTP_STATUS.OK);
}

/**
 * Handler for POST /touring-index/batch
 * Execute batch calculation for all prefectures for the next 7 days
 */
export async function postTouringIndexBatch(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.businessLogic("batch_calculation_start", requestContext);

  // Get D1 database from environment
  const db = c.env?.DB;
  if (!db) {
    logger.error("Database not available for batch processing", {
      ...requestContext,
      operation: "batch_db_missing",
    });
    return c.json(
      { error: "Database not available" },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }

  try {
    // Validate query parameters
    const { days, maxRetries } = batchParametersSchema.parse({
      days: c.req.query("days"),
      maxRetries: c.req.query("maxRetries"),
    });

    logger.info("Starting batch processing", {
      ...requestContext,
      operation: "batch_processing_start",
      parameters: { days, maxRetries },
    });

    // Create repositories and usecase
    const kv = c.env?.OPEN_METEO_CACHE;
    const weatherRepo = createWeatherRepository(kv);
    const touringIndexRepo = createTouringIndexRepository(db);
    const batchUsecase = createBatchCalculateTouringIndexUsecase(
      weatherRepo,
      touringIndexRepo,
    );

    // Generate target dates (today + next N days)
    const targetDates =
      BatchCalculateTouringIndexUsecase.generateTargetDates(days);

    logger.info("Target dates generated for batch processing", {
      ...requestContext,
      operation: "batch_dates_generated",
      targetDatesCount: targetDates.length,
      firstDate: targetDates[0],
      lastDate: targetDates[targetDates.length - 1],
    });

    // Execute batch processing
    const startTime = Date.now();
    const result = await batchUsecase.execute(targetDates, maxRetries);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const successRate =
      result.total_processed > 0
        ? Math.round((result.successful_inserts / result.total_processed) * 100)
        : 0;

    logger.info("Batch processing completed", {
      ...requestContext,
      operation: "batch_processing_completed",
      duration_ms: duration,
      summary: {
        total_processed: result.total_processed,
        successful_inserts: result.successful_inserts,
        failed_inserts: result.failed_inserts,
        success_rate: successRate,
      },
      errors_count: result.errors.length,
    });

    if (result.errors.length > 0) {
      logger.warn("Batch processing completed with errors", {
        ...requestContext,
        operation: "batch_processing_errors",
        errors: result.errors.slice(0, 10), // Log first 10 errors to avoid overwhelming logs
        total_errors: result.errors.length,
      });
    }

    // Return detailed result
    return c.json({
      status: "completed",
      duration_ms: duration,
      target_dates: targetDates,
      summary: {
        total_processed: result.total_processed,
        successful_inserts: result.successful_inserts,
        failed_inserts: result.failed_inserts,
        success_rate: successRate,
      },
      errors: result.errors.length > 0 ? result.errors.map(err =>
        `Prefecture ${err.prefecture_id} (${err.date}): ${err.error}`
      ) : undefined,
    }, HTTP_STATUS.OK);
  } catch (error) {
    logger.error("Batch processing failed", {
      ...requestContext,
      operation: "batch_processing_failed",
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ error: "Internal server error" }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
