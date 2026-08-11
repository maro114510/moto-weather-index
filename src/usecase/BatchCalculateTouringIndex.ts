import { APP_CONFIG } from "../constants/appConfig";
import type { Weather } from "../domain/Weather";
import {
  addDaysToDateString,
  getJstDateString,
  validateBatchStartDate,
} from "../utils/dateUtils";
import { logger } from "../utils/logger";
import { calculateTouringIndex } from "./CalculateTouringIndex";

export interface Prefecture {
  id: number;
  name_ja: string;
  name_en: string;
  latitude: number;
  longitude: number;
}

export interface TouringIndexBatchItem {
  prefecture_id: number;
  date: string; // YYYY-MM-DD format
  score: number;
  weather_factors_json: string;
  weather_raw_json: string;
  calculated_at?: string; // Optional, will use 'now' if not provided
}

export interface BatchProcessResult {
  total_processed: number;
  successful_inserts: number;
  failed_inserts: number;
  errors: Array<{
    prefecture_id: number;
    date: string;
    error: string;
  }>;
}

export interface WeatherRepository {
  getWeather(lat: number, lon: number, datetime: string): Promise<Weather>;
  getWeatherBatch(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
  ): Promise<Weather[]>;
}

export interface TouringIndexRepository {
  upsertTouringIndex(item: TouringIndexBatchItem): Promise<void>;
  getAllPrefectures(): Promise<Prefecture[]>;
}

export class BatchCalculateTouringIndexUsecase {
  constructor(
    private weatherRepository: WeatherRepository,
    private touringIndexRepository: TouringIndexRepository,
  ) {
    logger.info("BatchCalculateTouringIndexUsecase initialized", {
      operation: "usecase_init",
    });
  }

  /**
   * Execute batch processing for all prefectures and specified date range
   * @param targetDates Array of date strings in YYYY-MM-DD format
   * @param maxRetries Maximum retry attempts for failed operations
   * @returns BatchProcessResult with success/failure statistics
   */
  async execute(
    targetDates: string[],
    maxRetries = 3,
  ): Promise<BatchProcessResult> {
    const context = {
      operation: "batch_execute",
      targetDatesCount: targetDates.length,
      maxRetries,
    };

    logger.info("Starting batch processing execution", context);

    const result: BatchProcessResult = {
      total_processed: 0,
      successful_inserts: 0,
      failed_inserts: 0,
      errors: [],
    };

    try {
      // Get all prefectures from database
      logger.dbOperation("getAllPrefectures", "prefectures", context);
      const prefectures = await this.touringIndexRepository.getAllPrefectures();

      result.total_processed = prefectures.length * targetDates.length;

      logger.info("Prefectures loaded for batch processing", {
        ...context,
        prefecturesCount: prefectures.length,
        totalProcessingItems: result.total_processed,
      });

      // Process each prefecture with batch weather API call
      for (const prefecture of prefectures) {
        const prefectureContext = {
          ...context,
          operation: "batch_process_prefecture",
          prefecture: {
            id: prefecture.id,
            name: prefecture.name_en,
            location: {
              lat: prefecture.latitude,
              lon: prefecture.longitude,
            },
          },
        };

        try {
          logger.debug(
            "Processing prefecture with batch weather fetch",
            prefectureContext,
          );

          await this.processPrefectureBatch(
            prefecture,
            targetDates,
            maxRetries,
          );

          result.successful_inserts += targetDates.length;

          logger.debug("Successfully processed prefecture batch", {
            ...prefectureContext,
            operation: "prefecture_batch_success",
            datesProcessed: targetDates.length,
          });
        } catch (error) {
          // If batch processing fails, add errors for all dates
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          for (const date of targetDates) {
            result.failed_inserts++;
            result.errors.push({
              prefecture_id: prefecture.id,
              date,
              error: errorMessage,
            });
          }

          logger.error(
            "Failed to process prefecture batch",
            {
              ...prefectureContext,
              operation: "prefecture_batch_error",
              errorMessage,
              affectedDates: targetDates.length,
            },
            error as Error,
          );
        }
      }

      const successRate =
        result.total_processed > 0
          ? Math.round(
              (result.successful_inserts / result.total_processed) * 100,
            )
          : 0;

      logger.info("Batch processing execution completed", {
        ...context,
        operation: "batch_execute_completed",
        summary: {
          total_processed: result.total_processed,
          successful_inserts: result.successful_inserts,
          failed_inserts: result.failed_inserts,
          success_rate: successRate,
          errors_count: result.errors.length,
        },
      });

      return result;
    } catch (error) {
      logger.error(
        "Batch processing execution failed",
        {
          ...context,
          operation: "batch_execute_failed",
        },
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Process one prefecture for all target dates using batch weather API
   * @param prefecture Prefecture data
   * @param targetDates Array of target dates in YYYY-MM-DD format
   * @param maxRetries Maximum retry attempts
   */
  private async processPrefectureBatch(
    prefecture: Prefecture,
    targetDates: string[],
    maxRetries: number,
  ): Promise<void> {
    const context = {
      operation: "process_prefecture_batch",
      prefecture: {
        id: prefecture.id,
        name: prefecture.name_en,
        location: {
          lat: prefecture.latitude,
          lon: prefecture.longitude,
        },
      },
      datesCount: targetDates.length,
      firstDate: targetDates[0],
      lastDate: targetDates[targetDates.length - 1],
      maxRetries,
    };

    logger.debug("Starting batch processing for prefecture", context);

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptContext = {
        ...context,
        operation: "prefecture_batch_attempt",
        attempt,
      };

      try {
        logger.debug("Batch processing attempt started", attemptContext);

        const startDate = targetDates[0];
        const endDate = targetDates[targetDates.length - 1];

        logger.debug("Fetching batch weather data", {
          ...attemptContext,
          startDate,
          endDate,
        });

        // Get weather data for all dates in one API call
        const weatherDataList = await this.weatherRepository.getWeatherBatch(
          prefecture.latitude,
          prefecture.longitude,
          startDate,
          endDate,
        );

        logger.debug(
          "Batch weather data fetched, processing individual dates",
          {
            ...attemptContext,
            weatherRecordsReceived: weatherDataList.length,
          },
        );

        // Process each date with its corresponding weather data
        for (let i = 0; i < targetDates.length; i++) {
          const date = targetDates[i];
          const weatherData = weatherDataList[i];

          if (!weatherData) {
            throw new Error(`Weather data missing for date: ${date}`);
          }

          logger.debug("Processing individual date", {
            ...attemptContext,
            date,
            weatherCondition: weatherData.condition,
            temperature: weatherData.temperature,
          });

          // Calculate touring index
          const { score, breakdown } = calculateTouringIndex(weatherData);

          logger.debug("Touring index calculated for date", {
            ...attemptContext,
            date,
            score,
            breakdown,
          });

          // Prepare data for database insertion
          const batchItem: TouringIndexBatchItem = {
            prefecture_id: prefecture.id,
            date,
            score,
            weather_factors_json: JSON.stringify(breakdown),
            weather_raw_json: JSON.stringify(weatherData),
          };

          logger.dbOperation("upsertTouringIndex", "touring_index", {
            ...attemptContext,
            date,
            score,
          });

          // Insert/update in database (upsert)
          await this.touringIndexRepository.upsertTouringIndex(batchItem);

          logger.debug("Individual date processing completed successfully", {
            ...attemptContext,
            date,
            score,
          });
        }

        logger.debug("Prefecture batch processing completed successfully", {
          ...attemptContext,
          operation: "prefecture_batch_success",
          datesProcessed: targetDates.length,
        });

        // Success - break retry loop
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const waitTime = 1000 * attempt;

          logger.warn(
            "Batch attempt failed, retrying",
            {
              ...attemptContext,
              operation: "prefecture_batch_retry",
              errorMessage: lastError.message,
              waitTimeMs: waitTime,
              remainingAttempts: maxRetries - attempt,
            },
            lastError,
          );

          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          logger.error(
            "All batch retry attempts exhausted",
            {
              ...attemptContext,
              operation: "prefecture_batch_all_retries_failed",
              errorMessage: lastError.message,
            },
            lastError,
          );
        }
      }
    }

    // All retries failed
    throw lastError || new Error("Unknown error during batch processing");
  }

  /**
   * Generate array of date strings for the next N days from the current
   * Asia/Tokyo business date
   * @param days Number of days to generate (default: APP_CONFIG.MAX_FORECAST_DAYS)
   * @returns Array of date strings in YYYY-MM-DD format
   */
  static generateTargetDates(
    days: number = APP_CONFIG.MAX_FORECAST_DAYS,
  ): string[] {
    const today = getJstDateString();
    // Cap so an explicit `days` argument can never generate a date beyond
    // the provider's forecast boundary (see APP_CONFIG.MAX_FORECAST_DAYS)
    const effectiveDays = Math.max(
      0,
      Math.min(days, APP_CONFIG.MAX_FORECAST_DAYS),
    );
    const dates: string[] = [];

    for (let i = 0; i < effectiveDays; i++) {
      dates.push(addDaysToDateString(today, i));
    }

    return dates;
  }

  /**
   * Generate array of date strings starting from a specific date
   * @param startDate Start date in YYYY-MM-DD format
   * @param days Number of days to generate (default: APP_CONFIG.MAX_FORECAST_DAYS)
   * @returns Array of date strings in YYYY-MM-DD format
   */
  static generateTargetDatesFromStart(
    startDate: string,
    days: number = APP_CONFIG.MAX_FORECAST_DAYS,
  ): string[] {
    // Validate the start date
    validateBatchStartDate(startDate);

    // Cap the range so a custom start date near the provider's forecast
    // boundary can never generate a date beyond it (see APP_CONFIG.MAX_FORECAST_DAYS)
    const maxDate = addDaysToDateString(
      getJstDateString(),
      APP_CONFIG.MAX_FORECAST_DAYS - 1,
    );
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilBoundary =
      Math.floor(
        (new Date(`${maxDate}T00:00:00Z`).getTime() -
          new Date(`${startDate}T00:00:00Z`).getTime()) /
          msPerDay,
      ) + 1;
    const effectiveDays = Math.max(0, Math.min(days, daysUntilBoundary));

    const dates: string[] = [];

    for (let i = 0; i < effectiveDays; i++) {
      dates.push(addDaysToDateString(startDate, i));
    }

    logger.info("Generated target dates from custom start date", {
      operation: "generate_target_dates_from_start",
      startDate,
      days: effectiveDays,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      totalDates: dates.length,
    });

    return dates;
  }
}
