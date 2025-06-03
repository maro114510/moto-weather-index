import axios from "axios";
import { APP_CONFIG, getOpenMeteoForecastUrl } from "../constants/appConfig";
import type { Weather, WeatherCondition } from "../domain/Weather";
import { logger } from "../utils/logger";
import type { WeatherRepository } from "./WeatherRepository";

// Open-Meteo weather code
// doc: https://github.com/open-meteo/open-meteo/issues/287
function mapWeatherCode(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code === 1) return "mostly_clear";
  if (code === 2) return "partly_cloudy";
  if (code === 3) return "overcast";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  return "unknown";
}

export class OpenMeteoWeatherRepository implements WeatherRepository {
  private kv?: KVNamespace;
  private readonly cacheExpirationSeconds =
    APP_CONFIG.CACHE_EXPIRATION_HOURS * 60 * 60;

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
        }
        logger.cacheOperation("get", cacheKey, false, {
          ...context,
          cacheDuration,
        });
      } catch (error) {
        logger.warn(
          "Failed to read from KV cache",
          {
            ...context,
            operation: "cache_read_error",
          },
          error as Error,
        );
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
        logger.warn(
          "Failed to write to KV cache",
          {
            ...context,
            operation: "cache_write_error",
          },
          error as Error,
        );
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

      const params = {
        latitude: lat,
        longitude: lon,
        daily: [
          "weathercode",
          "temperature_2m_max",
          "temperature_2m_min",
          "windspeed_10m_max",
          "relative_humidity_2m_max",
          "precipitation_probability_max",
          "uv_index_max",
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

      const daily = res.data.daily;
      if (!daily || !daily.time) {
        logger.error("Invalid API response structure", {
          ...context,
          operation: "api_response_validation",
          responseKeys: Object.keys(res.data),
        });
        throw new Error("Invalid OpenMeteo API response structure");
      }

      const idx = daily.time.findIndex((t: string) => t === date);

      if (idx === -1) {
        logger.error("Weather data not found for specified date", {
          ...context,
          operation: "date_matching_error",
          requestedDate: date,
          availableDates: daily.time ? daily.time.slice(0, 5) : "undefined",
        });
        throw new Error("Weather data not found for specified date");
      }

      logger.debug("Found matching date index", {
        ...context,
        operation: "date_matching",
        requestedDate: date,
        matchedDate: daily.time[idx],
        matchedIndex: idx,
      });

      const weatherCode = daily.weathercode[idx];
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
        temperature:
          (daily.temperature_2m_max[idx] + daily.temperature_2m_min[idx]) / 2,
        windSpeed: daily.windspeed_10m_max[idx],
        humidity: daily.relative_humidity_2m_max[idx],
        visibility: APP_CONFIG.DEFAULT_VISIBILITY_KM, // Default visibility for daily data
        precipitationProbability: daily.precipitation_probability_max[idx],
        uvIndex: daily.uv_index_max[idx],
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
        logger.error(
          "OpenMeteo API request failed",
          {
            ...context,
            operation: "api_request_error",
            statusCode: error.response?.status,
            statusText: error.response?.statusText,
            errorCode: error.code,
            url: error.config?.url,
          },
          error,
        );
      } else {
        logger.error(
          "Failed to fetch weather data from API",
          {
            ...context,
            operation: "api_fetch_error",
            errorType: error?.constructor?.name,
          },
          error as Error,
        );
      }

      throw error;
    }
  }

  async getWeatherBatch(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
  ): Promise<Weather[]> {
    const context = {
      operation: "get_weather_batch",
      location: { lat, lon },
      startDate,
      endDate,
    };

    logger.debug("Starting batch weather data retrieval", context);

    try {
      const params = {
        latitude: lat,
        longitude: lon,
        daily: [
          "weathercode",
          "temperature_2m_max",
          "temperature_2m_min",
          "windspeed_10m_max",
          "relative_humidity_2m_max",
          "precipitation_probability_max",
          "uv_index_max",
        ].join(","),
        start_date: startDate,
        end_date: endDate,
        timezone: APP_CONFIG.DEFAULT_TIMEZONE,
      };

      const url = getOpenMeteoForecastUrl();
      logger.externalApiCall("OpenMeteo", url, {
        ...context,
        params: {
          startDate,
          endDate,
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

      const daily = res.data.daily;
      if (!daily || !daily.time) {
        logger.error("Invalid API response structure for batch request", {
          ...context,
          operation: "api_response_validation",
          responseKeys: Object.keys(res.data),
        });
        throw new Error("Invalid OpenMeteo API response structure");
      }

      const weatherDataList: Weather[] = [];

      for (let i = 0; i < daily.time.length; i++) {
        const date = daily.time[i];
        const weatherCode = daily.weathercode[i];
        const condition = mapWeatherCode(weatherCode);

        // Use noon time for daily data
        const datetime = `${date}T03:00:00Z`; // 12:00 JST = 03:00 UTC

        const weatherData: Weather = {
          datetime,
          condition,
          temperature:
            (daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2,
          windSpeed: daily.windspeed_10m_max[i],
          humidity: daily.relative_humidity_2m_max[i],
          visibility: APP_CONFIG.DEFAULT_VISIBILITY_KM, // Default visibility for daily data
          precipitationProbability: daily.precipitation_probability_max[i],
          uvIndex: daily.uv_index_max[i],
        };

        weatherDataList.push(weatherData);
      }

      logger.info("Batch weather data successfully fetched and processed", {
        ...context,
        operation: "weather_batch_fetch_success",
        daysRetrieved: weatherDataList.length,
      });

      return weatherDataList;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          "OpenMeteo batch API request failed",
          {
            ...context,
            operation: "api_batch_request_error",
            statusCode: error.response?.status,
            statusText: error.response?.statusText,
            errorCode: error.code,
            url: error.config?.url,
          },
          error,
        );
      } else {
        logger.error(
          "Failed to fetch batch weather data from API",
          {
            ...context,
            operation: "api_batch_fetch_error",
            errorType: error?.constructor?.name,
          },
          error as Error,
        );
      }

      throw error;
    }
  }
}
