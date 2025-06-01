// src/interface/handlers/weatherHandler.ts
import type { Context } from "hono";
import { createWeatherRepository } from "../../di/container";

/**
 * Handler for GET /weather
 */
export async function getWeather(c: Context) {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  const datetime = c.req.query("datetime") || new Date().toISOString();

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return c.json(
      { error: "lat and lon are required and must be numbers" },
      400,
    );
  }

  try {
    // Get KV namespace from environment
    const kv = c.env?.OPEN_METEO_CACHE;
    const weatherRepo = createWeatherRepository(kv);

    const weather = await weatherRepo.getWeather(lat, lon, datetime);
    return c.json(weather);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
}
