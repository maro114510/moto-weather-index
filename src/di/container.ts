import { OpenMeteoWeatherRepository } from '../infra/OpenMeteoWeatherRepository';

export function createWeatherRepository(kv?: KVNamespace) {
  return new OpenMeteoWeatherRepository(kv);
}

// For backward compatibility
export const weatherRepository = new OpenMeteoWeatherRepository();
