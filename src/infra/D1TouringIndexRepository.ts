import type {
  Prefecture,
  TouringIndexBatchItem,
  TouringIndexRepository,
} from "../usecase/BatchCalculateTouringIndex";
import { logger } from "../utils/logger";

interface TouringIndexRecord {
  id: number;
  prefecture_id: number;
  date: string;
  score: number;
  weather_factors_json: string;
  weather_raw_json: string;
  calculated_at: string;
}

export class D1TouringIndexRepository implements TouringIndexRepository {
  constructor(private db: D1Database) {
    logger.info("D1TouringIndexRepository initialized", {
      operation: "repository_init",
      database: "D1",
    });
  }

  /**
   * Atomically insert or update every date in a prefecture range.
   */
  async upsertTouringIndexes(items: TouringIndexBatchItem[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    const context = {
      operation: "upsert_touring_indexes",
      prefecture_id: items[0].prefecture_id,
      recordsCount: items.length,
      firstDate: items[0].date,
      lastDate: items[items.length - 1].date,
    };

    logger.debug("Starting atomic touring index upsert", context);

    const sql = `
      INSERT INTO touring_index_daily
      (prefecture_id, date, score, weather_factors_json, weather_raw_json, calculated_at)
      VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
      ON CONFLICT(prefecture_id, date) DO UPDATE SET
        score = excluded.score,
        weather_factors_json = excluded.weather_factors_json,
        weather_raw_json = excluded.weather_raw_json,
        calculated_at = excluded.calculated_at
    `;

    try {
      const dbStartTime = Date.now();
      const statement = this.db.prepare(sql);
      const results = await this.db.batch(
        items.map((item) =>
          statement.bind(
            item.prefecture_id,
            item.date,
            item.score,
            item.weather_factors_json,
            item.weather_raw_json,
            item.calculated_at || null,
          ),
        ),
      );

      if (
        results.length !== items.length ||
        results.some((result) => !result.success)
      ) {
        throw new Error(
          `D1 batch did not confirm all records: ${results.length}/${items.length} results succeeded`,
        );
      }

      const dbDuration = Date.now() - dbStartTime;

      logger.debug("Atomic touring index upsert completed successfully", {
        ...context,
        operation: "upsert_touring_indexes_success",
        dbDuration,
      });

      return results.length;
    } catch (error) {
      logger.error(
        "Failed to atomically upsert touring index range",
        {
          ...context,
          operation: "upsert_touring_indexes_error",
          sql: sql.replace(/\s+/g, " ").trim(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error as Error,
      );

      throw new Error(
        `Failed to atomically upsert touring index range for prefecture ${items[0].prefecture_id}: ${error}`,
      );
    }
  }

  /**
   * Get all prefectures from the database
   * Returns the complete list of 47 Japanese prefectures
   */
  async getAllPrefectures(): Promise<Prefecture[]> {
    const context = {
      operation: "get_all_prefectures",
    };

    logger.debug("Starting prefectures fetch", context);

    const sql = `
      SELECT id, name_ja, name_en, latitude, longitude
      FROM prefectures
      ORDER BY id
    `;

    try {
      const dbStartTime = Date.now();
      const result = await this.db.prepare(sql).all<Prefecture>();
      const dbDuration = Date.now() - dbStartTime;

      if (!result.results || result.results.length === 0) {
        logger.error("No prefectures found in database", {
          ...context,
          operation: "get_all_prefectures_empty",
          dbDuration,
        });
        throw new Error(
          "No prefectures found in database. Please check if prefectures table is initialized.",
        );
      }

      logger.info("Prefectures fetched successfully", {
        ...context,
        operation: "get_all_prefectures_success",
        dbDuration,
        prefecturesCount: result.results.length,
      });

      return result.results;
    } catch (error) {
      logger.error(
        "Failed to fetch prefectures",
        {
          ...context,
          operation: "get_all_prefectures_error",
          sql: sql.replace(/\s+/g, " ").trim(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error as Error,
      );

      throw new Error(`Failed to fetch prefectures: ${error}`);
    }
  }

  /**
   * Get touring index data for a specific prefecture and date range
   * Useful for validation and testing
   */
  async getTouringIndexByPrefectureAndDateRange(
    prefectureId: number,
    startDate: string,
    endDate: string,
  ): Promise<TouringIndexRecord[]> {
    const context = {
      operation: "get_touring_index_by_range",
      prefecture_id: prefectureId,
      startDate,
      endDate,
    };

    logger.debug("Starting touring index fetch by date range", context);

    const sql = `
      SELECT id, prefecture_id, date, score, weather_factors_json, weather_raw_json, calculated_at
      FROM touring_index_daily
      WHERE prefecture_id = ? AND date >= ? AND date <= ?
      ORDER BY date
    `;

    try {
      const dbStartTime = Date.now();
      const result = await this.db
        .prepare(sql)
        .bind(prefectureId, startDate, endDate)
        .all<TouringIndexRecord>();
      const dbDuration = Date.now() - dbStartTime;

      logger.debug("Touring index fetch by date range completed", {
        ...context,
        operation: "get_touring_index_by_range_success",
        dbDuration,
        recordsCount: result.results?.length || 0,
      });

      return result.results || [];
    } catch (error) {
      logger.error(
        "Failed to fetch touring index data by date range",
        {
          ...context,
          operation: "get_touring_index_by_range_error",
          sql: sql.replace(/\s+/g, " ").trim(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error as Error,
      );

      throw new Error(
        `Failed to fetch touring index data for prefecture ${prefectureId}: ${error}`,
      );
    }
  }

  /**
   * Get count of touring index records for validation
   */
  async getTouringIndexCount(): Promise<number> {
    const context = {
      operation: "get_touring_index_count",
    };

    logger.debug("Starting touring index count", context);

    const sql = "SELECT COUNT(*) as count FROM touring_index_daily";

    try {
      const dbStartTime = Date.now();
      const result = await this.db.prepare(sql).first<{ count: number }>();
      const dbDuration = Date.now() - dbStartTime;
      const count = result?.count || 0;

      logger.debug("Touring index count completed", {
        ...context,
        operation: "get_touring_index_count_success",
        dbDuration,
        count,
      });

      return count;
    } catch (error) {
      logger.error(
        "Failed to get touring index count",
        {
          ...context,
          operation: "get_touring_index_count_error",
          sql: sql.replace(/\s+/g, " ").trim(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error as Error,
      );

      throw new Error(`Failed to get touring index count: ${error}`);
    }
  }

  /**
   * Delete touring index data for a specific date range
   * Useful for cleanup or re-processing
   */
  async deleteTouringIndexByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const context = {
      operation: "delete_touring_index_by_range",
      startDate,
      endDate,
    };

    logger.warn("Starting touring index deletion by date range", context);

    const sql = `
      DELETE FROM touring_index_daily
      WHERE date >= ? AND date <= ?
    `;

    try {
      const dbStartTime = Date.now();
      const result = await this.db.prepare(sql).bind(startDate, endDate).run();
      const dbDuration = Date.now() - dbStartTime;
      const deletedCount = result.changes || 0;

      logger.warn("Touring index deletion completed", {
        ...context,
        operation: "delete_touring_index_by_range_success",
        dbDuration,
        deletedCount,
      });

      return deletedCount;
    } catch (error) {
      logger.error(
        "Failed to delete touring index data by date range",
        {
          ...context,
          operation: "delete_touring_index_by_range_error",
          sql: sql.replace(/\s+/g, " ").trim(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        error as Error,
      );

      throw new Error(
        `Failed to delete touring index data for date range ${startDate} to ${endDate}: ${error}`,
      );
    }
  }
}
