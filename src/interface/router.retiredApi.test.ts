import { describe, expect, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

const { app } = await import("./router");
const worker = (await import("../worker")).default;

const retiredPaths = [
  "/health",
  "/health/ready",
  "/specification",
  "/doc",
  "/api/v1/weather?lat=35.6762&lon=139.6503",
  "/api/v1/touring-index?lat=35.6762&lon=139.6503",
  "/api/v1/touring-index/history?lat=35.6762&lon=139.6503",
  "/api/v1/prefectures",
];

describe("retired public API", () => {
  test.each(retiredPaths)("answers %s with 404 Not Found", async (path) => {
    const res = await app.request(`http://localhost${path}`, {}, {});

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    const body = (await res.json()) as { error: string; requestId: string };
    expect(body.error).toBe("Not Found");
    expect(body.requestId).toBeString();
  });

  test("grants no cross-origin access to the former frontend origin", async () => {
    const res = await app.request(
      "http://localhost/api/status",
      { headers: { Origin: "https://moto-weather-index-front.pages.dev" } },
      {},
    );

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("worker entry", () => {
  test("handles requests and registers no scheduled handler", () => {
    expect(worker.fetch).toBeFunction();
    expect("scheduled" in worker).toBe(false);
  });
});
