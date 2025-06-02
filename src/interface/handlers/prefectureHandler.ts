// src/interface/handlers/prefectureHandler.ts
import type { Context } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { createTouringIndexRepository } from "../../di/container";
import { logger } from "../../utils/logger";

/**
 * Handler for GET /prefectures
 * Returns a list of all 47 Japanese prefectures
 */
export async function getPrefectures(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.businessLogic("get_prefectures_start", requestContext);

  try {
    // Get D1 database from environment
    const db = c.env?.DB;
    if (!db) {
      logger.error("Database not available for prefecture list", {
        ...requestContext,
        operation: "prefecture_db_missing",
      });
      return c.json(
        { error: "Database not available" },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    const touringIndexRepo = createTouringIndexRepository(db);

    // Fetch all prefectures from database
    const prefectures = await touringIndexRepo.getAllPrefectures();

    logger.info("Prefectures fetched successfully", {
      ...requestContext,
      operation: "prefectures_fetched",
      count: prefectures.length,
    });

    // Return the list of prefectures
    return c.json(
      {
        prefectures: prefectures,
        count: prefectures.length,
      },
      HTTP_STATUS.OK,
    );
  } catch (error) {
    logger.error("Failed to fetch prefecture list", {
      ...requestContext,
      operation: "prefecture_fetch_error",
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json(
      { error: "Internal server error" },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
