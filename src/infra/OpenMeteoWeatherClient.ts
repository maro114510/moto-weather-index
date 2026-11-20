import type { Observation, Place, Target } from "../domain/TouringIndex";
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
  ): Promise<any> {
    const url = `${base}?${new URLSearchParams(params).toString()}`;
    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });
    return response.json();
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
    const [forecast, airQuality] = await Promise.all([
      this.getJson(FORECAST_URL, {
        ...common,
        hourly:
          "weather_code,temperature_2m,wind_speed_10m,relative_humidity_2m,visibility,precipitation_probability,uv_index",
        wind_speed_unit: "ms",
      }),
      this.getJson(AIR_QUALITY_URL, { ...common, hourly: "us_aqi" }),
    ]);

    const hourKey = `${moment.date}T${String(moment.hour).padStart(2, "0")}:00`;
    const index = forecast.hourly.time.indexOf(hourKey);
    const hourly = forecast.hourly;
    const aqi =
      airQuality.hourly.us_aqi[airQuality.hourly.time.indexOf(hourKey)];

    return {
      observation: withoutUndefined({
        condition: conditionFromWmoCode(hourly.weather_code[index]),
        temperature: hourly.temperature_2m[index],
        windSpeed: hourly.wind_speed_10m[index],
        humidity: hourly.relative_humidity_2m[index],
        visibility: hourly.visibility[index] / 1000,
        precipitationProbability: hourly.precipitation_probability[index],
        uvIndex: hourly.uv_index[index],
        airQuality: airQualityFromUsAqi(aqi),
      }),
      source: OPEN_METEO_SOURCE,
      fetchedAt: this.now().toISOString(),
    };
  }

  async getDailyObservations(
    _place: Pick<Place, "latitude" | "longitude">,
    _startDate: string,
  ): Promise<DailyWeatherReading> {
    return { days: [], source: "", fetchedAt: "" };
  }
}
