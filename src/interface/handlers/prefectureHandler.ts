// src/interface/handlers/prefectureHandler.ts
import type { Context } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { createTouringIndexRepository } from "../../di/container";
import type { AppEnv } from "../../types/env";
import { logger } from "../../utils/logger";

/**
 * Handler for GET /prefectures
 * Returns a list of all 47 Japanese prefectures
 */
export async function getPrefectures(c: Context<AppEnv>) {
  const requestContext = c.get("requestContext") || {};

  logger.businessLogic("get_prefectures_start", requestContext);

  // Get D1 database from environment
  const db = c.env.DB;
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
}
