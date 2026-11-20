import { OpenMeteoGeocodingClient } from "../infra/OpenMeteoGeocodingClient";
import { OpenMeteoWeatherClient } from "../infra/OpenMeteoWeatherClient";
import { WorkersCacheReadingCache } from "../infra/WorkersCacheReadingCache";
import {
  type ReadingCache,
  TouringIndexService,
} from "../usecase/TouringIndexService";

/** The Workers edge cache, or a cache that never hits where the runtime has none. */
function edgeCache(): ReadingCache {
  const cache = (globalThis as { caches?: CacheStorage }).caches?.default;
  return cache
    ? new WorkersCacheReadingCache(cache)
    : { get: async () => undefined, put: async () => {} };
}

export function createTouringIndexService() {
  return new TouringIndexService(new OpenMeteoWeatherClient(), edgeCache());
}

export function createPlaceSearch() {
  return new OpenMeteoGeocodingClient();
}
