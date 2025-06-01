import axios from "axios";
import type { Weather, WeatherCondition } from "../domain/Weather";
import type { WeatherRepository } from "./WeatherRepository";
import { APP_CONFIG, getOpenMeteoForecastUrl } from "../constants/appConfig";
import { logger } from "../utils/logger";

// Open-Meteo weather code
function mapWeatherCode(code: number): WeatherCondition {
  if ([0, 1].includes(code)) return "clear";
  if ([2, 3, 45, 48].includes(code)) return "cloudy";
  if ([61, 63, 65, 80, 81, 82, 51, 53, 55, 56, 57].includes(code))
    return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  return "unknown";
}

export class OpenMeteoWeatherRepository implements WeatherRepository {
  private kv?: KVNamespace;
  private readonly cacheExpirationSeconds = APP_CONFIG.CACHE_EXPIRATION_HOURS * 60 * 60;

  constructor(kv?: KVNamespace) {
    this.kv = kv;
    logger.info("OpenMeteoWeatherRepository initialized", {
      operation: "repository_init",
      cacheEnabled: !!kv,
      cacheExpirationHours: APP_CONFIG.CACHE_EXPIRATION_HOURS,
    });
  }

  private generateCacheKey(lat: number, lon: number, datetime: string): string {
    return `weather:${lat}:${lon}:${datetime}`;
  }

  async getWeather(
    lat: number,
    lon: number,
    datetime: string,
  ): Promise<Weather> {
    const cacheKey = this.generateCacheKey(lat, lon, datetime);
    const context = {
      operation: "get_weather",
      location: { lat, lon },
      datetime,
      cacheKey,
    };

    logger.debug("Starting weather data retrieval", context);

    // Try to get from cache first
    if (this.kv) {
      try {
        const cacheStartTime = Date.now();
        const cachedData = await this.kv.get(cacheKey, "json");
        const cacheDuration = Date.now() - cacheStartTime;

        if (cachedData) {
          logger.cacheOperation("get", cacheKey, true, {
            ...context,
            cacheDuration,
          });
          logger.debug("Weather data retrieved from cache", {
            ...context,
            cacheDuration,
          });
          return cachedData as Weather;
        } else {
          logger.cacheOperation("get", cacheKey, false, {
            ...context,
            cacheDuration,
          });
        }
      } catch (error) {
        logger.warn("Failed to read from KV cache", {
          ...context,
          operation: "cache_read_error",
        }, error as Error);
      }
    }

    // If not in cache, fetch from API
    logger.debug("Cache miss or disabled, fetching from API", context);
    const weather = await this.fetchWeatherFromAPI(lat, lon, datetime);

    // Store in cache
    if (this.kv) {
      try {
        const cacheStartTime = Date.now();
        await this.kv.put(cacheKey, JSON.stringify(weather), {
          expirationTtl: this.cacheExpirationSeconds,
        });
        const cacheDuration = Date.now() - cacheStartTime;

        logger.cacheOperation("put", cacheKey, true, {
          ...context,
          cacheDuration,
          expirationTtl: this.cacheExpirationSeconds,
        });
        logger.debug("Weather data cached successfully", {
          ...context,
          cacheDuration,
        });
      } catch (error) {
        logger.warn("Failed to write to KV cache", {
          ...context,
          operation: "cache_write_error",
        }, error as Error);
      }
    }

    logger.debug("Weather data retrieval completed", context);
    return weather;
  }

  private async fetchWeatherFromAPI(
    lat: number,
    lon: number,
    datetime: string,
  ): Promise<Weather> {
    const context = {
      operation: "fetch_weather_api",
      location: { lat, lon },
      datetime,
    };

    try {
      const date = datetime.slice(0, 10);
      const hour = Number(datetime.slice(11, 13));

      const params = {
        latitude: lat,
        longitude: lon,
        hourly: [
          "temperature_2m",
          "relative_humidity_2m",
          "windspeed_10m",
          "visibility",
          "precipitation_probability",
          "weathercode",
          "uv_index",
        ].join(","),
        start_date: date,
        end_date: date,
        timezone: APP_CONFIG.DEFAULT_TIMEZONE,
      };

      const url = getOpenMeteoForecastUrl();
      logger.externalApiCall("OpenMeteo", url, {
        ...context,
        params: {
          date,
          hour,
          timezone: APP_CONFIG.DEFAULT_TIMEZONE,
        },
      });

      const apiStartTime = Date.now();
      const res = await axios.get(url, { params });
      const apiDuration = Date.now() - apiStartTime;

      logger.externalApiResponse("OpenMeteo", url, res.status, apiDuration, {
        ...context,
        responseSize: JSON.stringify(res.data).length,
      });

      const h = res.data.hourly;
      if (!h) {
        logger.error("Invalid API response structure", {
          ...context,
          operation: "api_response_validation",
          responseKeys: Object.keys(res.data),
        });
        throw new Error("Invalid OpenMeteo API response structure");
      }

      const idx = h.time.findIndex(
        (t: string) => t.startsWith(date) && Number(t.slice(11, 13)) === hour,
      );

      if (idx === -1) {
        logger.error("Weather data not found for specified time", {
          ...context,
          operation: "time_matching_error",
          requestedDate: date,
          requestedHour: hour,
          availableTimes: h.time ? h.time.slice(0, 5) : "undefined",
        });
        throw new Error("Weather data not found for specified time");
      }

      logger.debug("Found matching time index", {
        ...context,
        operation: "time_matching",
        requestedTime: `${date} ${hour}:00`,
        matchedTime: h.time[idx],
        matchedIndex: idx,
      });

      const weatherCode = h.weathercode[idx];
      const condition = mapWeatherCode(weatherCode);

      logger.debug("Weather code mapped", {
        ...context,
        operation: "weather_code_mapping",
        weatherCode,
        mappedCondition: condition,
      });

      const weatherData = {
        datetime,
        condition,
        temperature: h.temperature_2m[idx],
        windSpeed: h.windspeed_10m[idx],
        humidity: h.relative_humidity_2m[idx],
        visibility: h.visibility[idx] / 1000,
        precipitationProbability: h.precipitation_probability[idx],
        uvIndex: h.uv_index[idx],
      };

      logger.info("Weather data successfully fetched and processed", {
        ...context,
        operation: "weather_fetch_success",
        weather: {
          condition: weatherData.condition,
          temperature: weatherData.temperature,
          windSpeed: weatherData.windSpeed,
          humidity: weatherData.humidity,
        },
      });

      return weatherData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error("OpenMeteo API request failed", {
          ...context,
          operation: "api_request_error",
          statusCode: error.response?.status,
          statusText: error.response?.statusText,
          errorCode: error.code,
          url: error.config?.url,
        }, error);
      } else {
        logger.error("Failed to fetch weather data from API", {
          ...context,
          operation: "api_fetch_error",
          errorType: error?.constructor?.name,
        }, error as Error);
      }

      throw error;
    }
  }
}
