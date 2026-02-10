// src/interface/handlers/touringIndexHandler.ts
import type { Context } from "hono";
import { z } from "zod";
import { APP_CONFIG } from "../../constants/appConfig";
import { HTTP_STATUS } from "../../constants/httpStatus";
import {
  getTouringIndexHistorySchema,
  getTouringIndexSchema,
} from "../../dao/touringIndexSchemas";
import {
  createTouringIndexRepository,
  createWeatherRepository,
} from "../../di/container";
import { HttpError } from "../../domain/HttpError";
import { calculateTouringIndex } from "../../usecase/CalculateTouringIndex";
import { validateDateRange } from "../../utils/dateUtils";
import { logger } from "../../utils/logger";
import {
  calculateDistance,
  findNearestPrefecture,
} from "../../utils/prefectureUtils";

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
    const weatherRepo = createWeatherRepository(kv, c.env?.WEATHERAPI_KEY);

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
      const errorMessage = error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return c.json({ error: errorMessage }, HTTP_STATUS.BAD_REQUEST);
    }

    if (error instanceof HttpError) {
      logger.warn("Touring index request failed with controlled error", {
        ...requestContext,
        operation: "touring_index_error",
        statusCode: error.status,
        errorCode: error.code,
        errorMessage: error.message,
        details: error.details,
      });
      return c.json(
        { error: error.message, requestId: c.get("requestId") },
        error.status as any,
      );
    }
    throw error;
  }
}

/**
 * Handler for GET /touring-index/history
 * Get historical touring index data for a location
 */
export async function getTouringIndexHistory(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.businessLogic("get_touring_index_history_start", requestContext);

  try {
    // Validate query parameters
    const queryParams = getTouringIndexHistorySchema.parse({
      lat: c.req.query("lat"),
      lon: c.req.query("lon"),
      startDate: c.req.query("startDate"),
      endDate: c.req.query("endDate"),
      prefectureId: c.req.query("prefectureId"),
    });

    const { lat, lon, startDate, endDate, prefectureId } = queryParams;

    logger.info("Processing touring index history request", {
      ...requestContext,
      operation: "touring_index_history_request",
      location: { lat, lon },
      dateRange: { startDate, endDate },
      prefectureId,
    });

    // Validate date range
    try {
      validateDateRange(startDate, endDate);
    } catch (error) {
      // Date validation errors should return 400 Bad Request
      const errorMessage =
        error instanceof Error ? error.message : "Invalid date range";
      return c.json({ error: errorMessage }, HTTP_STATUS.BAD_REQUEST);
    }

    // Get D1 database from environment
    const db = c.env?.DB;
    if (!db) {
      logger.error("Database not available for history query", {
        ...requestContext,
        operation: "history_db_missing",
      });
      return c.json(
        { error: "Database not available" },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      );
    }

    const touringIndexRepo = createTouringIndexRepository(db);

    let targetPrefectureId: number;

    if (prefectureId) {
      // Use the specified prefecture ID
      targetPrefectureId = prefectureId;
    } else {
      // Find the nearest prefecture to the given coordinates
      const allPrefectures = await touringIndexRepo.getAllPrefectures();
      const nearestPrefecture = findNearestPrefecture(lat, lon, allPrefectures);
      targetPrefectureId = nearestPrefecture.id;

      logger.info("Found nearest prefecture for coordinates", {
        ...requestContext,
        operation: "nearest_prefecture_found",
        location: { lat, lon },
        nearestPrefecture: {
          id: nearestPrefecture.id,
          name: nearestPrefecture.name_en,
          distance: `${
            Math.round(
              calculateDistance(
                lat,
                lon,
                nearestPrefecture.latitude,
                nearestPrefecture.longitude,
              ) * 100,
            ) / 100
          }km`,
        },
      });
    }

    // Fetch historical data from database
    const historyData =
      await touringIndexRepo.getTouringIndexByPrefectureAndDateRange(
        targetPrefectureId,
        startDate,
        endDate,
      );

    logger.info("Historical data fetched successfully", {
      ...requestContext,
      operation: "history_data_fetched",
      prefectureId: targetPrefectureId,
      recordsCount: historyData.length,
      dateRange: { startDate, endDate },
    });

    // Transform data for response
    const transformedData = historyData.map((record) => {
      let weatherFactors: any = {};

      try {
        weatherFactors = JSON.parse(record.weather_factors_json);
      } catch (error) {
        logger.warn("Failed to parse weather factors JSON", {
          ...requestContext,
          recordId: record.id,
          error: error instanceof Error ? error.message : String(error),
        });
        weatherFactors = {};
      }

      return {
        date: record.date,
        score: record.score,
        factors: weatherFactors,
        calculated_at: record.calculated_at,
      };
    });

    const response = {
      location: { lat, lon },
      prefecture_id: targetPrefectureId,
      data: transformedData,
    };

    logger.info("Touring index history retrieved successfully", {
      ...requestContext,
      operation: "touring_index_history_success",
      prefectureId: targetPrefectureId,
      recordsCount: transformedData.length,
    });

    return c.json(response, HTTP_STATUS.OK);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return c.json({ error: errorMessage }, HTTP_STATUS.BAD_REQUEST);
    }

    logger.error("Touring index history request failed", {
      ...requestContext,
      operation: "touring_index_history_error",
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json(
      { error: "Internal server error" },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
