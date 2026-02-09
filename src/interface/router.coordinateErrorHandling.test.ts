import { beforeEach, describe, expect, mock, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

const mockAxiosGet = mock();

mock.module("axios", () => {
  const isAxiosError = (err: unknown) =>
    !!err && typeof err === "object" && (err as any).isAxiosError === true;

  return {
    default: {
      get: mockAxiosGet,
      isAxiosError,
    },
    isAxiosError,
  };
});

const { app } = await import("./router");

describe("coordinate-dependent upstream error handling", () => {
  beforeEach(() => {
    process.env.WEATHERAPI_KEY = "test-key";
    mockAxiosGet.mockReset();
  });

  test("returns 404 (not 500) for /api/v1/weather when upstream has no matching location", async () => {
    mockAxiosGet.mockRejectedValue({
      isAxiosError: true,
      code: "ERR_BAD_REQUEST",
      response: {
        status: 400,
        statusText: "Bad Request",
        data: {
          error: {
            code: 1006,
            message: "No matching location found.",
          },
        },
      },
    });

    const res = await app.request(
      "http://localhost/api/v1/weather?lat=0&lon=-140&datetime=2026-02-09",
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(body.error).toContain("unavailable");
  });

  test("returns 404 (not 500) for /api/v1/touring-index when upstream has no matching location", async () => {
    mockAxiosGet.mockRejectedValue({
      isAxiosError: true,
      code: "ERR_BAD_REQUEST",
      response: {
        status: 400,
        statusText: "Bad Request",
        data: {
          error: {
            code: 1006,
            message: "No matching location found.",
          },
        },
      },
    });

    const res = await app.request(
      "http://localhost/api/v1/touring-index?lat=0&lon=-140&datetime=2026-02-09",
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(body.error).toContain("unavailable");
  });

  test("keeps normal coordinate success path for both endpoints", async () => {
    mockAxiosGet.mockResolvedValue({
      status: 200,
      data: {
        forecast: {
          forecastday: [
            {
              date: "2026-02-09",
              day: {
                avgtemp_c: 15,
                maxwind_kph: 10.8,
                avghumidity: 55,
                uv: 3,
                daily_chance_of_rain: "20",
                condition: { code: 1000 },
              },
            },
          ],
        },
      },
    });

    const weatherRes = await app.request(
      "http://localhost/api/v1/weather?lat=35.6762&lon=139.6503&datetime=2026-02-09",
    );
    expect(weatherRes.status).toBe(HTTP_STATUS.OK);

    const touringRes = await app.request(
      "http://localhost/api/v1/touring-index?lat=35.6762&lon=139.6503&datetime=2026-02-09",
    );
    expect(touringRes.status).toBe(HTTP_STATUS.OK);
  });
});
