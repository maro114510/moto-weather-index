import { APP_CONFIG } from "../constants/appConfig";
import { ERROR_CODES } from "../constants/errorCodes";
import { HTTP_STATUS } from "../constants/httpStatus";
import { HttpError } from "../domain/HttpError";
import {
  type AirQualityLevel,
  type Weather,
  type WeatherCondition,
  WeatherSchema,
} from "../domain/Weather";
import { addDaysToDateString, getJstDateString } from "../utils/dateUtils";
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
  // 1063 = "Patchy rain possible": rain may occur but is not guaranteed; treat as drizzle
  if ([1063, 1150, 1153, 1168, 1171, 1180, 1183].includes(code))
    return "drizzle";
  // Rain (moderate to heavy: showers, thunder with rain)
  if ([1186, 1189, 1192, 1195, 1240, 1243, 1246, 1273, 1276].includes(code))
    return "rain";
  // Snow / sleet / ice pellets (including sleet showers)
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
function parseAndClampPrecipitationProbability(
  value: unknown,
  fieldName: string,
): number {
  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string") {
    parsed = parseFloat(value);
  } else {
    logger.error("Invalid WeatherAPI precipitation probability type", {
      operation: "api_response_validation",
      field: fieldName,
      valueType: typeof value,
    });
    throw new HttpError(
      HTTP_STATUS.BAD_GATEWAY,
      `Invalid WeatherAPI response: ${fieldName} must be number or string`,
      {
        code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
        details: { field: fieldName, valueType: typeof value },
      },
    );
  }

  if (Number.isNaN(parsed)) {
    logger.error("Invalid WeatherAPI precipitation probability value", {
      operation: "api_response_validation",
      field: fieldName,
      value,
    });
    throw new HttpError(
      HTTP_STATUS.BAD_GATEWAY,
      `Invalid WeatherAPI response: ${fieldName} is not a valid number`,
      {
        code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
        details: { field: fieldName, value },
      },
    );
  }

  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, parsed));
}

function mapWeatherApiAirQuality(value: unknown): AirQualityLevel | undefined {
  if (value === undefined || value === null) return undefined;

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new HttpError(
      HTTP_STATUS.BAD_GATEWAY,
      "Invalid WeatherAPI response: us-epa-index",
      {
        code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
        details: { field: "us-epa-index", valueType: typeof value },
      },
    );
  }

  if (value === 1) return "low";
  if (value === 2) return "medium";
  return "high";
}

function validateWeatherApiWeather(
  weather: unknown,
  location: { lat: number; lon: number },
  targetDate: string,
): Weather {
  const result = WeatherSchema.safeParse(weather);
  if (result.success) return result.data;

  const field = result.error.issues[0]?.path.join(".") || "weather";
  throw new HttpError(
    HTTP_STATUS.BAD_GATEWAY,
    `Invalid WeatherAPI response: ${field}`,
    {
      code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
      details: { field, location, targetDate },
    },
  );
}

type WeatherApiHourlyRecord = {
  time_epoch?: unknown;
  temp_c?: unknown;
  wind_kph?: unknown;
  humidity?: unknown;
  vis_km?: unknown;
  chance_of_rain?: unknown;
  uv?: unknown;
  condition?: { code?: unknown };
  air_quality?: { "us-epa-index"?: unknown };
};

function parseRequestedDatetime(datetime: string): Date {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(datetime)
    ? `${datetime}T00:00:00+09:00`
    : /(?:Z|[+-]\d{2}:\d{2})$/i.test(datetime)
      ? datetime
      : `${datetime}+09:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(
      HTTP_STATUS.BAD_REQUEST,
      "datetime must be a valid ISO 8601 datetime",
    );
  }

  return date;
}

function formatJstDatetime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_CONFIG.DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;

  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+09:00`;
}

function selectNearestHourlyRecord(
  hours: unknown,
  requestedAt: Date,
  context: { location: { lat: number; lon: number }; targetDate: string },
): WeatherApiHourlyRecord {
  if (!Array.isArray(hours) || hours.length === 0) {
    throw new HttpError(
      HTTP_STATUS.NOT_FOUND,
      "Weather data is unavailable for the specified coordinates/date",
      {
        code: ERROR_CODES.WEATHER_DATA_NOT_FOUND,
        details: { ...context, missing: "forecast.forecastday[].hour" },
      },
    );
  }

  let selected: WeatherApiHourlyRecord | undefined;
  let selectedEpochMs = Number.NEGATIVE_INFINITY;
  let selectedDistanceMs = Number.POSITIVE_INFINITY;

  for (const candidate of hours as WeatherApiHourlyRecord[]) {
    if (
      typeof candidate.time_epoch !== "number" ||
      !Number.isFinite(candidate.time_epoch)
    ) {
      throw new HttpError(
        HTTP_STATUS.BAD_GATEWAY,
        "Invalid WeatherAPI response: time_epoch",
        {
          code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
          details: { ...context, field: "time_epoch" },
        },
      );
    }

    const epochMs = candidate.time_epoch * 1000;
    const distanceMs = Math.abs(epochMs - requestedAt.getTime());
    if (
      distanceMs < selectedDistanceMs ||
      (distanceMs === selectedDistanceMs && epochMs > selectedEpochMs)
    ) {
      selected = candidate;
      selectedEpochMs = epochMs;
      selectedDistanceMs = distanceMs;
    }
  }

  if (!selected) {
    throw new HttpError(
      HTTP_STATUS.NOT_FOUND,
      "Weather data is unavailable for the specified coordinates/date",
      { code: ERROR_CODES.WEATHER_DATA_NOT_FOUND, details: context },
    );
  }

  return selected;
}

/**
 * Represents an HTTP error from a fetch response (non-2xx status).
 * Used internally to carry status/body through retry and error-handling logic.
 */
class FetchHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly data: any;

  constructor(status: number, statusText: string, data: any) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = "FetchHttpError";
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

export class WeatherApiWeatherRepository implements WeatherRepository {
  private readonly apiKey?: string;
  private readonly requestTimeoutMs: number;
  private readonly maxAttempts: number;

  constructor(
    apiKey?: string,
    options: {
      requestTimeoutMs?: number;
      maxAttempts?: number;
    } = {},
  ) {
    this.apiKey = apiKey;
    this.requestTimeoutMs =
      options.requestTimeoutMs ?? APP_CONFIG.WEATHER_API_REQUEST_TIMEOUT_MS;
    this.maxAttempts =
      options.maxAttempts ?? APP_CONFIG.WEATHER_API_MAX_ATTEMPTS;
    logger.info("WeatherApiWeatherRepository initialized", {
      operation: "repository_init",
      requestTimeoutMs: this.requestTimeoutMs,
      maxAttempts: this.maxAttempts,
    });
  }

  private getApiKey(): string {
    let key = this.apiKey;

    if (!key && typeof process !== "undefined" && process.env) {
      key = process.env.WEATHERAPI_KEY || process.env.WEATHER_API_KEY;
    }

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
    return this.fetchFromApi(lat, lon, datetime);
  }

  private async requestWeatherApi(
    url: string,
    params: Record<string, string>,
  ): Promise<{ status: number; data: any }> {
    const shouldRetry = (error: unknown) => {
      if (error instanceof FetchHttpError) {
        return error.status < 400 || error.status >= 500;
      }
      return true;
    };

    const fullUrl = `${url}?${new URLSearchParams(params).toString()}`;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const startedAt = Date.now();
      try {
        const response = await fetch(fullUrl, {
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new FetchHttpError(response.status, response.statusText, data);
        }

        logger.externalApiResponse(
          "WeatherAPI",
          url,
          response.status,
          Date.now() - startedAt,
          { responseSize: JSON.stringify(data).length, attempt },
        );
        return { status: response.status, data };
      } catch (error) {
        const status =
          error instanceof FetchHttpError ? error.status : undefined;
        const statusText =
          error instanceof FetchHttpError ? error.statusText : undefined;
        const willRetry = shouldRetry(error) && attempt < this.maxAttempts;
        logger.warn(
          "WeatherAPI request error",
          {
            operation: "api_request_error",
            attempt,
            willRetry,
            statusCode: status,
            statusText,
            errorCode: error instanceof Error ? error.name : undefined,
            url,
          },
          error instanceof Error ? error : undefined,
        );
        if (!willRetry) throw error;

        const backoff = Math.min(3000, 300 * 2 ** (attempt - 1));
        await new Promise((resolve) =>
          setTimeout(resolve, Math.floor(Math.random() * backoff)),
        );
      }
    }

    throw new Error("WeatherAPI attempt budget exhausted");
  }

  private async fetchFromApi(
    lat: number,
    lon: number,
    datetime: string,
  ): Promise<Weather> {
    const key = this.getApiKey();

    const requestedAt = parseRequestedDatetime(datetime);
    const targetDate = getJstDateString(requestedAt);
    const today = getJstDateString();

    // Determine which API endpoint to use based on date
    const isHistorical = targetDate < today;
    const isForecast = targetDate >= today;

    // WeatherAPI's forecast.json returns "today" (day 1) through day
    // MAX_FORECAST_DAYS, so the furthest valid date is today + (MAX_FORECAST_DAYS - 1)
    const maxForecastDateStr = addDaysToDateString(
      today,
      APP_CONFIG.MAX_FORECAST_DAYS - 1,
    );

    let url: string;
    let params: Record<string, string>;

    if (isHistorical) {
      // Use history API for past dates
      url = "https://api.weatherapi.com/v1/history.json";
      params = {
        key,
        q: `${lat},${lon}`,
        dt: targetDate,
        aqi: "yes",
      };
    } else if (isForecast && targetDate <= maxForecastDateStr) {
      // Use forecast API for today and future dates (up to MAX_FORECAST_DAYS)
      url = "https://api.weatherapi.com/v1/forecast.json";

      // Normalize both dates to UTC midnight for accurate day difference calculation
      const [targetYear, targetMonth, targetDay] = targetDate
        .split("-")
        .map(Number);
      const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);

      const targetMidnight = new Date(
        Date.UTC(targetYear, targetMonth - 1, targetDay),
      );
      const todayMidnight = new Date(
        Date.UTC(todayYear, todayMonth - 1, todayDay),
      );

      const msPerDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.round(
        (targetMidnight.getTime() - todayMidnight.getTime()) / msPerDay,
      );

      // Clamp to API limits: minimum 1 day, maximum MAX_FORECAST_DAYS
      const days = Math.min(
        APP_CONFIG.MAX_FORECAST_DAYS,
        Math.max(1, diffDays + 1),
      );

      params = {
        key,
        q: `${lat},${lon}`,
        days: String(days),
        dt: targetDate,
        aqi: "yes",
        alerts: "no",
      };
    } else {
      // Date is too far in the future, fall back to history API
      throw new Error(
        `Date ${targetDate} is beyond WeatherAPI forecast range (max ${APP_CONFIG.MAX_FORECAST_DAYS - 1} days ahead)`,
      );
    }

    logger.externalApiCall("WeatherAPI", url, {
      operation: "fetch_weather_api",
      params: {
        q: params.q,
        dt: targetDate,
        endpoint: isHistorical ? "history" : "forecast",
      },
    });

    try {
      const res = await this.requestWeatherApi(url, params);

      // Parse response based on endpoint type
      let forecastDay: any;
      if (isHistorical) {
        forecastDay = res.data?.forecast?.forecastday?.[0];
      } else {
        // For forecast, find the specific day we requested
        const forecastDays = res.data?.forecast?.forecastday;
        if (forecastDays && Array.isArray(forecastDays)) {
          const targetDay = forecastDays.find(
            (d: any) => d.date === targetDate,
          );
          forecastDay = targetDay;
        } else {
          forecastDay = res.data?.forecast?.forecastday?.[0];
        }
      }

      if (!forecastDay) {
        const noDataContext = {
          operation: "api_response_validation",
          failurePoint: "forecast_day_not_found",
          missing: "forecast.forecastday[]",
          endpoint: isHistorical ? "history" : "forecast",
          location: { lat, lon },
          targetDate,
          upstreamResponse: res.data,
        };
        logger.warn(
          "WeatherAPI returned no day data for requested coordinates/date",
          noDataContext,
        );
        throw new HttpError(
          HTTP_STATUS.NOT_FOUND,
          "Weather data is unavailable for the specified coordinates/date",
          {
            code: ERROR_CODES.WEATHER_DATA_NOT_FOUND,
            details: noDataContext,
          },
        );
      }

      const hour = selectNearestHourlyRecord(forecastDay.hour, requestedAt, {
        location: { lat, lon },
        targetDate,
      });
      const precipitationProbability = parseAndClampPrecipitationProbability(
        hour.chance_of_rain,
        "chance_of_rain",
      );

      const conditionCode = hour.condition?.code;
      const condition: WeatherCondition = conditionCode
        ? mapWeatherApiCodeToCondition(Number(conditionCode))
        : "unknown";

      const weather = {
        datetime: formatJstDatetime(new Date(Number(hour.time_epoch) * 1000)),
        condition,
        temperature: hour.temp_c,
        // WeatherAPI kph -> m/s
        windSpeed:
          typeof hour.wind_kph === "number"
            ? hour.wind_kph / 3.6
            : hour.wind_kph,
        humidity: hour.humidity,
        visibility: hour.vis_km,
        precipitationProbability: precipitationProbability,
        uvIndex: hour.uv,
        airQuality: mapWeatherApiAirQuality(hour.air_quality?.["us-epa-index"]),
      };

      return validateWeatherApiWeather(weather, { lat, lon }, targetDate);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      if (error instanceof FetchHttpError) {
        const upstreamCode = error.data?.error?.code;
        const upstreamMessage = error.data?.error?.message;
        const errorContext = {
          operation: "api_request_error",
          failurePoint: "weatherapi_request",
          location: { lat, lon },
          targetDate,
          statusCode: error.status,
          statusText: error.statusText,
          upstreamCode,
          upstreamMessage,
          upstreamResponse: error.data,
          errorCode: error.name,
          url,
        };

        logger.error("WeatherAPI request failed", errorContext, error);

        if (error.status === HTTP_STATUS.BAD_REQUEST && upstreamCode === 1006) {
          throw new HttpError(
            HTTP_STATUS.NOT_FOUND,
            "Weather data is unavailable for the specified coordinates/date",
            {
              code: ERROR_CODES.WEATHER_DATA_NOT_FOUND,
              details: errorContext,
              cause: error,
            },
          );
        }

        if (error.status >= 400 && error.status < 500) {
          throw new HttpError(
            HTTP_STATUS.BAD_GATEWAY,
            "Failed to retrieve valid weather data from upstream provider",
            {
              code: ERROR_CODES.WEATHER_UPSTREAM_CLIENT_ERROR,
              details: errorContext,
              cause: error,
            },
          );
        }

        throw new HttpError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          "Weather provider is unavailable",
          {
            code: ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE,
            details: errorContext,
            cause: error,
          },
        );
      }

      // Network errors (TypeError) and timeouts (AbortError)
      if (error instanceof Error) {
        const errorContext = {
          operation: "api_request_error",
          failurePoint: "weatherapi_request",
          location: { lat, lon },
          targetDate,
          errorCode: error.name,
          url,
        };

        logger.error("WeatherAPI request failed", errorContext, error);

        if (error.name === "AbortError" || error.name === "TimeoutError") {
          throw new HttpError(
            HTTP_STATUS.GATEWAY_TIMEOUT,
            "Weather provider request timed out",
            {
              code: ERROR_CODES.WEATHER_UPSTREAM_TIMEOUT,
              details: errorContext,
              cause: error,
            },
          );
        }

        throw new HttpError(
          HTTP_STATUS.SERVICE_UNAVAILABLE,
          "Weather provider is unavailable",
          {
            code: ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE,
            details: errorContext,
            cause: error,
          },
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
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    // Validate that both dates are valid
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Invalid date range for getWeatherBatch");
    }

    // Validate that start <= end
    if (start.getTime() > end.getTime()) {
      throw new Error("Start date must be less than or equal to end date");
    }

    const today = getJstDateString();
    const maxForecastDate = addDaysToDateString(
      today,
      APP_CONFIG.MAX_FORECAST_DAYS - 1,
    );
    if (startDate < today) {
      throw new Error("Batch weather range must start on or after today");
    }
    if (endDate > maxForecastDate) {
      throw new Error(
        `Batch weather range exceeds forecast boundary: ${maxForecastDate}`,
      );
    }

    const targetDates: string[] = [];
    for (
      let d = new Date(start);
      d.getTime() <= end.getTime();
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      targetDates.push(d.toISOString().slice(0, 10));
    }

    const url = "https://api.weatherapi.com/v1/forecast.json";
    const params = {
      key: this.getApiKey(),
      q: `${lat},${lon}`,
      days: String(targetDates.length),
      aqi: "yes",
      alerts: "no",
    };
    logger.externalApiCall("WeatherAPI", url, {
      operation: "fetch_weather_api_batch",
      params: { q: params.q, days: params.days, endpoint: "forecast" },
    });

    try {
      const response = await this.requestWeatherApi(url, params);
      const daysByDate = new Map<string, any>(
        (response.data?.forecast?.forecastday ?? []).map((forecastDay: any) => [
          forecastDay.date,
          forecastDay,
        ]),
      );

      return targetDates.map((date) => {
        const forecastDay = daysByDate.get(date);
        const day = forecastDay?.day;
        if (!day) {
          throw new HttpError(
            HTTP_STATUS.BAD_GATEWAY,
            `WeatherAPI response is missing weather data for ${date}`,
            {
              code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
              details: { location: { lat, lon }, date },
            },
          );
        }

        for (const [field, value] of [
          ["avgtemp_c", day.avgtemp_c],
          ["maxwind_kph", day.maxwind_kph],
          ["avghumidity", day.avghumidity],
          ["uv", day.uv],
        ]) {
          if (typeof value !== "number" || Number.isNaN(value)) {
            throw new HttpError(
              HTTP_STATUS.BAD_GATEWAY,
              `Invalid WeatherAPI response: ${field}`,
              {
                code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
                details: { field, location: { lat, lon }, date },
              },
            );
          }
        }

        const conditionCode: number | undefined = day.condition?.code;
        return validateWeatherApiWeather(
          {
            datetime: `${date}T03:00:00Z`,
            condition: conditionCode
              ? mapWeatherApiCodeToCondition(conditionCode)
              : "unknown",
            temperature: day.avgtemp_c,
            windSpeed: day.maxwind_kph / 3.6,
            humidity: day.avghumidity,
            visibility: day.avgvis_km,
            precipitationProbability: parseAndClampPrecipitationProbability(
              day.daily_chance_of_rain,
              "daily_chance_of_rain",
            ),
            uvIndex: day.uv,
            airQuality: mapWeatherApiAirQuality(
              forecastDay.air_quality?.["us-epa-index"],
            ),
          },
          { lat, lon },
          date,
        );
      });
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof FetchHttpError) {
        throw new HttpError(
          error.status >= 400 && error.status < 500
            ? HTTP_STATUS.BAD_GATEWAY
            : HTTP_STATUS.SERVICE_UNAVAILABLE,
          "Failed to retrieve weather data from upstream provider",
          { code: ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE, cause: error },
        );
      }
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw new HttpError(
          HTTP_STATUS.GATEWAY_TIMEOUT,
          "Weather provider request timed out",
          { code: ERROR_CODES.WEATHER_UPSTREAM_TIMEOUT, cause: error },
        );
      }
      throw error;
    }
  }
}
