import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AirQualityLevel, WeatherCondition } from "../domain/Weather";
import airQualityMoment from "./fixtures/openMeteo/air-quality-moment.json";
import forecastMoment from "./fixtures/openMeteo/forecast-moment.json";
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
