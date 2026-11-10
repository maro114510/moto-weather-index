import { describe, expect, mock, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

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
});
