import type { Context } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";
import {
  createPlaceSearch,
  createTouringIndexService,
} from "../../di/container";
import type { AppEnv } from "../../types/env";
import { logger } from "../../utils/logger";
import {
  PlaceSearchQuerySchema,
  parseIndexQuery,
  parsePlaceQuery,
} from "../internalApiSchemas";

/** Handler for GET /api/index */
export async function getIndex(c: Context<AppEnv>) {
  const { place, moment } = parseIndexQuery(c.req.query());
  const index = await createTouringIndexService().indexAt(place, moment);

  logger.info("Touring index served", {
    ...(c.get("requestContext") || {}),
    operation: "index_served",
    score: index.score,
    confidence: index.confidence,
  });
  return c.json(index, HTTP_STATUS.OK);
}

/** Handler for GET /api/horizon */
export async function getHorizon(c: Context<AppEnv>) {
  const place = parsePlaceQuery(c.req.query());
  const days = await createTouringIndexService().horizon(place);

  return c.json({ place, days }, HTTP_STATUS.OK);
}

/** Handler for GET /api/places */
export async function searchPlaces(c: Context<AppEnv>) {
  const { q } = PlaceSearchQuerySchema.parse(c.req.query());
  const places = await createPlaceSearch().search(q);

  return c.json({ places }, HTTP_STATUS.OK);
}
