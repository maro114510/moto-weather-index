import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";
import geocodingShibuya from "../infra/fixtures/openMeteo/geocoding-shibuya.json";
import { addDaysToDateString, getJstDateString } from "../utils/dateUtils";

const FORECAST_HOST = "api.open-meteo.com";
const AIR_QUALITY_HOST = "air-quality-api.open-meteo.com";
const GEOCODING_HOST = "geocoding-api.open-meteo.com";

const originalFetch = globalThis.fetch;
const originalCaches = (globalThis as { caches?: unknown }).caches;

const today = getJstDateString();
const tomorrow = addDaysToDateString(today, 1);

type Upstream = { host: string; params: URLSearchParams };
let upstream: Upstream[] = [];
let airQualityDown = false;
let forecastDown = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let d = start; d <= end; d = addDaysToDateString(d, 1)) dates.push(d);
  return dates;
}

function hourlyTimes(start: string, end: string): string[] {
  return datesBetween(start, end).flatMap((d) =>
    Array.from(
      { length: 24 },
      (_, h) => `${d}T${String(h).padStart(2, "0")}:00`,
    ),
  );
}

/** Answers for whatever dates are asked, so the tests never depend on the calendar. */
function fakeOpenMeteo(input: RequestInfo | URL): Response {
  const url = new URL(typeof input === "string" ? input : input.toString());
  upstream.push({ host: url.host, params: url.searchParams });
  const start = url.searchParams.get("start_date") ?? today;
  const end = url.searchParams.get("end_date") ?? today;

  if (url.host === GEOCODING_HOST) return json(geocodingShibuya);

  if (url.host === AIR_QUALITY_HOST) {
    if (airQualityDown) return json({}, 500);
    const time = hourlyTimes(start, end);
    return json({ hourly: { time, us_aqi: time.map(() => 40) } });
  }

  if (forecastDown) return json({}, 500);
  const time = hourlyTimes(start, end);
  const constant = (value: number) => time.map(() => value);
  const days = datesBetween(start, end);
  const perDay = (value: number) => days.map(() => value);
  return json({
    hourly: {
      time,
      weather_code: constant(0),
      temperature_2m: constant(21.5),
      wind_speed_10m: constant(3),
      relative_humidity_2m: constant(50),
      visibility: constant(20000),
      precipitation_probability: constant(0),
      uv_index: constant(2),
    },
    daily: {
      time: days,
      weather_code: perDay(0),
      temperature_2m_mean: perDay(21.5),
      wind_speed_10m_max: perDay(3),
      relative_humidity_2m_mean: perDay(50),
      precipitation_probability_max: perDay(0),
      uv_index_max: perDay(2),
    },
  });
}

function installEdgeCache() {
  const entries = new Map<string, Response>();
  (globalThis as { caches?: unknown }).caches = {
    default: {
      async match(request: Request) {
        return entries.get(request.url)?.clone();
      },
      async put(request: Request, response: Response) {
        entries.set(request.url, response);
      },
    },
  };
}

const { app } = await import("./router");
const testEnv = {};

async function get(path: string) {
  return app.request(`http://localhost${path}`, {}, testEnv);
}

const shibuya = "lat=35.6589&lon=139.70665&name=%E6%B8%8B%E8%B0%B7";

beforeEach(() => {
  upstream = [];
  airQualityDown = false;
  forecastDown = false;
  installEdgeCache();
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    fakeOpenMeteo(input)) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  (globalThis as { caches?: unknown }).caches = originalCaches;
});

describe("GET /api/index", () => {
  test("returns the index for the place and moment with every presented field", async () => {
    const res = await get(`/api/index?${shibuya}&date=${tomorrow}&hour=10`);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(body).toMatchObject({
      place: { name: "渋谷", latitude: 35.6589, longitude: 139.70665 },
      target: { type: "moment", date: tomorrow, hour: 10 },
      score: 100,
      rating: { label: "最高", color: "green" },
      missingFactors: [],
      confidence: "high",
      source: "Open-Meteo",
    });
    expect(body.factors).toHaveLength(8);
    expect(body.freshness).toBeString();
  });

  test("makes no upstream call for the second identical request", async () => {
    const path = `/api/index?${shibuya}&date=${tomorrow}&hour=10`;

    await get(path);
    const callsAfterFirst = upstream.length;
    const second = await get(path);

    expect(callsAfterFirst).toBeGreaterThan(0);
    expect(second.status).toBe(HTTP_STATUS.OK);
    expect(upstream.length).toBe(callsAfterFirst);
  });

  test("returns an index with the missing factor named and a lower confidence when air quality is unavailable", async () => {
    airQualityDown = true;

    const res = await get(`/api/index?${shibuya}&date=${tomorrow}&hour=10`);
    const body = (await res.json()) as {
      missingFactors: string[];
      confidence: string;
      score: number;
    };

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(body.missingFactors).toEqual(["airQuality"]);
    expect(body.confidence).toBe("medium");
    expect(body.score).toBe(100);
  });

  test("defaults to the current hour in Japan Standard Time and names the place by its coordinates", async () => {
    const res = await get("/api/index?lat=35.6589&lon=139.70665");
    const body = (await res.json()) as {
      place: { name: string };
      target: { type: string; date: string };
    };

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(body.target.type).toBe("moment");
    expect(body.target.date).toBe(getJstDateString());
    expect(body.place.name).toBe("35.6589,139.70665");
  });

  test("rejects invalid coordinates, hours and dates with 400 in the shared error shape", async () => {
    for (const query of [
      "lat=91&lon=139",
      "lat=abc&lon=139",
      "lon=139",
      `${shibuya}&hour=24`,
      `${shibuya}&hour=x`,
      `${shibuya}&date=2026-02-30`,
      `${shibuya}&date=${addDaysToDateString(today, -1)}`,
      `${shibuya}&date=${addDaysToDateString(today, 16)}`,
    ]) {
      const res = await get(`/api/index?${query}`);
      const body = (await res.json()) as { error: string; requestId: string };

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(body.error).toBe("Invalid parameters");
      expect(body.requestId).toBeString();
    }
    expect(upstream).toHaveLength(0);
  });

  test("reports an unavailable provider as 503 in the shared error shape", async () => {
    forecastDown = true;

    const res = await get(`/api/index?${shibuya}&date=${tomorrow}&hour=10`);
    const body = (await res.json()) as { error: string; requestId: string };

    expect(res.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(body.error).toBe("Weather provider is unavailable");
    expect(body.requestId).toBeString();
  });

  test("still answers when the runtime has no edge cache", async () => {
    (globalThis as { caches?: unknown }).caches = undefined;

    const res = await get(`/api/index?${shibuya}&date=${tomorrow}&hour=10`);

    expect(res.status).toBe(HTTP_STATUS.OK);
  });
});

describe("GET /api/horizon", () => {
  test("returns one index for each of seven days starting today", async () => {
    const res = await get(`/api/horizon?${shibuya}`);
    const body = (await res.json()) as {
      place: { name: string };
      days: { target: { type: string; date: string }; score: number }[];
    };

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(body.place.name).toBe("渋谷");
    expect(body.days).toHaveLength(7);
    expect(body.days[0].target).toEqual({ type: "day", date: today });
    expect(body.days[6].target.date).toBe(addDaysToDateString(today, 6));
    expect(body.days.every((d) => d.score === 100)).toBe(true);
  });

  test("reaches the weather source once for the whole week, not once per day", async () => {
    await get(`/api/horizon?${shibuya}`);

    expect(upstream.filter((u) => u.host === FORECAST_HOST)).toHaveLength(1);
    expect(upstream.filter((u) => u.host === AIR_QUALITY_HOST)).toHaveLength(1);
  });

  test("makes no upstream call for the second identical request", async () => {
    await get(`/api/horizon?${shibuya}`);
    const callsAfterFirst = upstream.length;

    const second = await get(`/api/horizon?${shibuya}`);

    expect(callsAfterFirst).toBeGreaterThan(0);
    expect(second.status).toBe(HTTP_STATUS.OK);
    expect(upstream.length).toBe(callsAfterFirst);
  });

  test("keeps every day when air quality is unavailable, naming it missing on each", async () => {
    airQualityDown = true;

    const res = await get(`/api/horizon?${shibuya}`);
    const body = (await res.json()) as {
      days: { missingFactors: string[] }[];
    };

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(body.days).toHaveLength(7);
    expect(body.days.every((d) => d.missingFactors[0] === "airQuality")).toBe(
      true,
    );
  });

  test("rejects missing coordinates with 400", async () => {
    const res = await get("/api/horizon?lat=35.6");

    expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
  });
});

describe("GET /api/places", () => {
  test("returns the candidates for the query", async () => {
    const res = await get(`/api/places?q=${encodeURIComponent("渋谷")}`);
    const body = (await res.json()) as {
      places: {
        name: string;
        latitude: number;
        longitude: number;
        region?: string;
      }[];
    };

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(body.places).toHaveLength(3);
    expect(body.places[0]).toEqual({
      name: "渋谷",
      latitude: 35.6589,
      longitude: 139.70665,
      region: "東京都 渋谷区",
    });
    expect(upstream[0].host).toBe(GEOCODING_HOST);
  });

  test("rejects an empty, missing or oversized query with 400 and no upstream call", async () => {
    for (const query of ["q=", "", `q=${"a".repeat(101)}`]) {
      const res = await get(`/api/places?${query}`);

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    }
    expect(upstream).toHaveLength(0);
  });
});
