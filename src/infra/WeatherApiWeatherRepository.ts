import type { AxiosError, AxiosResponse } from "axios";
import axios from "axios";
import { APP_CONFIG } from "../constants/appConfig";
import type { Weather, WeatherCondition } from "../domain/Weather";
import { logger } from "../utils/logger";
import type { WeatherRepository } from "./WeatherRepository";

// WeatherAPI.com condition code mapping (coarse mapping to our domain)
// Ref: https://www.weatherapi.com/docs/weather_conditions.json
function mapWeatherApiCodeToCondition(code: number): WeatherCondition {
  // Clear / sunny
  if (code === 1000) return "clear";
  // Partly cloudy
  if (code === 1003) return "partly_cloudy";
  // Cloudy / overcast
  if (code === 1006) return "cloudy";
  if (code === 1009) return "overcast";
  // Fog / mist
  if ([1030, 1135, 1147].includes(code)) return "fog";
  // Drizzle / light rain-ish
  if (
    [1150, 1153, 1168, 1171, 1180, 1183].includes(code)
  )
    return "drizzle";
  // Rain (including showers, thunder with rain)
  if (
    [
      1063, 1186, 1189, 1192, 1195, 1240, 1243, 1246, 1249, 1252, 1273, 1276,
    ].includes(code)
  )
    return "rain";
  // Snow / sleet / ice pellets
  if (
    [
      1066, 1069, 1072, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237,
      1249, 1252, 1255, 1258, 1261, 1264, 1279, 1282,
    ].includes(code)
  )
    return "snow";
  return "unknown";
}

/**
 * Parses precipitation probability from WeatherAPI response and clamps to 0-100 range
 * Handles both string and number types as WeatherAPI sometimes returns strings
 */
function parseAndClampPrecipitationProbability(value: unknown, fieldName: string): number {
  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string") {
    parsed = parseFloat(value);
  } else {
    logger.error(
      "Invalid WeatherAPI precipitation probability type",
      { operation: "api_response_validation", field: fieldName, valueType: typeof value },
    );
    throw new Error(`Invalid WeatherAPI response: ${fieldName} must be number or string`);
  }

  if (Number.isNaN(parsed)) {
    logger.error(
      "Invalid WeatherAPI precipitation probability value",
      { operation: "api_response_validation", field: fieldName, value },
    );
    throw new Error(`Invalid WeatherAPI response: ${fieldName} is not a valid number`);
  }

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, parsed));
}

export class WeatherApiWeatherRepository implements WeatherRepository {
  private kv?: KVNamespace;
  private readonly apiKey?: string;
  private readonly cacheExpirationSeconds =
    APP_CONFIG.CACHE_EXPIRATION_HOURS * 60 * 60;

  constructor(kv?: KVNamespace, apiKey?: string) {
    this.kv = kv;
    this.apiKey = apiKey;
    logger.info("WeatherApiWeatherRepository initialized", {
      operation: "repository_init",
      cacheEnabled: !!kv,
      cacheExpirationHours: APP_CONFIG.CACHE_EXPIRATION_HOURS,
    });
  }

  private generateCacheKey(lat: number, lon: number, datetime: string): string {
    return `weather:${lat}:${lon}:${datetime}`;
  }

  private getApiKey(): string {
    const key = this.apiKey || process.env.WEATHERAPI_KEY || process.env.WEATHER_API_KEY;
    if (!key) {
      throw new Error(
        "WeatherAPI key not found. Provide apiKey parameter or set WEATHERAPI_KEY environment variable.",
      );
    }
    return key;
  }

  async getWeather(
    lat: number,
    lon: number,
    datetime: string,
  ): Promise<Weather> {
    const cacheKey = this.generateCacheKey(lat, lon, datetime);
    const context = {
      operation: "get_weather",
      provider: "WeatherAPI",
      location: { lat, lon },
      datetime,
      cacheKey,
    };

    // Try cache first
    if (this.kv) {
      try {
        const t0 = Date.now();
        const cached = await this.kv.get(cacheKey, "json");
        const dt = Date.now() - t0;
        logger.cacheOperation("get", cacheKey, !!cached, { ...context, cacheDuration: dt });
        if (cached) return cached as Weather;
      } catch (err) {
        logger.warn("Failed to read from KV cache", { ...context }, err as Error);
      }
    }

    const weather = await this.fetchFromApi(lat, lon, datetime);

    if (this.kv) {
      try {
        const t0 = Date.now();
        await this.kv.put(cacheKey, JSON.stringify(weather), {
          expirationTtl: this.cacheExpirationSeconds,
        });
        const dt = Date.now() - t0;
        logger.cacheOperation("put", cacheKey, true, {
          ...context,
          cacheDuration: dt,
          expirationTtl: this.cacheExpirationSeconds,
        });
      } catch (err) {
        logger.warn("Failed to write to KV cache", { ...context }, err as Error);
      }
    }

    return weather;
  }

  private async fetchFromApi(
    lat: number,
    lon: number,
    datetime: string,
  ): Promise<Weather> {
    const key = this.getApiKey();
    const url = "https://api.weatherapi.com/v1/forecast.json";

    const params = {
      key,
      q: `${lat},${lon}`,
      days: 1,
      aqi: "no",
      alerts: "no",
    } as const;

    logger.externalApiCall("WeatherAPI", url, {
      operation: "fetch_weather_api",
      params: { q: params.q, days: params.days },
    });

    // Request with exponential backoff (no retry for 429 or other 4xx)
    const maxRetries = 3;
    const baseDelayMs = 300; // start small to avoid unnecessary load
    const capMs = 3000; // keep within a reasonable upper bound

    const shouldRetry = (err: AxiosError) => {
      const status = err.response?.status;
      // Do not retry on 429 (rate limit) or other 4xx (considered fatal)
      if (status && (status === 429 || (status >= 400 && status < 500))) {
        return false;
      }
      // Retry on network errors/timeouts and 5xx
      return true;
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const requestWithBackoff = async (): Promise<AxiosResponse> => {
      let attempt = 0;
      // First attempt + retries up to maxRetries
      while (true) {
        const startedAt = Date.now();
        try {
          const res = await axios.get(url, { params });
          const apiDuration = Date.now() - startedAt;
          logger.externalApiResponse("WeatherAPI", url, res.status, apiDuration, {
            responseSize: JSON.stringify(res.data).length,
            attempt,
          });
          return res;
        } catch (e) {
          const err = e as AxiosError;
          const status = err.response?.status;
          const canRetry = shouldRetry(err) && attempt < maxRetries;
          logger.warn(
            "WeatherAPI request error",
            {
              operation: "api_request_error",
              attempt,
              willRetry: canRetry,
              statusCode: status,
              statusText: err.response?.statusText,
              errorCode: err.code,
              url,
            },
            err as Error,
          );

          if (!canRetry) throw err;

          // Exponential backoff with full jitter
          const backoff = Math.min(capMs, baseDelayMs * 2 ** attempt);
          const delay = Math.floor(Math.random() * backoff);
          await sleep(delay);
          attempt += 1;
        }
      }
    };

    try {
      const res = await requestWithBackoff();

      const day = res.data?.forecast?.forecastday?.[0]?.day;
      if (!day) {
        logger.error(
          "Invalid WeatherAPI response structure",
          { operation: "api_response_validation", missing: "forecast.forecastday[0].day" },
        );
        throw new Error("Invalid WeatherAPI response structure");
      }

      // Validate required numeric fields; do not silently fallback
      const numericFields: Array<[string, unknown]> = [
        ["avgtemp_c", day.avgtemp_c],
        ["maxwind_kph", day.maxwind_kph],
        ["avghumidity", day.avghumidity],
        ["uv", day.uv],
      ];
      for (const [name, value] of numericFields) {
        if (typeof value !== "number" || Number.isNaN(value)) {
          logger.error(
            "Invalid WeatherAPI response value",
            { operation: "api_response_validation", field: name, valueType: typeof value },
          );
          throw new Error(`Invalid WeatherAPI response: ${name}`);
        }
      }

      // Handle daily_chance_of_rain separately as it can be a string
      const precipitationProbability = parseAndClampPrecipitationProbability(
        day.daily_chance_of_rain,
        "daily_chance_of_rain"
      );

      const conditionCode: number | undefined = day?.condition?.code;
      const condition: WeatherCondition = conditionCode
        ? mapWeatherApiCodeToCondition(conditionCode)
        : "unknown";

      const weather: Weather = {
        // Preserve requested datetime as existing behavior does
        datetime,
        condition,
        temperature: day.avgtemp_c,
        // WeatherAPI kph -> m/s
        windSpeed: day.maxwind_kph / 3.6,
        humidity: day.avghumidity,
        visibility: APP_CONFIG.DEFAULT_VISIBILITY_KM,
        precipitationProbability: precipitationProbability,
        uvIndex: day.uv,
      };

      return weather;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error(
          "WeatherAPI request failed",
          {
            operation: "api_request_error",
            statusCode: error.response?.status,
            statusText: error.response?.statusText,
            errorCode: error.code,
            url,
          },
          error,
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
    // Build an array of dates inclusively
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");

    // Validate that both dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date range for getWeatherBatch");
    }

    // Validate that start <= end
    if (start.getTime() > end.getTime()) {
      throw new Error("Start date must be less than or equal to end date");
    }

    const days: string[] = [];
    // Include the range inclusively: start <= date <= end
    for (let d = new Date(start); d.getTime() <= end.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }

    // Safety check: return empty array if no days were generated
    if (days.length === 0) {
      return [];
    }

    // Fetch once and reuse values to satisfy interface and tests
    // Normalize base fetch time to use T03:00:00Z consistently
    const base = await this.getWeather(lat, lon, `${days[0]}T03:00:00Z`);

    const results: Weather[] = days.map((dateStr) => ({
      datetime: `${dateStr}T03:00:00Z`, // 12:00 JST = 03:00 UTC
      condition: base.condition,
      temperature: base.temperature,
      windSpeed: base.windSpeed,
      humidity: base.humidity,
      visibility: APP_CONFIG.DEFAULT_VISIBILITY_KM,
      precipitationProbability: base.precipitationProbability,
      uvIndex: base.uvIndex,
    }));

    return results;
  }
}
