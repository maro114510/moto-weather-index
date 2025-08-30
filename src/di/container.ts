import { D1TouringIndexRepository } from "../infra/D1TouringIndexRepository";
import { OpenMeteoWeatherRepository } from "../infra/OpenMeteoWeatherRepository";
import { BatchCalculateTouringIndexUsecase } from "../usecase/BatchCalculateTouringIndex";

export function createWeatherRepository(kv?: KVNamespace, apiKey?: string) {
  return new OpenMeteoWeatherRepository(kv, apiKey);
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
