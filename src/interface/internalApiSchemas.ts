import { z } from "zod";
import { APP_CONFIG } from "../constants/appConfig";
import { addDaysToDateString, getJstDateString } from "../utils/dateUtils";

const NUMERIC_INPUT_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function coordinate(name: string, limit: number) {
  return z
    .string()
    .max(32)
    .regex(NUMERIC_INPUT_PATTERN, `${name} must be a valid number`)
    .transform(Number)
    .refine(
      (value) => Math.abs(value) <= limit,
      `${name} must be between -${limit} and ${limit}`,
    );
}

/** Open-Meteo forecasts reach today and the fifteen days after it. */
const LAST_FORECAST_OFFSET_DAYS = APP_CONFIG.OPEN_METEO_FORECAST_DAYS - 1;

const PlaceQuerySchema = z.object({
  lat: coordinate("lat", 90),
  lon: coordinate("lon", 180),
  name: z.string().min(1).max(100).optional(),
});

/** A place named by the rider, or by its coordinates when the rider gave no name. */
function toPlace(q: z.infer<typeof PlaceQuerySchema>) {
  return {
    name: q.name ?? `${q.lat},${q.lon}`,
    latitude: q.lat,
    longitude: q.lon,
  };
}

export function parsePlaceQuery(query: Record<string, string | undefined>) {
  return toPlace(PlaceQuerySchema.parse(query));
}

export function parseIndexQuery(
  query: Record<string, string | undefined>,
  now: Date = new Date(),
) {
  const today = getJstDateString(now);
  const lastDate = addDaysToDateString(today, LAST_FORECAST_OFFSET_DAYS);
  const currentHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_CONFIG.DEFAULT_TIMEZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );

  const q = PlaceQuerySchema.extend({
    date: z.iso
      .date()
      .refine((d) => d >= today && d <= lastDate, {
        message: `date must be from ${today} to ${lastDate}`,
      })
      .default(today),
    hour: z
      .string()
      .regex(/^\d{1,2}$/, "hour must be an integer")
      .transform(Number)
      .refine((h) => h >= 0 && h <= 23, "hour must be from 0 to 23")
      .default(currentHour),
  }).parse(query);

  return {
    place: toPlace(q),
    moment: { type: "moment", date: q.date, hour: q.hour } as const,
  };
}

export const PlaceSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});
