import { RateLimitPolicy, RateLimitRepository } from "../domain/RateLimit";
import { D1TouringIndexRepository } from "../infra/D1TouringIndexRepository";
import { KVRateLimitRepository } from "../infra/KVRateLimitRepository";
import { WeatherApiWeatherRepository } from "../infra/WeatherApiWeatherRepository";
import { createRateLimitMiddleware } from "../interface/middleware/rateLimitMiddleware";
import { BatchCalculateTouringIndexUsecase } from "../usecase/BatchCalculateTouringIndex";
import { EnforceRateLimitUseCase } from "../usecase/EnforceRateLimit";

export function createWeatherRepository(kv?: KVNamespace, apiKey?: string) {
  return new WeatherApiWeatherRepository(kv, apiKey);
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

// Rate Limiting DI Functions
export function createRateLimitRepository(kv: KVNamespace): RateLimitRepository {
  return new KVRateLimitRepository(kv, 300); // 5 minute TTL
}

export function createEnforceRateLimitUseCase(
  repository: RateLimitRepository,
  policy?: RateLimitPolicy
): EnforceRateLimitUseCase {
  const rateLimitPolicy = policy || RateLimitPolicy.standardIPPolicy();
  return new EnforceRateLimitUseCase(repository, rateLimitPolicy);
}

// Factory for complete middleware setup
export function createRateLimitMiddlewareWithKV(kv: KVNamespace) {
  const repository = createRateLimitRepository(kv);
  const useCase = createEnforceRateLimitUseCase(repository);
  return createRateLimitMiddleware(useCase);
}

// For backward compatibility
export const weatherRepository = new WeatherApiWeatherRepository();
