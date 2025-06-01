import axios from 'axios';
import { Weather, WeatherCondition } from '../domain/Weather';
import { WeatherRepository } from './WeatherRepository';

// Open-Meteo weather code
function mapWeatherCode(code: number): WeatherCondition {
  if ([0, 1].includes(code)) return 'clear';
  if ([2, 3, 45, 48].includes(code)) return 'cloudy';
  if ([61, 63, 65, 80, 81, 82, 51, 53, 55, 56, 57].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  return 'unknown';
}

export class OpenMeteoWeatherRepository implements WeatherRepository {
  async getWeather(lat: number, lon: number, datetime: string): Promise<Weather> {
    const date = datetime.slice(0, 10);
    const hour = Number(datetime.slice(11, 13));

    const params = {
      latitude: lat,
      longitude: lon,
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'windspeed_10m',
        'visibility',
        'precipitation_probability',
        'weathercode',
        'uv_index',
        // 'pm25', // Open-Meteo does not provide PM2.5 data
      ].join(','),
      start_date: date,
      end_date: date,
      timezone: 'UTC',
    };

    const res = await axios.get('https://api.open-meteo.com/v1/forecast', { params });

    const h = res.data.hourly;
    const idx = h.time.findIndex((t: string) => t.startsWith(date) && Number(t.slice(11, 13)) === hour);

    if (idx === -1) throw new Error('Weather data not found for specified time');

    return {
      datetime,
      condition: mapWeatherCode(h.weathercode[idx]),
      temperature: h.temperature_2m[idx],
      windSpeed: h.windspeed_10m[idx],
      humidity: h.relative_humidity_2m[idx],
      visibility: h.visibility[idx] / 1000, // m→km
      precipitationProbability: h.precipitation_probability[idx],
      uvIndex: h.uv_index[idx],
      // pm25: ...
    };
  }
}
