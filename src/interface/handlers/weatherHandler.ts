// src/interface/handlers/weatherHandler.ts
import type { Context } from "hono";
import { z } from "zod";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { getWeatherSchema } from "../../dao/weatherSchemas";
import { createWeatherRepository } from "../../di/container";
import { logger } from "../../utils/logger";

/**
 * Handler for GET /weather
 */
export async function getWeather(c: Context) {
  const requestContext = c.get("requestContext") || {};

  logger.businessLogic("get_weather_start", requestContext);

  try {
    // Validate query parameters
    const queryParams = getWeatherSchema.parse({
      lat: c.req.query("lat"),
      lon: c.req.query("lon"),
      datetime: c.req.query("datetime"),
    });

    const { lat, lon } = queryParams;
    const datetime = queryParams.datetime || new Date().toISOString();

    logger.info("Processing weather request", {
      ...requestContext,
      operation: "weather_request",
      location: { lat, lon },
      datetime,
      datetimeSource: queryParams.datetime ? "provided" : "auto_generated",
    });

    // Get KV namespace from environment
    const kv = c.env?.OPEN_METEO_CACHE;
    const weatherRepo = createWeatherRepository(kv);

    const weather = await weatherRepo.getWeather(lat, lon, datetime);

    logger.info("Weather data retrieved successfully", {
      ...requestContext,
      operation: "weather_success",
      location: { lat, lon },
      datetime,
      weather: {
        condition: weather.condition,
        temperature: weather.temperature,
        windSpeed: weather.windSpeed,
        humidity: weather.humidity,
      },
    });

    return c.json(weather, HTTP_STATUS.OK);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return c.json({ error: errorMessage }, HTTP_STATUS.BAD_REQUEST);
    }
    throw error;
  }
}
