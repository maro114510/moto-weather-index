import { describe, expect, test } from "bun:test";
import { HTTP_STATUS } from "../constants/httpStatus";

const { app } = await import("./router");

const testEnv = {};

describe("GET /api/status", () => {
  test("returns 200 with status ok as JSON", async () => {
    const res = await app.request("http://localhost/api/status", {}, testEnv);

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
