import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

const mockFetch = mock();
const originalFetch = globalThis.fetch;

globalThis.fetch = mockFetch as typeof globalThis.fetch;

const { app } = await import("./router");

const testEnv = {
  WEATHERAPI_KEY: "test-key",
  DB: {} as D1Database,
};

describe("centralized error handling", () => {
  beforeEach(() => {
    process.env.WEATHERAPI_KEY = "test-key";
    globalThis.fetch = mockFetch as typeof globalThis.fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("preserves the status of a controlled application error", async () => {
    const res = await app.request(
      "http://localhost/api/v1/touring-index/history?lat=35.6762&lon=139.6503&startDate=2024-06-01&endDate=2024-05-25",
      {},
      testEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(body).toMatchObject({
      error: "startDate must be before endDate",
      requestId: expect.any(String),
    });
  });

  test("returns a structured 400 response for an OpenAPI validation error", async () => {
    const res = await app.request(
      "http://localhost/api/v1/weather?lon=139.6503",
      {},
      testEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(body).toMatchObject({
      error: "Invalid parameters",
      details: expect.any(Array),
      requestId: expect.any(String),
    });
    expect(body).not.toHaveProperty("success");
  });

  test("returns the gateway status for a network timeout", async () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    mockFetch.mockImplementation(() =>
      Promise.reject(new DOMException("timed out", "TimeoutError")),
    );

    try {
      const res = await app.request(
        "http://localhost/api/v1/weather?lat=35.6762&lon=139.6503&datetime=2026-02-09T00:00:00Z",
        {},
        testEnv,
      );
      const body = await res.json();

      expect(res.status).toBe(HTTP_STATUS.GATEWAY_TIMEOUT);
      expect(body).toMatchObject({
        error: "Weather provider request timed out",
        requestId: expect.any(String),
      });
    } finally {
      Math.random = originalRandom;
    }
  });

  test("returns a sanitized JSON 500 with a request ID for an unknown exception", async () => {
    const res = await app.request(
      "http://localhost/api/v1/prefectures",
      {},
      {
        ...testEnv,
        DB: {
          prepare() {
            throw new Error("database connection failed");
          },
        } as unknown as D1Database,
      },
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(body).toEqual({
      error: "Internal server error",
      message: "An unexpected error occurred",
      requestId: expect.any(String),
    });
  });

  test("keeps sensitive exception content out of the response and emitted logs", async () => {
    const secret = "SUPERSECRET_TOKEN_VALUE";
    const emitted: string[] = [];
    const errorSpy = spyOn(console, "error").mockImplementation((...args) => {
      emitted.push(args.map(String).join(" "));
    });
    const warnSpy = spyOn(console, "warn").mockImplementation((...args) => {
      emitted.push(args.map(String).join(" "));
    });
    const infoSpy = spyOn(console, "info").mockImplementation((...args) => {
      emitted.push(args.map(String).join(" "));
    });

    try {
      const res = await app.request(
        "http://localhost/api/v1/prefectures",
        {},
        {
          ...testEnv,
          DB: {
            prepare() {
              throw new Error(`database connection failed token=${secret}`);
            },
          } as unknown as D1Database,
        },
      );
      const body = await res.json();

      expect(res.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(JSON.stringify(body)).not.toContain(secret);
      expect(emitted.join("\n")).not.toContain(secret);
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });
});
