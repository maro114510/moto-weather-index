import { describe, expect, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

const { app } = await import("./router");

const testEnv = {
  WEATHERAPI_KEY: "test-key",
  DB: {} as D1Database,
};

describe("GET /api/status", () => {
  test("returns 200 with status ok as JSON without touching the database", async () => {
    const res = await app.request("http://localhost/api/status", {}, testEnv);

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
