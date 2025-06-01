// src/interface/handlers/touringIndexHandler.ts
import { Context } from "hono";
import { weatherRepository } from "../../di/container";
import { calculateTouringIndex } from "../../usecase/CalculateTouringIndex";

/**
 * Handler for GET /touring-index
 */
export async function getTouringIndex(c: Context) {
  const lat = Number(c.req.query("lat"));
  const lon = Number(c.req.query("lon"));
  const datetime = c.req.query("datetime") || new Date().toISOString();

  if (isNaN(lat) || isNaN(lon)) {
    return c.json({ error: "lat and lon are required and must be numbers" }, 400);
  }

  try {
    const weather = await weatherRepository.getWeather(lat, lon, datetime);
    const { score, breakdown } = calculateTouringIndex(weather);
    return c.json({
      location: { lat, lon },
      datetime,
      score,
      factors: breakdown,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
}

/**
 * Handler for GET /touring-index/history
 * (stub example, actual logic needs time-series support)
 */
export async function getTouringIndexHistory(c: Context) {
  return c.json({ message: "History feature not implemented yet" });
}

/**
 * Handler for POST /touring-index/batch
 * (stub example, actual logic needs array input handling)
 */
export async function postTouringIndexBatch(c: Context) {
  return c.json({ message: "Batch feature not implemented yet" });
}
