import { APP_CONFIG } from "../constants/appConfig";
import { D1ScheduledRunRepository } from "../infra/D1ScheduledRunRepository";
import { D1TouringIndexRepository } from "../infra/D1TouringIndexRepository";
import { OpenMeteoGeocodingClient } from "../infra/OpenMeteoGeocodingClient";
import { OpenMeteoWeatherClient } from "../infra/OpenMeteoWeatherClient";
import { WeatherApiWeatherRepository } from "../infra/WeatherApiWeatherRepository";
import { WorkersCacheReadingCache } from "../infra/WorkersCacheReadingCache";
import { BatchCalculateTouringIndexUsecase } from "../usecase/BatchCalculateTouringIndex";
import { CheckScheduledRunReadinessUseCase } from "../usecase/CheckScheduledRunReadiness";
import { RecordScheduledRunOutcomeUseCase } from "../usecase/RecordScheduledRunOutcome";
import {
  type ReadingCache,
  TouringIndexService,
} from "../usecase/TouringIndexService";

export function createWeatherRepository(apiKey?: string) {
  return new WeatherApiWeatherRepository(apiKey);
}

export function createTouringIndexRepository(db: D1Database) {
  return new D1TouringIndexRepository(db);
}

export function createBatchCalculateTouringIndexUsecase(
  weatherRepository: ReturnType<typeof createWeatherRepository>,
  touringIndexRepository: ReturnType<typeof createTouringIndexRepository>,
) {
  return new BatchCalculateTouringIndexUsecase(
    weatherRepository,
    touringIndexRepository,
  );
}

export function createScheduledRunRepository(db: D1Database) {
  return new D1ScheduledRunRepository(db);
}

export function createRecordScheduledRunOutcomeUseCase(
  scheduledRunRepository: ReturnType<typeof createScheduledRunRepository>,
) {
  return new RecordScheduledRunOutcomeUseCase(scheduledRunRepository);
}

export function createCheckScheduledRunReadinessUseCase(
  scheduledRunRepository: ReturnType<typeof createScheduledRunRepository>,
) {
  return new CheckScheduledRunReadinessUseCase(
    scheduledRunRepository,
    APP_CONFIG.FRESHNESS_THRESHOLD_HOURS * 60 * 60 * 1000,
  );
}

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
