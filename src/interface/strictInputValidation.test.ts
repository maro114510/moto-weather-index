import { describe, expect, mock, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";
import { getTouringIndexHistorySchema } from "../dao/touringIndexSchemas";
import { getWeatherSchema } from "../dao/weatherSchemas";

const mockFetch = mock();
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

const { app } = await import("./router");

const testEnv = {
  WEATHERAPI_KEY: "test-key",
  DB: {} as D1Database,
};

async function request(path: string) {
  return app.request(`http://localhost${path}`, {}, testEnv);
}

describe("strict API input validation", () => {
  test("returns 400 for empty, infinite, and out-of-range coordinates", async () => {
    for (const coordinates of [
      "lat=&lon=139.6503",
      "lat=not-a-number&lon=139.6503",
      "lat=Infinity&lon=139.6503",
      "lat=91&lon=139.6503",
      "lat=35.6762&lon=-181",
    ]) {
      const response = await request(`/api/v1/weather?${coordinates}`);

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    }
  });

  test("returns 400 for invalid or oversized datetime values", async () => {
    for (const datetime of [
      "not-a-date",
      "2024-02-30T12:00:00Z",
      "x".repeat(65),
    ]) {
      const response = await request(
        `/api/v1/touring-index?lat=35.6762&lon=139.6503&datetime=${datetime}`,
      );

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    }
  });

  test("returns 400 for partial, decimal, and exponent prefecture IDs", async () => {
    for (const prefectureId of ["13abc", "13.9", "1e2"]) {
      const response = await request(
        `/api/v1/touring-index/history?lat=35.6762&lon=139.6503&prefectureId=${prefectureId}`,
      );

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
    }
  });

  test("accepts documented coordinate and prefecture boundaries", () => {
    expect(getWeatherSchema.parse({ lat: "-90", lon: "180" })).toMatchObject({
      lat: -90,
      lon: 180,
    });
    expect(
      getTouringIndexHistorySchema.parse({
        lat: "0",
        lon: "0",
        prefectureId: "1",
      }).prefectureId,
    ).toBe(1);
    expect(
      getTouringIndexHistorySchema.parse({
        lat: "0",
        lon: "0",
        prefectureId: "47",
      }).prefectureId,
    ).toBe(47);
  });

  test("publishes the runtime input limits in OpenAPI", async () => {
    const response = await request("/specification");
    const specification = (await response.json()) as {
      paths: Record<
        string,
        {
          get: {
            parameters: Array<{
              name: string;
              schema: Record<string, unknown>;
            }>;
          };
        }
      >;
    };
    const parameters =
      specification.paths["/api/v1/touring-index/history"].get.parameters;
    const weatherParameters =
      specification.paths["/api/v1/weather"].get.parameters;
    const parameter = (name: string) =>
      parameters.find((item) => item.name === name)?.schema;
    const weatherParameter = (name: string) =>
      weatherParameters.find((item) => item.name === name)?.schema;

    expect(parameter("lat")).toMatchObject({ minLength: 1, maxLength: 32 });
    expect(weatherParameter("datetime")).toMatchObject({
      minLength: 1,
      maxLength: 64,
    });
    expect(parameter("prefectureId")).toMatchObject({
      minLength: 1,
      maxLength: 2,
      pattern: "^(?:[1-9]|[1-3]\\d|4[0-7])$",
    });
  });
});
