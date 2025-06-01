import { OpenMeteoWeatherRepository } from './OpenMeteoWeatherRepository';

test('getWeather returns valid weather', async () => {
  const repo = new OpenMeteoWeatherRepository();
  const w = await repo.getWeather(35.6785, 139.6823, '2025-06-01T12:00:00Z');
  expect(typeof w.temperature).toBe('number');
  expect(w.condition).toBeDefined();
});
