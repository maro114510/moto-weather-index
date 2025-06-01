export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'unknown';

export interface Weather {
  datetime: string; // ISO8601
  condition: WeatherCondition;
  temperature: number; // ℃
  windSpeed: number;   // m/s
  humidity: number;    // %
  visibility: number;  // km
  precipitationProbability: number; // %
  uvIndex: number;
  pm25?: number;
}
