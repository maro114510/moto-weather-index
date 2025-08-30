import axios from "axios";
import { APP_CONFIG } from "../constants/appConfig";
import type { Weather, WeatherCondition } from "../domain/Weather";
import { logger } from "../utils/logger";
import type { WeatherRepository } from "./WeatherRepository";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function normalizeDatePart(datetime: string): string | null {
  // Accept YYYY-MM-DD or YYYY/MM/DD or full ISO
  const m = datetime.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})/);
  if (m) {
    const y = m[1];
    const mo = m[2];
    const d = m[3];
    return `${y}-${mo}-${d}`;
  }
  const d2 = new Date(datetime);
  if (!Number.isNaN(d2.getTime())) {
    return d2.toISOString().slice(0, 10);
  }
  return null;
}

// WeatherAPI.com condition code mapping to our WeatherCondition
// Reference: https://www.weatherapi.com/docs/
function mapWeatherApiCondition(code: number, text?: string): WeatherCondition {
  // Direct mappings by WeatherAPI condition code groups
  const CLEAR = new Set([1000]);
  const PARTLY = new Set([1003]);
  const CLOUDY = new Set([1006]);
  const OVERCAST = new Set([1009]);
  const FOG = new Set([1030, 1135, 1147]);
  const DRIZZLE = new Set([1150, 1153, 1168, 1171]);
  const RAIN = new Set([
    1063, 1072, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246, 1273,
    1276,
  ]);
  const SNOW = new Set([
    1066, 1069, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255,
    1258, 1261, 1264, 1279, 1282,
  ]);

  if (CLEAR.has(code)) return "clear";
  if (PARTLY.has(code)) return "partly_cloudy";
  if (CLOUDY.has(code)) return "cloudy";
  if (OVERCAST.has(code)) return "overcast";
  if (FOG.has(code)) return "fog";
  if (DRIZZLE.has(code)) return "drizzle";
  if (RAIN.has(code)) return "rain";
  if (SNOW.has(code)) return "snow";

  // Fallback: infer from text if provided
  const t = (text || "").toLowerCase();
  if (t.includes("drizzle")) return "drizzle";
  if (t.includes("snow")) return "snow";
  if (t.includes("rain") || t.includes("shower")) return "rain";
  if (t.includes("fog") || t.includes("mist") || t.includes("haze"))
    return "fog";
  if (t.includes("overcast")) return "overcast";
  if (t.includes("cloud")) return "partly_cloudy";
  if (t.includes("clear") || t.includes("sunny")) return "clear";
  return "unknown";
}

export class OpenMeteoWeatherRepository implements WeatherRepository {
  private kv?: KVNamespace;
  private readonly cacheExpirationSeconds =
    APP_CONFIG.CACHE_EXPIRATION_HOURS * 60 * 60;
  private readonly apiKey?: string;

  constructor(kv?: KVNamespace, apiKey?: string) {
    this.kv = kv;
    this.apiKey = apiKey || process.env.WEATHERAPI_KEY || process.env.WEATHER_API_KEY;
    logger.info("WeatherAPIWeatherRepository initialized", {
      operation: "repository_init",
      cacheEnabled: !!kv,
      cacheExpirationHours: APP_CONFIG.CACHE_EXPIRATION_HOURS,
      provider: "WeatherAPI.com",
      apiKeyConfigured: !!this.apiKey,
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

    // Enforce date window BEFORE consulting cache to avoid serving stale data
    const datePart = normalizeDatePart(datetime);
    if (!datePart) {
      throw new HttpError(400, "Invalid datetime format");
    }
    const requestedDate = new Date(`${datePart}T00:00:00Z`);
    const now = new Date();
    const sevenDaysAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    if (requestedDate.getTime() < sevenDaysAgo.getTime()) {
      logger.warn("Requested date is older than last 7 days", {
        ...context,
        operation: "date_out_of_supported_range",
        requestedDate: datePart,
        minDateAllowed: sevenDaysAgo.toISOString().slice(0, 10),
      });
      throw new HttpError(
        400,
        "Date out of supported range: only up to 7 days in the past are allowed",
      );
    }

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

  // Exponential backoff for non-429 errors
  private async requestWithRetry<T>(
    fn: () => Promise<T>,
    context: Record<string, unknown>,
  ): Promise<T> {
    const maxRetries = 3;
    const baseDelayMs = 300;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const isAxios = axios.isAxiosError(error);
        const status = isAxios ? error.response?.status : undefined;
        const shouldRetry = attempt < maxRetries && (status === undefined || status !== 429);

        logger.warn(
          "Weather API request attempt failed",
          { ...context, attempt, status, provider: "WeatherAPI.com" },
          error as Error,
        );

        if (!shouldRetry) throw error;

        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    // Unreachable, but TS needs return
    throw new Error("Exhausted retries");
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
      const datePart = normalizeDatePart(datetime);
      if (!datePart) {
        logger.warn("Invalid datetime format", {
          ...context,
          operation: "invalid_datetime",
          raw: datetime,
        });
        throw new HttpError(400, "Invalid datetime format");
      }
      const date = datePart;
      const apiKey = this.apiKey;
      if (!apiKey) {
        throw new HttpError(
          500,
          "WeatherAPI.com API key is not configured (WEATHERAPI_KEY)",
        );
      }
      // Validate supported date window: do not request if older than last 7 days
      const requestedDate = new Date(`${date}T00:00:00Z`);
      const now = new Date();
      const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      if (requestedDate.getTime() < sevenDaysAgo.getTime()) {
        logger.warn("Requested date is older than last 7 days", {
          ...context,
          operation: "date_out_of_supported_range",
          requestedDate: date,
          minDateAllowed: sevenDaysAgo.toISOString().slice(0, 10),
        });
        throw new HttpError(
          400,
          "Date out of supported range: only up to 7 days in the past are allowed",
        );
      }
      // Decide whether to call forecast or history endpoint
      const today = new Date().toISOString().slice(0, 10);
      const isPast = date < today;

      let day: any | undefined;
      if (isPast) {
        const url = "https://api.weatherapi.com/v1/history.json";
        logger.externalApiCall("WeatherAPI.com", url, {
          ...context,
          params: { date, mode: "history" },
        });

        const res = await this.requestWithRetry(
          async () =>
            axios.get(url, {
              params: { key: apiKey, q: `${lat},${lon}`, dt: date, aqi: "no" },
            }),
          context,
        );

        logger.externalApiResponse("WeatherAPI.com", url, res.status, 0, {
          ...context,
          responseSize: JSON.stringify(res.data).length,
        });

        const f = res.data?.forecast?.forecastday;
        if (!Array.isArray(f) || !f[0]?.day) {
          logger.error("Invalid API response structure", {
            ...context,
            operation: "api_response_validation",
            responseKeys: Object.keys(res.data || {}),
          });
          throw new HttpError(502, "Invalid WeatherAPI.com response structure");
        }
        day = f[0].day;
      } else {
        const url = "https://api.weatherapi.com/v1/forecast.json";
        logger.externalApiCall("WeatherAPI.com", url, {
          ...context,
          params: { date, mode: "forecast" },
        });

        const res = await this.requestWithRetry(
          async () =>
            axios.get(url, {
              params: {
                key: apiKey,
                q: `${lat},${lon}`,
                days: 14,
                aqi: "no",
                alerts: "no",
              },
            }),
          context,
        );

        logger.externalApiResponse("WeatherAPI.com", url, res.status, 0, {
          ...context,
          responseSize: JSON.stringify(res.data).length,
        });

        const forecast = res.data?.forecast?.forecastday;
        if (!Array.isArray(forecast)) {
          logger.error("Invalid API response structure", {
            ...context,
            operation: "api_response_validation",
            responseKeys: Object.keys(res.data || {}),
          });
          throw new HttpError(502, "Invalid WeatherAPI.com response structure");
        }

        const dayEntry = forecast.find((d: any) => d?.date === date);
        if (!dayEntry) {
          logger.error("Weather data not found for specified date", {
            ...context,
            operation: "date_matching_error",
            requestedDate: date,
            availableDates: forecast.map((d: any) => d?.date).slice(0, 7),
          });
          throw new HttpError(400, "Weather data not found for specified date");
        }
        day = dayEntry.day;
      }
      const condition = mapWeatherApiCondition(
        day?.condition?.code,
        day?.condition?.text,
      );

      const temperature =
        typeof day?.maxtemp_c === "number" && typeof day?.mintemp_c === "number"
          ? (day.maxtemp_c + day.mintemp_c) / 2
          : typeof day?.avgtemp_c === "number"
            ? day.avgtemp_c
            : 0;
      const windSpeed =
        typeof day?.maxwind_kph === "number" ? day.maxwind_kph / 3.6 : 0;
      const humidity = typeof day?.avghumidity === "number" ? day.avghumidity : 50;
      const visibility =
        typeof day?.avgvis_km === "number"
          ? day.avgvis_km
          : APP_CONFIG.DEFAULT_VISIBILITY_KM;
      const rainProb = parseInt(day?.daily_chance_of_rain ?? "0", 10) || 0;
      const snowProb = parseInt(day?.daily_chance_of_snow ?? "0", 10) || 0;
      const precipitationProbability = Math.max(rainProb, snowProb);
      const uvIndex = typeof day?.uv === "number" ? day.uv : 0;

      const weatherData: Weather = {
        datetime,
        condition,
        temperature,
        windSpeed,
        humidity,
        visibility,
        precipitationProbability,
        uvIndex,
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
          "WeatherAPI.com request failed",
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
        const status = error.response?.status;
        const message =
          (error.response?.data as any)?.error?.message ||
          error.message ||
          "WeatherAPI.com request failed";
        if (status) {
          throw new HttpError(status, message);
        }
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
      const apiKey = this.apiKey;
      if (!apiKey) {
        throw new Error(
          "WeatherAPI.com API key is not configured (WEATHERAPI_KEY)",
        );
      }

      // Calculate required days (inclusive). WeatherAPI supports up to 14 days forecast.
      const start = new Date(startDate + "T00:00:00Z");
      const end = new Date(endDate + "T00:00:00Z");
      const diffDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      const days = Math.min(Math.max(diffDays, 1), 14);

      const url = "https://api.weatherapi.com/v1/forecast.json";
      logger.externalApiCall("WeatherAPI.com", url, {
        ...context,
        params: { startDate, endDate, days },
      });

      const res = await this.requestWithRetry(
        async () =>
          axios.get(url, {
            params: {
              key: apiKey,
              q: `${lat},${lon}`,
              days,
              aqi: "no",
              alerts: "no",
            },
          }),
        context,
      );

      logger.externalApiResponse("WeatherAPI.com", url, res.status, 0, {
        ...context,
        responseSize: JSON.stringify(res.data).length,
      });

      const forecast = res.data?.forecast?.forecastday;
      if (!Array.isArray(forecast)) {
        logger.error("Invalid API response structure for batch request", {
          ...context,
          operation: "api_response_validation",
          responseKeys: Object.keys(res.data || {}),
        });
        throw new Error("Invalid WeatherAPI.com response structure");
      }

      const set = new Set<string>();
      // Build set of required dates inclusively
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(start.getTime() + i * 86400000);
        set.add(d.toISOString().slice(0, 10));
      }

      // Exclude dates older than 7 days ago to avoid unsupported requests
      const now = new Date();
      const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const minAllowed = sevenDaysAgo.toISOString().slice(0, 10);
      for (const d of Array.from(set)) {
        if (d < minAllowed) set.delete(d);
      }
      if (set.size === 0) {
        logger.warn("All requested dates are older than last 7 days", {
          ...context,
          operation: "date_out_of_supported_range",
          minDateAllowed: minAllowed,
        });
        throw new HttpError(
          400,
          "Date range out of supported scope: only up to 7 days in the past are allowed",
        );
      }

      const weatherDataList: Weather[] = [];
      for (const entry of forecast) {
        const date = entry?.date as string;
        if (!set.has(date)) continue;
        const day = entry?.day;
        const condition = mapWeatherApiCondition(
          day?.condition?.code,
          day?.condition?.text,
        );
        const temperature =
          typeof day?.maxtemp_c === "number" &&
          typeof day?.mintemp_c === "number"
            ? (day.maxtemp_c + day.mintemp_c) / 2
            : typeof day?.avgtemp_c === "number"
              ? day.avgtemp_c
              : 0;
        const windSpeed =
          typeof day?.maxwind_kph === "number" ? day.maxwind_kph / 3.6 : 0;
        const humidity =
          typeof day?.avghumidity === "number" ? day.avghumidity : 50;
        const visibility =
          typeof day?.avgvis_km === "number"
            ? day.avgvis_km
            : APP_CONFIG.DEFAULT_VISIBILITY_KM;
        const rainProb = parseInt(day?.daily_chance_of_rain ?? "0", 10) || 0;
        const snowProb = parseInt(day?.daily_chance_of_snow ?? "0", 10) || 0;
        const precipitationProbability = Math.max(rainProb, snowProb);
        const uvIndex = typeof day?.uv === "number" ? day.uv : 0;

        const datetime = `${date}T03:00:00Z`; // 12:00 JST = 03:00 UTC
        weatherDataList.push({
          datetime,
          condition,
          temperature,
          windSpeed,
          humidity,
          visibility,
          precipitationProbability,
          uvIndex,
        });
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
          "WeatherAPI.com batch request failed",
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
