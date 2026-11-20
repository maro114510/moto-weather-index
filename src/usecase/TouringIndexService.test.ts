import { describe, expect, test } from "bun:test";
import { ERROR_CODES } from "../constants/errorCodes";
import { HttpError } from "../domain/HttpError";
import type { Observation } from "../domain/TouringIndex";
import {
  type DailyWeatherReading,
  type ReadingCache,
  TouringIndexService,
  type WeatherReading,
  type WeatherSource,
} from "./TouringIndexService";

const shibuya = { name: "渋谷", latitude: 35.6589, longitude: 139.70665 };
const tenOClock = { type: "moment", date: "2026-11-20", hour: 10 } as const;
const fixedNow = new Date("2026-11-20T01:30:00Z");

const completeObservation: Observation = {
  condition: "clear",
  temperature: 21.5,
  windSpeed: 3,
  humidity: 50,
  visibility: 20,
  precipitationProbability: 0,
  uvIndex: 2,
  airQuality: "low",
};

function fakeSource(
  observation: Observation = completeObservation,
  fetchedAt = "2026-11-20T01:25:00.000Z",
) {
  const calls = { moment: 0, daily: 0 };
  const source: WeatherSource = {
    async getObservation(): Promise<WeatherReading> {
      calls.moment++;
      return { observation, source: "Open-Meteo", fetchedAt };
    },
    async getDailyObservations(): Promise<DailyWeatherReading> {
      calls.daily++;
      return {
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-11-${20 + i}`,
          observation,
        })),
        source: "Open-Meteo",
        fetchedAt,
      };
    },
  };
  return { source, calls };
}

function memoryCache() {
  const store = new Map<string, unknown>();
  const cache: ReadingCache = {
    async get(key) {
      return store.get(key);
    },
    async put(key, value) {
      store.set(key, JSON.parse(JSON.stringify(value)));
    },
  };
  return { cache, store };
}

function serviceWith(
  source: WeatherSource,
  cache: ReadingCache,
  now = fixedNow,
) {
  return new TouringIndexService(source, cache, () => now);
}

describe("TouringIndexService.indexAt", () => {
  test("scores the observation for the place and moment and names its source and freshness", async () => {
    const { source } = fakeSource();
    const service = serviceWith(source, memoryCache().cache);

    const index = await service.indexAt(shibuya, tenOClock);

    expect(index.score).toBe(100);
    expect(index.confidence).toBe("high");
    expect(index.place).toEqual(shibuya);
    expect(index.target).toEqual(tenOClock);
    expect(index.source).toBe("Open-Meteo");
    expect(index.freshness).toBe("2026-11-20T01:25:00.000Z");
  });

  test("makes no upstream call for the second identical request and keeps the original freshness", async () => {
    const { source, calls } = fakeSource();
    const service = serviceWith(source, memoryCache().cache);

    await service.indexAt(shibuya, tenOClock);
    const second = await service.indexAt(shibuya, tenOClock);

    expect(calls.moment).toBe(1);
    expect(second.freshness).toBe("2026-11-20T01:25:00.000Z");
  });

  test("reuses the observation for coordinates that round to the same place", async () => {
    const { source, calls } = fakeSource();
    const service = serviceWith(source, memoryCache().cache);

    await service.indexAt(shibuya, tenOClock);
    await service.indexAt(
      { ...shibuya, latitude: 35.6612, longitude: 139.7101 },
      tenOClock,
    );

    expect(calls.moment).toBe(1);
  });

  test("names the requested place on a reused observation, not the first requester's", async () => {
    const { source } = fakeSource();
    const service = serviceWith(source, memoryCache().cache);

    await service.indexAt(shibuya, tenOClock);
    const second = await service.indexAt(
      { name: "近所", latitude: 35.6612, longitude: 139.7101 },
      tenOClock,
    );

    expect(second.place.name).toBe("近所");
  });

  test("asks again for another hour, another day, or a place that rounds elsewhere", async () => {
    const { source, calls } = fakeSource();
    const service = serviceWith(source, memoryCache().cache);

    await service.indexAt(shibuya, tenOClock);
    await service.indexAt(shibuya, { ...tenOClock, hour: 11 });
    await service.indexAt(shibuya, { ...tenOClock, date: "2026-11-21" });
    await service.indexAt({ ...shibuya, latitude: 35.7 }, tenOClock);

    expect(calls.moment).toBe(4);
  });

  test("returns an index with lower confidence and the missing factors named when air quality is absent", async () => {
    const { airQuality: _omitted, ...withoutAirQuality } = completeObservation;
    const { source } = fakeSource(withoutAirQuality);
    const service = serviceWith(source, memoryCache().cache);

    const index = await service.indexAt(shibuya, tenOClock);

    expect(index.missingFactors).toEqual(["airQuality"]);
    expect(index.confidence).toBe("medium");
    expect(index.score).toBe(100);
  });

  test("fails with a not-found code when the observation has no factor at all", async () => {
    const { source } = fakeSource({});
    const service = serviceWith(source, memoryCache().cache);

    const error = await service.indexAt(shibuya, tenOClock).catch((e) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
    expect(error.code).toBe(ERROR_CODES.WEATHER_DATA_NOT_FOUND);
  });

  test("asks upstream again when the cached entry is not a valid reading", async () => {
    const { source, calls } = fakeSource();
    const { cache, store } = memoryCache();
    const service = serviceWith(source, cache);
    await service.indexAt(shibuya, tenOClock);
    for (const key of store.keys()) store.set(key, { observation: "garbage" });

    const index = await service.indexAt(shibuya, tenOClock);

    expect(calls.moment).toBe(2);
    expect(index.score).toBe(100);
  });

  test("still answers when the cache fails to read or write", async () => {
    const { source, calls } = fakeSource();
    const broken: ReadingCache = {
      async get() {
        throw new Error("cache down");
      },
      async put() {
        throw new Error("cache down");
      },
    };
    const service = serviceWith(source, broken);

    const index = await service.indexAt(shibuya, tenOClock);

    expect(index.score).toBe(100);
    expect(calls.moment).toBe(1);
  });

  test("does not hide an upstream failure behind the cache", async () => {
    const failing: WeatherSource = {
      async getObservation() {
        throw new HttpError(503, "Weather provider is unavailable", {
          code: ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE,
        });
      },
      async getDailyObservations() {
        throw new Error("unused");
      },
    };
    const service = serviceWith(failing, memoryCache().cache);

    const error = await service.indexAt(shibuya, tenOClock).catch((e) => e);

    expect(error.code).toBe(ERROR_CODES.WEATHER_UPSTREAM_UNAVAILABLE);
  });
});

describe("TouringIndexService.horizon", () => {
  test("returns one index for each of seven days from a single upstream call", async () => {
    const { source, calls } = fakeSource();
    const service = serviceWith(source, memoryCache().cache);

    const indices = await service.horizon(shibuya);

    expect(indices).toHaveLength(7);
    expect(indices[0].target).toEqual({ type: "day", date: "2026-11-20" });
    expect(indices.every((i) => i.place.name === "渋谷")).toBe(true);
    expect(calls).toEqual({ moment: 0, daily: 1 });
  });

  test("makes no upstream call for a repeated horizon request on the same day", async () => {
    const { source, calls } = fakeSource();
    const service = serviceWith(source, memoryCache().cache);

    await service.horizon(shibuya);
    await service.horizon(shibuya);

    expect(calls.daily).toBe(1);
  });

  test("asks again once the Japan Standard Time date has changed", async () => {
    const { source, calls } = fakeSource();
    const { cache } = memoryCache();

    await serviceWith(source, cache, fixedNow).horizon(shibuya);
    await serviceWith(source, cache, new Date("2026-11-20T15:30:00Z")).horizon(
      shibuya,
    );

    expect(calls.daily).toBe(2);
  });

  test("keeps the missing factors of each day instead of failing the week", async () => {
    const { airQuality: _omitted, ...withoutAirQuality } = completeObservation;
    const { source } = fakeSource(withoutAirQuality);
    const service = serviceWith(source, memoryCache().cache);

    const indices = await service.horizon(shibuya);

    expect(indices.every((i) => i.missingFactors[0] === "airQuality")).toBe(
      true,
    );
  });
});
