import type { Weather } from "../domain/Weather";
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

      // Process each prefecture for each target date
      for (const prefecture of prefectures) {
        for (const date of targetDates) {
          const itemContext = {
            ...context,
            operation: "batch_process_item",
            prefecture: {
              id: prefecture.id,
              name: prefecture.name_en,
              location: {
                lat: prefecture.latitude,
                lon: prefecture.longitude,
              },
            },
            date,
          };

          try {
            logger.debug("Processing prefecture-date combination", itemContext);

            await this.processOnePrefectureDate(prefecture, date, maxRetries);

            result.successful_inserts++;

            logger.debug("Successfully processed prefecture-date combination", {
              ...itemContext,
              operation: "batch_item_success",
            });
          } catch (error) {
            result.failed_inserts++;
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            result.errors.push({
              prefecture_id: prefecture.id,
              date,
              error: errorMessage,
            });

            logger.error(
              "Failed to process prefecture-date combination",
              {
                ...itemContext,
                operation: "batch_item_error",
                errorMessage,
              },
              error as Error,
            );
          }
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
   * Process one prefecture for one specific date
   * @param prefecture Prefecture data
   * @param date Target date in YYYY-MM-DD format
   * @param maxRetries Maximum retry attempts
   */
  private async processOnePrefectureDate(
    prefecture: Prefecture,
    date: string,
    maxRetries: number,
  ): Promise<void> {
    const context = {
      operation: "process_prefecture_date",
      prefecture: {
        id: prefecture.id,
        name: prefecture.name_en,
        location: {
          lat: prefecture.latitude,
          lon: prefecture.longitude,
        },
      },
      date,
      maxRetries,
    };

    logger.debug("Starting processing for prefecture-date", context);

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const attemptContext = {
        ...context,
        operation: "prefecture_date_attempt",
        attempt,
      };

      try {
        logger.debug("Processing attempt started", attemptContext);

        // Convert date to ISO datetime for weather API (use noon JST)
        const datetime = `${date}T03:00:00Z`; // 12:00 JST = 03:00 UTC

        logger.debug("Fetching weather data", {
          ...attemptContext,
          datetime,
        });

        // Get weather data from API
        const weatherData = await this.weatherRepository.getWeather(
          prefecture.latitude,
          prefecture.longitude,
          datetime,
        );

        logger.debug("Weather data fetched, calculating touring index", {
          ...attemptContext,
          weatherCondition: weatherData.condition,
          temperature: weatherData.temperature,
        });

        // Calculate touring index
        const { score, breakdown } = calculateTouringIndex(weatherData);

        logger.debug("Touring index calculated", {
          ...attemptContext,
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
          score,
        });

        // Insert/update in database (upsert)
        await this.touringIndexRepository.upsertTouringIndex(batchItem);

        logger.debug("Prefecture-date processing completed successfully", {
          ...attemptContext,
          operation: "prefecture_date_success",
          score,
        });

        // Success - break retry loop
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const waitTime = 1000 * attempt;

          logger.warn(
            "Attempt failed, retrying",
            {
              ...attemptContext,
              operation: "prefecture_date_retry",
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
            "All retry attempts exhausted",
            {
              ...attemptContext,
              operation: "prefecture_date_all_retries_failed",
              errorMessage: lastError.message,
            },
            lastError,
          );
        }
      }
    }

    // All retries failed
    throw lastError || new Error("Unknown error during processing");
  }

  /**
   * Generate array of date strings for the next N days from today
   * @param days Number of days to generate (default: 7)
   * @returns Array of date strings in YYYY-MM-DD format
   */
  static generateTargetDates(days = 7): string[] {
    const dates: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);

      // Format as YYYY-MM-DD
      const dateString = targetDate.toISOString().split("T")[0];
      dates.push(dateString);
    }

    return dates;
  }
}
