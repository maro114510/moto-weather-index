import type { Weather } from "../domain/Weather";

export interface WeatherRepository {
  getWeather(lat: number, lon: number, datetime: string): Promise<Weather>;
}
