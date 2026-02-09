import { describe, expect, test } from "bun:test";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { corsMiddleware } from "./cors";

function createContext(method: string, origin?: string) {
  return {
    req: {
      method,
      header: (name: string) => (name === "Origin" ? origin : undefined),
    },
    res: new Response(null, { status: 200 }),
    json: (body: unknown, status: number) =>
      new Response(JSON.stringify(body), { status }),
  };
}

describe("corsMiddleware", () => {
  test("sets CORS headers for allowed origins", async () => {
    const c = createContext("GET", "http://localhost:3000");
    const next = async () => {
      c.res = new Response("ok", { status: 200 });
    };

    await corsMiddleware(c as never, next as never);

    expect(c.res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
  });

  test("rejects disallowed origins", async () => {
    const c = createContext("GET", "https://evil.example.com");
    const next = async () => {
      c.res = new Response("ok", { status: 200 });
    };

    const res = await corsMiddleware(c as never, next as never);
    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  test("rejects disallowed preflight", async () => {
    const c = createContext("OPTIONS", "https://evil.example.com");
    const next = async () => {
      c.res = new Response("ok", { status: 200 });
    };

    const res = await corsMiddleware(c as never, next as never);
    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  test("returns preflight headers for allowed origin", async () => {
    const c = createContext("OPTIONS", "http://localhost:3000");
    const next = async () => {
      c.res = new Response("ok", { status: 200 });
    };

    const res = await corsMiddleware(c as never, next as never);
    expect(res.status).toBe(HTTP_STATUS.NO_CONTENT);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:3000",
    );
  });
});
