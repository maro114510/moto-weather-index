import { describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";
import { HTTP_STATUS } from "../constants/httpStatus";
import type { AppEnv } from "../types/env";
import { errorHandler } from "./errorHandler";

function createTestApp() {
  const app = new Hono<AppEnv>();
  app.use("*", requestId());
  app.onError(errorHandler);
  return app;
}

describe("errorHandler", () => {
  test("maps an unhandled timeout exception to the gateway status", async () => {
    const app = createTestApp();
    app.get("/timeout", () => {
      throw new DOMException("timed out", "TimeoutError");
    });

    const res = await app.request("http://localhost/timeout");
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.GATEWAY_TIMEOUT);
    expect(body).toMatchObject({
      error: "Gateway timeout",
      requestId: expect.any(String),
    });
  });

  test("returns a JSON response with the request ID for a Hono HTTPException", async () => {
    const app = createTestApp();
    app.get("/unauthorized", () => {
      throw new HTTPException(HTTP_STATUS.UNAUTHORIZED, {
        message: "Unauthorized",
      });
    });

    const res = await app.request("http://localhost/unauthorized");
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(body).toEqual({
      error: "Unauthorized",
      requestId: expect.any(String),
    });
  });

  test("returns a sanitized JSON 500 with a request ID for an unknown exception", async () => {
    const app = createTestApp();
    app.get("/boom", () => {
      throw new Error("database connection failed");
    });

    const res = await app.request("http://localhost/boom");
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
    const record = (...args: unknown[]) => {
      emitted.push(args.map(String).join(" "));
    };
    const errorSpy = spyOn(console, "error").mockImplementation(record);
    const warnSpy = spyOn(console, "warn").mockImplementation(record);
    const infoSpy = spyOn(console, "info").mockImplementation(record);
    const app = createTestApp();
    app.get("/boom", () => {
      throw new Error(`database connection failed token=${secret}`);
    });

    try {
      const res = await app.request("http://localhost/boom");
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
