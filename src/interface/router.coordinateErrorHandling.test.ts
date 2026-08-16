import { beforeEach, describe, expect, mock, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

const mockFetch = mock();

globalThis.fetch = mockFetch as typeof globalThis.fetch;

const { app } = await import("./router");

const testEnv = {
  WEATHERAPI_KEY: "test-key",
  DB: {} as D1Database,
};

describe("coordinate-dependent upstream error handling", () => {
  beforeEach(() => {
    process.env.WEATHERAPI_KEY = "test-key";
    mockFetch.mockReset();
  });

  test("returns 404 (not 500) for /api/v1/weather when upstream has no matching location", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 1006,
              message: "No matching location found.",
            },
          }),
          { status: 400, statusText: "Bad Request" },
        ),
      ),
    );

    const res = await app.request(
      "http://localhost/api/v1/weather?lat=0&lon=-140&datetime=2026-02-09",
      {},
      testEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(body.error).toContain("unavailable");
  });

  test("returns 404 (not 500) for /api/v1/touring-index when upstream has no matching location", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 1006,
              message: "No matching location found.",
            },
          }),
          { status: 400, statusText: "Bad Request" },
        ),
      ),
    );

    const res = await app.request(
      "http://localhost/api/v1/touring-index?lat=0&lon=-140&datetime=2026-02-09",
      {},
      testEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(body.error).toContain("unavailable");
  });

  test("keeps normal coordinate success path for both endpoints", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            forecast: {
              forecastday: [
                {
                  date: "2026-02-09",
                  hour: [
                    {
                      time_epoch: Date.parse("2026-02-08T15:00:00Z") / 1000,
                      temp_c: 15,
                      wind_kph: 10.8,
                      humidity: 55,
                      vis_km: 10,
                      uv: 3,
                      chance_of_rain: "20",
                      condition: { code: 1000 },
                      air_quality: { "us-epa-index": 1 },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const weatherRes = await app.request(
      "http://localhost/api/v1/weather?lat=35.6762&lon=139.6503&datetime=2026-02-09",
      {},
      testEnv,
    );
    expect(weatherRes.status).toBe(HTTP_STATUS.OK);

    const touringRes = await app.request(
      "http://localhost/api/v1/touring-index?lat=35.6762&lon=139.6503&datetime=2026-02-09",
      {},
      testEnv,
    );
    expect(touringRes.status).toBe(HTTP_STATUS.OK);
  });

  test("returns 422 with every unavailable score factor", async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            forecast: {
              forecastday: [
                {
                  date: "2026-02-09",
                  hour: [
                    {
                      time_epoch: Date.parse("2026-02-08T15:00:00Z") / 1000,
                      temp_c: 15,
                      wind_kph: 10.8,
                      humidity: 55,
                      chance_of_rain: "20",
                      uv: 3,
                      condition: { code: 1000 },
                    },
                  ],
                },
              ],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const res = await app.request(
      "http://localhost/api/v1/touring-index?lat=35.6762&lon=139.6503&datetime=2026-02-09",
      {},
      testEnv,
    );

    expect(res.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("required weather observations"),
      missingFactors: ["visibility", "airQuality"],
    });
  });
});
