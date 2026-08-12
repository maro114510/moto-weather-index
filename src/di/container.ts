import { APP_CONFIG } from "../constants/appConfig";
import { D1ScheduledRunRepository } from "../infra/D1ScheduledRunRepository";
import { D1TouringIndexRepository } from "../infra/D1TouringIndexRepository";
import { WeatherApiWeatherRepository } from "../infra/WeatherApiWeatherRepository";
import { BatchCalculateTouringIndexUsecase } from "../usecase/BatchCalculateTouringIndex";
import { CheckScheduledRunReadinessUseCase } from "../usecase/CheckScheduledRunReadiness";
import { RecordScheduledRunOutcomeUseCase } from "../usecase/RecordScheduledRunOutcome";

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
