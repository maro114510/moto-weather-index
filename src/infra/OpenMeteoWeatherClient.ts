import { z } from "zod";
import { ERROR_CODES } from "../constants/errorCodes";
import { HTTP_STATUS } from "../constants/httpStatus";
import { HttpError } from "../domain/HttpError";
import {
  type Observation,
  ObservationSchema,
  type Place,
  type Target,
} from "../domain/TouringIndex";
import type { AirQualityLevel, WeatherCondition } from "../domain/Weather";

export const OPEN_METEO_SOURCE = "Open-Meteo";

/** The Days from today for which the product presents a Touring Index. */
export const HORIZON_DAYS = 7;

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

export type MomentTarget = Extract<Target, { type: "moment" }>;

export interface WeatherReading {
  observation: Observation;
  source: string;
  /** The time at which the weather source returned the observation. */
  fetchedAt: string;
}

export interface DailyWeatherReading {
  days: { date: string; observation: Observation }[];
  source: string;
  fetchedAt: string;
}

export interface OpenMeteoWeatherClientOptions {
  fetch?: typeof fetch;
  now?: () => Date;
  requestTimeoutMs?: number;
}

/** WMO weather interpretation codes, grouped into the product's conditions. */
function conditionFromWmoCode(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code === 1) return "mostly_clear";
  if (code === 2) return "partly_cloudy";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57, 61, 80].includes(code)) return "drizzle";
  if ([63, 65, 66, 67, 81, 82, 95, 96, 99].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  return "unknown";
}

/** US AQI bands: up to 50 is good, up to 100 is moderate, above is unhealthy. */
function airQualityFromUsAqi(aqi: number): AirQualityLevel {
  if (aqi <= 50) return "low";
  if (aqi <= 100) return "medium";
  return "high";
}

/** Open-Meteo reports a value it lacks as null. */
const NullableNumbers = z.array(z.number().nullable());

const HourlyForecastSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    weather_code: NullableNumbers,
    temperature_2m: NullableNumbers,
    wind_speed_10m: NullableNumbers,
    relative_humidity_2m: NullableNumbers,
    visibility: NullableNumbers,
    precipitation_probability: NullableNumbers,
    uv_index: NullableNumbers,
  }),
});

/** Air quality is optional: a response without it is a missing factor. */
const HourlyAirQualitySchema = z.object({
  hourly: z
    .object({ time: z.array(z.string()), us_aqi: NullableNumbers })
    .optional(),
});

function invalidResponse(field: string, detail?: unknown): HttpError {
  return new HttpError(
    HTTP_STATUS.BAD_GATEWAY,
    `Invalid Open-Meteo response: ${field}`,
    {
      code: ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE,
      details: { field, detail },
    },
  );
}

function parseResponse<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw invalidResponse(issue?.path.join(".") || "response", issue?.message);
}

function withoutUndefined(observation: Observation): Observation {
  return Object.fromEntries(
    Object.entries(observation).filter(([, v]) => v !== undefined),
  ) as Observation;
}

export class OpenMeteoWeatherClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly requestTimeoutMs: number;

  constructor(options: OpenMeteoWeatherClientOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  private async getJson(
    base: string,
    params: Record<string, string>,
  ): Promise<unknown> {
    const url = `${base}?${new URLSearchParams(params).toString()}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      throw new HttpError(
        timedOut
          ? HTTP_STATUS.GATEWAY_TIMEOUT
          : HTTP_STATUS.SERVICE_UNAVAILABLE,
        timedOut
          ? "Weather provider request timed out"
          : "Weather provider is unavailable",
        {
          code: timedOut
            ? ERROR_CODES.WEATHER_UPSTREAM_TIMEOUT
            : ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE,
          cause: error,
        },
      );
    }

    if (!response.ok) {
      const clientError = response.status >= 400 && response.status < 500;
      throw new HttpError(
        clientError ? HTTP_STATUS.BAD_GATEWAY : HTTP_STATUS.SERVICE_UNAVAILABLE,
        clientError
          ? "Failed to retrieve valid weather data from upstream provider"
          : "Weather provider is unavailable",
        {
          code: clientError
            ? ERROR_CODES.WEATHER_UPSTREAM_CLIENT_ERROR
            : ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE,
          details: { statusCode: response.status },
        },
      );
    }

    try {
      return await response.json();
    } catch {
      throw invalidResponse("body", "not JSON");
    }
  }

  /**
   * An unreachable air-quality service or an absent value leaves the factor
   * missing; only a response that contradicts its own shape is an error.
   */
  private async getUsAqi(
    params: Record<string, string>,
    hourKey: string,
  ): Promise<number | undefined> {
    let body: unknown;
    try {
      body = await this.getJson(AIR_QUALITY_URL, {
        ...params,
        hourly: "us_aqi",
      });
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.code !== ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE
      ) {
        return undefined;
      }
      throw error;
    }
    const { hourly } = parseResponse(HourlyAirQualitySchema, body);
    const index = hourly?.time.indexOf(hourKey) ?? -1;
    return hourly?.us_aqi[index] ?? undefined;
  }

  async getObservation(
    place: Pick<Place, "latitude" | "longitude">,
    moment: MomentTarget,
  ): Promise<WeatherReading> {
    const common = {
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: "Asia/Tokyo",
      start_date: moment.date,
      end_date: moment.date,
    };
    const hourKey = `${moment.date}T${String(moment.hour).padStart(2, "0")}:00`;
    const [forecastBody, usAqi] = await Promise.all([
      this.getJson(FORECAST_URL, {
        ...common,
        hourly:
          "weather_code,temperature_2m,wind_speed_10m,relative_humidity_2m,visibility,precipitation_probability,uv_index",
        wind_speed_unit: "ms",
      }),
      this.getUsAqi(common, hourKey),
    ]);

    const { hourly } = parseResponse(HourlyForecastSchema, forecastBody);
    const index = hourly.time.indexOf(hourKey);
    if (index === -1) throw invalidResponse("hourly.time", hourKey);

    const code = hourly.weather_code[index];
    const visibilityMetres = hourly.visibility[index];
    const parsed = ObservationSchema.safeParse(
      withoutUndefined({
        condition: code == null ? undefined : conditionFromWmoCode(code),
        temperature: hourly.temperature_2m[index] ?? undefined,
        windSpeed: hourly.wind_speed_10m[index] ?? undefined,
        humidity: hourly.relative_humidity_2m[index] ?? undefined,
        visibility:
          visibilityMetres == null ? undefined : visibilityMetres / 1000,
        precipitationProbability:
          hourly.precipitation_probability[index] ?? undefined,
        uvIndex: hourly.uv_index[index] ?? undefined,
        airQuality:
          usAqi === undefined ? undefined : airQualityFromUsAqi(usAqi),
      }),
    );
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw invalidResponse(
        issue?.path.join(".") ?? "observation",
        issue?.message,
      );
    }

    return {
      observation: parsed.data,
      source: OPEN_METEO_SOURCE,
      fetchedAt: this.now().toISOString(),
    };
  }

  async getDailyObservations(
    _place: Pick<Place, "latitude" | "longitude">,
  ): Promise<DailyWeatherReading> {
    return { days: [], source: "", fetchedAt: "" };
  }
}
