import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HTTP_STATUS } from "../../constants/httpStatus";
import { authMiddleware } from "./auth";

type MockContext = {
  req: { header: (name: string) => string | undefined };
  env: Record<string, string | undefined>;
  json: (body: unknown, status: number) => Response;
};

async function createHexSignature(secret: string, timestamp: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(timestamp),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function createBase64Signature(secret: string, timestamp: string) {
  const hex = await createHexSignature(secret, timestamp);
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((x) => Number.parseInt(x, 16)) || [],
  );
  return btoa(String.fromCharCode(...bytes));
}

function createContext(
  headers: Record<string, string>,
  env: MockContext["env"],
) {
  return {
    req: {
      header: (name: string) => headers[name],
    },
    env,
    json: (body: unknown, status: number) =>
      new Response(JSON.stringify(body), { status }),
  } as MockContext;
}

describe("authMiddleware", () => {
  let originalNodeEnv: string | undefined;
  let originalSkipAuth: string | undefined;
  let originalBatchSecret: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalSkipAuth = process.env.SKIP_AUTH;
    originalBatchSecret = process.env.BATCH_SECRET;
    delete process.env.SKIP_AUTH;
    delete process.env.BATCH_SECRET;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.SKIP_AUTH = originalSkipAuth;
    process.env.BATCH_SECRET = originalBatchSecret;
  });

  test("returns 401 when auth headers are missing", async () => {
    const c = createContext({}, { BATCH_SECRET: "secret" });
    const next = async () => new Response("ok");

    const res = await authMiddleware(c as never, next as never);
    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  test("returns 403 when timestamp is invalid", async () => {
    const c = createContext(
      { "X-Timestamp": "invalid", "X-Touring-Auth": "signature" },
      { BATCH_SECRET: "secret" },
    );
    const next = async () => new Response("ok");

    const res = await authMiddleware(c as never, next as never);
    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  test("returns 403 when timestamp is expired", async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const signature = await createHexSignature("secret", old);
    const c = createContext(
      { "X-Timestamp": old, "X-Touring-Auth": signature },
      { BATCH_SECRET: "secret" },
    );
    const next = async () => new Response("ok");

    const res = await authMiddleware(c as never, next as never);
    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  test("allows request with valid hex signature", async () => {
    const timestamp = new Date().toISOString();
    const signature = await createHexSignature("secret", timestamp);
    const c = createContext(
      { "X-Timestamp": timestamp, "X-Touring-Auth": signature },
      { BATCH_SECRET: "secret" },
    );
    const next = async () => new Response("ok");

    const res = await authMiddleware(c as never, next as never);
    expect(res.status).toBe(200);
  });

  test("allows request with valid base64 signature", async () => {
    const timestamp = new Date().toISOString();
    const signature = await createBase64Signature("secret", timestamp);
    const c = createContext(
      { "X-Timestamp": timestamp, "X-Touring-Auth": signature },
      { BATCH_SECRET: "secret" },
    );
    const next = async () => new Response("ok");

    const res = await authMiddleware(c as never, next as never);
    expect(res.status).toBe(200);
  });

  test("skips auth only when both NODE_ENV=development and SKIP_AUTH=true", async () => {
    process.env.NODE_ENV = "development";
    process.env.SKIP_AUTH = "true";
    const c = createContext({}, {});
    const next = async () => new Response("ok");

    const res = await authMiddleware(c as never, next as never);
    expect(res.status).toBe(200);
  });
});
