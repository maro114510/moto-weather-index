import { beforeEach, describe, expect, mock, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";
import { getJstDateString } from "../utils/dateUtils";

const mockFetch = mock();

globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

const { app } = await import("./router");

const testEnv = {
  WEATHERAPI_KEY: "test-key",
  DB: {} as D1Database,
};

function buildTwoHourForecastResponse(targetDate: string) {
  return {
    forecast: {
      forecastday: [
        {
          date: targetDate,
          hour: [
            {
              time_epoch: Date.parse(`${targetDate}T10:00:00+09:00`) / 1000,
              temp_c: 16,
              wind_kph: 10.8,
              humidity: 55,
              vis_km: 10,
              uv: 3,
              chance_of_rain: 20,
              condition: { code: 1000 },
              air_quality: { "us-epa-index": 1 },
            },
            {
              time_epoch: Date.parse(`${targetDate}T14:00:00+09:00`) / 1000,
              temp_c: 28,
              wind_kph: 10.8,
              humidity: 55,
              vis_km: 10,
              uv: 3,
              chance_of_rain: 20,
              condition: { code: 1000 },
              air_quality: { "us-epa-index": 1 },
            },
          ],
        },
      ],
    },
  };
}

describe("hourly datetime semantics across endpoints", () => {
  beforeEach(() => {
    process.env.WEATHERAPI_KEY = "test-key";
    mockFetch.mockReset();
  });

  test("weather and touring-index use the same hourly record for the requested instant", async () => {
    const targetDate = getJstDateString();
    const requestedAt = `${targetDate}T14:00:00+09:00`;
    mockFetch.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(buildTwoHourForecastResponse(targetDate)), {
          status: 200,
        }),
      ),
    );

    const weatherRes = await app.request(
      `http://localhost/api/v1/weather?lat=35.6762&lon=139.6503&datetime=${encodeURIComponent(requestedAt)}`,
      {},
      testEnv,
    );
    const touringRes = await app.request(
      `http://localhost/api/v1/touring-index?lat=35.6762&lon=139.6503&datetime=${encodeURIComponent(requestedAt)}`,
      {},
      testEnv,
    );
    const weather = (await weatherRes.json()) as {
      datetime: string;
      temperature: number;
    };
    const touring = (await touringRes.json()) as {
      datetime: string;
      factors: Record<string, number>;
    };

    expect(weatherRes.status).toBe(HTTP_STATUS.OK);
    expect(touringRes.status).toBe(HTTP_STATUS.OK);
    expect(weather.datetime).toBe(requestedAt);
    expect(touring.datetime).toBe(weather.datetime);
    expect(weather.temperature).toBe(28);
    expect(touring.factors.weather).toBe(30);
    expect(touring.factors.temperature).toBe(14);
  });

  test("weather endpoint rejects a datetime outside the provider range without an upstream call", async () => {
    const res = await app.request(
      "http://localhost/api/v1/weather?lat=35.6762&lon=139.6503&datetime=2030-01-01T00:00:00Z",
      {},
      testEnv,
    );
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(body.error).toContain("outside the supported");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
