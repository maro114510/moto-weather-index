import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ERROR_CODES } from "../constants/errorCodes";
import { HttpError } from "../domain/HttpError";
import type { AirQualityLevel, WeatherCondition } from "../domain/Weather";
import airQualityMoment from "./fixtures/openMeteo/air-quality-moment.json";
import airQualityWeek from "./fixtures/openMeteo/air-quality-week.json";
import forecastMoment from "./fixtures/openMeteo/forecast-moment.json";
import forecastWeek from "./fixtures/openMeteo/forecast-week.json";
import { OpenMeteoWeatherClient } from "./OpenMeteoWeatherClient";

const FORECAST_HOST = "api.open-meteo.com";
const AIR_QUALITY_HOST = "air-quality-api.open-meteo.com";

const tokyo = { latitude: 35.68, longitude: 139.76 };
const tenOClock = { type: "moment", date: "2026-11-20", hour: 10 } as const;
const fixedNow = new Date("2026-11-20T01:30:00Z");

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Routes each request to the handler registered for its host and records it. */
function fakeProvider(handlers: Partial<Record<string, Handler>>) {
  const requests: { url: URL; init?: RequestInit }[] = [];
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    requests.push({ url, init });
    const handler = handlers[url.host];
    if (!handler) throw new Error(`unexpected host ${url.host}`);
    return handler(url, init);
  }) as typeof fetch;
  return { fetch: fetchFake, requests };
}

function clientWith(handlers: Partial<Record<string, Handler>>) {
  const provider = fakeProvider(handlers);
  const client = new OpenMeteoWeatherClient({
    fetch: provider.fetch,
    now: () => fixedNow,
  });
  return { client, requests: provider.requests };
}

const recordedMoment = {
  [FORECAST_HOST]: () => json(structuredClone(forecastMoment)),
  [AIR_QUALITY_HOST]: () => json(structuredClone(airQualityMoment)),
};

describe("OpenMeteoWeatherClient.getObservation", () => {
  test("returns the eight factors of the requested hour from recorded responses", async () => {
    const { client } = clientWith(recordedMoment);

    const reading = await client.getObservation(tokyo, tenOClock);

    expect(reading.observation).toEqual({
      condition: "clear",
      temperature: 13.1,
      windSpeed: 3.76,
      humidity: 35,
      visibility: 19.22,
      precipitationProbability: 0,
      uvIndex: 2.8,
      airQuality: "medium",
    });
    expect(reading.source).toBe("Open-Meteo");
    expect(reading.fetchedAt).toBe("2026-11-20T01:30:00.000Z");
  });

  test("selects the hour asked for, not the first hour of the day", async () => {
    const { client } = clientWith(recordedMoment);

    const reading = await client.getObservation(tokyo, {
      type: "moment",
      date: "2026-11-20",
      hour: 8,
    });

    expect(reading.observation.temperature).toBe(10.6);
    expect(reading.observation.visibility).toBe(9.1);
    expect(reading.observation.airQuality).toBe("medium");
  });

  test("asks Open-Meteo for the place in metres per second and Japan Standard Time", async () => {
    const { client, requests } = clientWith(recordedMoment);

    await client.getObservation(tokyo, tenOClock);

    const forecast = requests.find((r) => r.url.host === FORECAST_HOST);
    const airQuality = requests.find((r) => r.url.host === AIR_QUALITY_HOST);
    for (const request of [forecast, airQuality]) {
      expect(request?.url.searchParams.get("latitude")).toBe("35.68");
      expect(request?.url.searchParams.get("longitude")).toBe("139.76");
      expect(request?.url.searchParams.get("timezone")).toBe("Asia/Tokyo");
      expect(request?.url.searchParams.get("start_date")).toBe("2026-11-20");
      expect(request?.url.searchParams.get("end_date")).toBe("2026-11-20");
    }
    expect(forecast?.url.searchParams.get("wind_speed_unit")).toBe("ms");
  });

  describe("without a provider credential", () => {
    const keyNames = [
      "WEATHERAPI_KEY",
      "WEATHER_API_KEY",
      "OPEN_METEO_API_KEY",
    ];
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
      for (const name of keyNames) {
        saved[name] = process.env[name];
        process.env[name] = "sentinel-secret";
      }
    });
    afterEach(() => {
      for (const name of keyNames) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
    });

    test("sends no key, token, or authorization header although credentials sit in the environment", async () => {
      const { client, requests } = clientWith(recordedMoment);

      const reading = await client.getObservation(tokyo, tenOClock);

      expect(reading.observation.temperature).toBe(13.1);
      expect(requests.length).toBeGreaterThan(0);
      for (const { url, init } of requests) {
        expect(url.href).not.toContain("sentinel-secret");
        expect([...url.searchParams.keys()]).not.toContain("apikey");
        expect([...url.searchParams.keys()]).not.toContain("key");
        expect(JSON.stringify(init?.headers ?? {})).not.toContain("sentinel");
        expect(new Headers(init?.headers).has("authorization")).toBe(false);
      }
    });
  });

  describe("WMO weather code mapping", () => {
    const cases: [number, WeatherCondition][] = [
      [0, "clear"],
      [1, "mostly_clear"],
      [2, "partly_cloudy"],
      [3, "overcast"],
      [45, "fog"],
      [48, "fog"],
      [51, "drizzle"],
      [53, "drizzle"],
      [55, "drizzle"],
      [56, "drizzle"],
      [57, "drizzle"],
      [61, "drizzle"],
      [80, "drizzle"],
      [63, "rain"],
      [65, "rain"],
      [66, "rain"],
      [67, "rain"],
      [81, "rain"],
      [82, "rain"],
      [95, "rain"],
      [96, "rain"],
      [99, "rain"],
      [71, "snow"],
      [73, "snow"],
      [75, "snow"],
      [77, "snow"],
      [85, "snow"],
      [86, "snow"],
      [4, "unknown"],
    ];
    for (const [code, condition] of cases) {
      test(`maps WMO code ${code} to ${condition}`, async () => {
        const forecast = structuredClone(forecastMoment);
        forecast.hourly.weather_code[10] = code;
        const { client } = clientWith({
          ...recordedMoment,
          [FORECAST_HOST]: () => json(forecast),
        });

        const reading = await client.getObservation(tokyo, tenOClock);

        expect(reading.observation.condition).toBe(condition);
      });
    }
  });

  describe("air quality level from the US AQI", () => {
    const cases: [number, AirQualityLevel][] = [
      [0, "low"],
      [50, "low"],
      [51, "medium"],
      [100, "medium"],
      [101, "high"],
      [500, "high"],
    ];
    for (const [aqi, level] of cases) {
      test(`maps US AQI ${aqi} to ${level}`, async () => {
        const airQuality = structuredClone(airQualityMoment);
        airQuality.hourly.us_aqi[10] = aqi;
        const { client } = clientWith({
          ...recordedMoment,
          [AIR_QUALITY_HOST]: () => json(airQuality),
        });

        const reading = await client.getObservation(tokyo, tenOClock);

        expect(reading.observation.airQuality).toBe(level);
      });
    }
  });
});

/** A fresh, mutable copy of a recorded response. */
function recorded(body: unknown): any {
  return structuredClone(body);
}

describe("OpenMeteoWeatherClient.getObservation with incomplete coverage", () => {
  test("yields a missing air quality, not an error, when the air-quality value for the hour is null", async () => {
    const airQuality = recorded(airQualityMoment);
    airQuality.hourly.us_aqi[10] = null;
    const { client } = clientWith({
      ...recordedMoment,
      [AIR_QUALITY_HOST]: () => json(airQuality),
    });

    const reading = await client.getObservation(tokyo, tenOClock);

    expect(reading.observation).toEqual({
      condition: "clear",
      temperature: 13.1,
      windSpeed: 3.76,
      humidity: 35,
      visibility: 19.22,
      precipitationProbability: 0,
      uvIndex: 2.8,
    });
    expect("airQuality" in reading.observation).toBe(false);
  });

  test("yields a missing air quality when the air-quality response has no hourly data", async () => {
    const { client } = clientWith({
      ...recordedMoment,
      [AIR_QUALITY_HOST]: () => json({ latitude: 35.7, longitude: 139.8 }),
    });

    const reading = await client.getObservation(tokyo, tenOClock);

    expect(reading.observation.temperature).toBe(13.1);
    expect("airQuality" in reading.observation).toBe(false);
  });

  test("yields a missing air quality when the air-quality service is unavailable", async () => {
    const { client } = clientWith({
      ...recordedMoment,
      [AIR_QUALITY_HOST]: () => json({ error: true, reason: "down" }, 503),
    });

    const reading = await client.getObservation(tokyo, tenOClock);

    expect(reading.observation.temperature).toBe(13.1);
    expect("airQuality" in reading.observation).toBe(false);
  });

  test("yields a missing factor for any other value the forecast reports as null", async () => {
    const forecast = recorded(forecastMoment);
    forecast.hourly.visibility[10] = null;
    forecast.hourly.uv_index[10] = null;
    const { client } = clientWith({
      ...recordedMoment,
      [FORECAST_HOST]: () => json(forecast),
    });

    const reading = await client.getObservation(tokyo, tenOClock);

    expect("visibility" in reading.observation).toBe(false);
    expect("uvIndex" in reading.observation).toBe(false);
    expect(reading.observation.temperature).toBe(13.1);
  });
});

describe("OpenMeteoWeatherClient.getObservation rejecting invalid responses", () => {
  async function failureOf(
    handlers: Partial<Record<string, Handler>>,
  ): Promise<HttpError> {
    const { client } = clientWith(handlers);
    try {
      await client.getObservation(tokyo, tenOClock);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      return error as HttpError;
    }
    throw new Error("expected the call to fail");
  }

  const invalidForecasts: [string, (f: any) => void][] = [
    ["a forecast without hourly data", (f) => delete f.hourly],
    ["a humidity above 100", (f) => (f.hourly.relative_humidity_2m[10] = 150)],
    [
      "a temperature reported as text",
      (f) => (f.hourly.temperature_2m[10] = "warm"),
    ],
    ["a negative wind speed", (f) => (f.hourly.wind_speed_10m[10] = -3)],
    [
      "a forecast that omits the requested hour",
      (f) => (f.hourly.time[10] = "2026-11-20T10:30"),
    ],
    [
      "a weather code reported as text",
      (f) => (f.hourly.weather_code[10] = "clear"),
    ],
  ];
  for (const [name, corrupt] of invalidForecasts) {
    test(`fails with 502 and an invalid-response code for ${name}`, async () => {
      const forecast = recorded(forecastMoment);
      corrupt(forecast);

      const error = await failureOf({
        ...recordedMoment,
        [FORECAST_HOST]: () => json(forecast),
      });

      expect(error.status).toBe(502);
      expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE);
    });
  }

  test("fails with 502 and an invalid-response code for an air-quality value that is not a number", async () => {
    const airQuality = recorded(airQualityMoment);
    airQuality.hourly.us_aqi[10] = "bad";

    const error = await failureOf({
      ...recordedMoment,
      [AIR_QUALITY_HOST]: () => json(airQuality),
    });

    expect(error.status).toBe(502);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE);
  });

  test("fails with 502 and a client-error code when the forecast rejects the request", async () => {
    const error = await failureOf({
      ...recordedMoment,
      [FORECAST_HOST]: () => json({ error: true, reason: "out of range" }, 400),
    });

    expect(error.status).toBe(502);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_CLIENT_ERROR);
  });

  test("fails with 503 and an unavailable code when the forecast service errors", async () => {
    const error = await failureOf({
      ...recordedMoment,
      [FORECAST_HOST]: () => json({ error: true }, 500),
    });

    expect(error.status).toBe(503);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE);
  });

  test("fails with 503 and an unavailable code when the network fails", async () => {
    const error = await failureOf({
      ...recordedMoment,
      [FORECAST_HOST]: () => {
        throw new TypeError("fetch failed");
      },
    });

    expect(error.status).toBe(503);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE);
  });

  test("fails with 504 and a timeout code when the forecast does not answer in time", async () => {
    const error = await failureOf({
      ...recordedMoment,
      [FORECAST_HOST]: () => {
        throw new DOMException("timed out", "TimeoutError");
      },
    });

    expect(error.status).toBe(504);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_TIMEOUT);
  });
});

const recordedWeek = {
  [FORECAST_HOST]: () => json(recorded(forecastWeek)),
  [AIR_QUALITY_HOST]: () => json(recorded(airQualityWeek)),
};

describe("OpenMeteoWeatherClient.getDailyObservations", () => {
  test("returns one observation for each of the seven days from today in Japan Standard Time", async () => {
    const { client } = clientWith(recordedWeek);

    const reading = await client.getDailyObservations(tokyo);

    expect(reading.days.map((d) => d.date)).toEqual([
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
    ]);
    expect(reading.source).toBe("Open-Meteo");
    expect(reading.fetchedAt).toBe("2026-11-20T01:30:00.000Z");
  });

  test("aggregates a day into its mean temperature, humidity and visibility, and its peak wind, precipitation probability, UV index and AQI", async () => {
    const { client } = clientWith(recordedWeek);

    const reading = await client.getDailyObservations(tokyo);

    const first = reading.days[0].observation;
    expect(first.condition).toBe("clear");
    expect(first.temperature).toBe(10.8);
    expect(first.windSpeed).toBe(4.2);
    expect(first.humidity).toBe(44);
    expect(first.precipitationProbability).toBe(8);
    expect(first.uvIndex).toBe(3.75);
    expect(first.visibility).toBeCloseTo(40.53, 2);
    expect(first.airQuality).toBe("medium");

    const rainy = reading.days[4].observation;
    expect(rainy.condition).toBe("drizzle");
    expect(rainy.windSpeed).toBe(7.17);
    expect(rainy.precipitationProbability).toBe(77);
    expect(rainy.visibility).toBeCloseTo(17.67, 2);
  });

  test("reports the worst air quality of the day", async () => {
    const { client } = clientWith(recordedWeek);

    const reading = await client.getDailyObservations(tokyo);

    expect(reading.days[3].observation.airQuality).toBe("high");
  });

  test("leaves air quality missing for the days beyond the air-quality horizon, not an error", async () => {
    const { client } = clientWith(recordedWeek);

    const reading = await client.getDailyObservations(tokyo);

    expect(reading.days[4].observation.airQuality).toBe("high");
    for (const day of reading.days.slice(5)) {
      expect("airQuality" in day.observation).toBe(false);
      expect(day.observation.temperature).toBeDefined();
    }
  });

  test("leaves the factors missing when the day's air-quality service is unavailable", async () => {
    const { client } = clientWith({
      ...recordedWeek,
      [AIR_QUALITY_HOST]: () => json({ error: true }, 400),
    });

    const reading = await client.getDailyObservations(tokyo);

    expect(reading.days).toHaveLength(7);
    for (const day of reading.days) {
      expect("airQuality" in day.observation).toBe(false);
    }
  });

  test("asks for exactly the seven days from today, with the same units and no credential", async () => {
    const { client, requests } = clientWith(recordedWeek);

    await client.getDailyObservations(tokyo);

    for (const { url, init } of requests) {
      expect(url.searchParams.get("start_date")).toBe("2026-11-20");
      expect(url.searchParams.get("end_date")).toBe("2026-11-26");
      expect(url.searchParams.get("timezone")).toBe("Asia/Tokyo");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect([...url.searchParams.keys()]).not.toContain("apikey");
    }
    const forecast = requests.find((r) => r.url.host === FORECAST_HOST);
    expect(forecast?.url.searchParams.get("wind_speed_unit")).toBe("ms");
  });

  test("starts at the Japan Standard Time date when UTC is still the previous day", async () => {
    const provider = fakeProvider(recordedWeek);
    const client = new OpenMeteoWeatherClient({
      fetch: provider.fetch,
      now: () => new Date("2026-11-19T16:30:00Z"),
    });

    await client.getDailyObservations(tokyo);

    expect(provider.requests[0].url.searchParams.get("start_date")).toBe(
      "2026-11-20",
    );
  });

  test("yields a missing visibility when no hour of the day reports it", async () => {
    const forecast = recorded(forecastWeek);
    for (let i = 0; i < 24; i++) forecast.hourly.visibility[i] = null;
    const { client } = clientWith({
      ...recordedWeek,
      [FORECAST_HOST]: () => json(forecast),
    });

    const reading = await client.getDailyObservations(tokyo);

    expect("visibility" in reading.days[0].observation).toBe(false);
    expect(reading.days[1].observation.visibility).toBeCloseTo(40.47, 2);
  });

  test("fails with 502 when the forecast omits a day of the horizon", async () => {
    const forecast = recorded(forecastWeek);
    for (const key of Object.keys(forecast.daily)) forecast.daily[key].pop();
    const { client } = clientWith({
      ...recordedWeek,
      [FORECAST_HOST]: () => json(forecast),
    });

    const error = await client.getDailyObservations(tokyo).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(502);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE);
  });

  test("fails with 502 when a daily value is outside its documented range", async () => {
    const forecast = recorded(forecastWeek);
    forecast.daily.relative_humidity_2m_mean[2] = 180;
    const { client } = clientWith({
      ...recordedWeek,
      [FORECAST_HOST]: () => json(forecast),
    });

    const error = await client.getDailyObservations(tokyo).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(502);
    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_INVALID_RESPONSE);
  });

  test("fails with 503 when the forecast service errors", async () => {
    const { client } = clientWith({
      ...recordedWeek,
      [FORECAST_HOST]: () => json({ error: true }, 500),
    });

    const error = await client.getDailyObservations(tokyo).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(503);
  });
});
