import type { Weather } from "../domain/Weather";

export interface WeatherRepository {
  getWeather(lat: number, lon: number, datetime: string): Promise<Weather>;

  // Batch method to get weather data for multiple days at once
  getWeatherBatch(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
  ): Promise<Weather[]>;
}
