import { describe, expect, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

const { app } = await import("./router");

const testEnv = {
  WEATHERAPI_KEY: "test-key",
  OPEN_METEO_CACHE: {} as KVNamespace,
  DB: {} as D1Database,
};

describe("Not Found handler", () => {
  test("returns 404 JSON with requestId for undefined routes", async () => {
    const res = await app.request(
      "http://localhost/api/v1/nonexistent",
      {},
      testEnv,
    );
    const body = await res.json();

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(body.error).toBe("Not Found");
    expect(body.requestId).toBeString();
  });
});
