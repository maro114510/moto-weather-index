// src/interface/handlers/weatherHandler.ts
import { Context } from "hono";
import { weatherRepository } from "../../di/container";

/**
 * Handler for GET /weather
 */
export async function getWeather(c: Context) {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  const datetime = c.req.query("datetime") || new Date().toISOString();

  if (isNaN(lat) || isNaN(lon)) {
    return c.json({ error: "lat and lon are required and must be numbers" }, 400);
  }

  try {
    const weather = await weatherRepository.getWeather(lat, lon, datetime);
    return c.json(weather);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
}
