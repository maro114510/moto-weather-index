import { D1TouringIndexRepository } from "../infra/D1TouringIndexRepository";
import { WeatherApiWeatherRepository } from "../infra/WeatherApiWeatherRepository";
import { BatchCalculateTouringIndexUsecase } from "../usecase/BatchCalculateTouringIndex";

export function createWeatherRepository(kv?: KVNamespace) {
  return new WeatherApiWeatherRepository(kv);
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

// For backward compatibility
export const weatherRepository = new WeatherApiWeatherRepository();
