import { describe, expect, test } from "bun:test";
import { ApiError, getHorizon, getIndex, searchPlaces } from "./api";
import { completeIndex, weekOf } from "./testing/fixtures";
import { installFakeApi, json } from "./testing/network";

const shibuya = { name: "渋谷", latitude: 35.6589, longitude: 139.70665 };
const fake = installFakeApi();

describe("getIndex", () => {
  test("asks /api/index for the place and returns the index", async () => {
    fake.answer(() => json(completeIndex()));

    const index = await getIndex(shibuya);

    const url = fake.requests[0];
    expect(url.pathname).toBe("/api/index");
    expect(url.searchParams.get("lat")).toBe("35.6589");
    expect(url.searchParams.get("lon")).toBe("139.70665");
    expect(url.searchParams.get("name")).toBe("渋谷");
    expect(url.searchParams.has("date")).toBe(false);
    expect(index.score).toBe(100);
  });

  test("sends the date and hour when the rider chose a moment", async () => {
    fake.answer(() => json(completeIndex()));

    await getIndex(shibuya, { date: "2026-11-22", hour: 7 });

    const url = fake.requests[0];
    expect(url.searchParams.get("date")).toBe("2026-11-22");
    expect(url.searchParams.get("hour")).toBe("7");
  });

  test("raises an ApiError carrying the server message and status on a failure", async () => {
    fake.answer(() =>
      json({ error: "Weather data is unavailable", requestId: "r1" }, 404),
    );

    const error = await getIndex(shibuya).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("Weather data is unavailable");
  });

  test("raises an ApiError when the body is not an index", async () => {
    fake.answer(() => json({ unexpected: true }));

    const error = await getIndex(shibuya).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
  });

  test("raises an ApiError when the network is down", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const error = await getIndex(shibuya).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
  });
});

describe("getHorizon", () => {
  test("returns one index per day for the place", async () => {
    const dates = [
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
    ];
    fake.answer(() => json({ place: shibuya, days: weekOf(dates) }));

    const days = await getHorizon(shibuya);

    expect(fake.requests[0].pathname).toBe("/api/horizon");
    expect(fake.requests[0].searchParams.get("lat")).toBe("35.6589");
    expect(days.map((d) => d.target)).toEqual(
      dates.map((date) => ({ type: "day", date })),
    );
  });
});

describe("searchPlaces", () => {
  test("returns the candidates with their region", async () => {
    fake.answer(() =>
      json({ places: [{ ...shibuya, region: "東京都 渋谷区" }] }),
    );

    const places = await searchPlaces("渋谷");

    expect(fake.requests[0].pathname).toBe("/api/places");
    expect(fake.requests[0].searchParams.get("q")).toBe("渋谷");
    expect(places).toEqual([{ ...shibuya, region: "東京都 渋谷区" }]);
  });

  test("raises an ApiError for a rejected query", async () => {
    fake.answer(() => json({ error: "Invalid parameters" }, 400));

    const error = await searchPlaces("").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
  });
});
