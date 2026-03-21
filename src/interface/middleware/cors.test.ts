import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { corsMiddleware } from "./cors";

const app = new Hono();
app.use("*", corsMiddleware);
app.get("/test", (c) => c.text("ok"));

describe("corsMiddleware", () => {
  test("sets CORS headers for allowed origin", async () => {
    const res = await app.request("/test", {
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
  });

  test("does not set CORS headers for disallowed origin", async () => {
    const res = await app.request("/test", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("returns preflight response for allowed origin", async () => {
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  test("does not set CORS headers when no Origin header", async () => {
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
