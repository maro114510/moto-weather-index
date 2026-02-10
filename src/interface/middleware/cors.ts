import type { MiddlewareHandler } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";

const ALLOWED_ORIGINS = [
  "https://moto-weather-index-front.pages.dev",
  "https://moto-weather-index-front.vercel.app",
  "https://moto-weather-index.page.stelzen.dev",
  "http://localhost:3000",
];
const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type";

function appendVaryOrigin(headers: Headers) {
  const existingVary = headers.get("Vary");
  if (!existingVary) {
    headers.set("Vary", "Origin");
    return;
  }

  const varyValues = existingVary
    .split(",")
    .map((value) => value.trim().toLowerCase());

  if (!varyValues.includes("origin")) {
    headers.set("Vary", `${existingVary}, Origin`);
  }
}

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const isAllowedOrigin = origin ? ALLOWED_ORIGINS.includes(origin) : false;

  // Handle preflight requests
  if (c.req.method === "OPTIONS") {
    if (!origin || !isAllowedOrigin) {
      return new Response(null, { status: HTTP_STATUS.FORBIDDEN });
    }

    return new Response(null, {
      status: HTTP_STATUS.NO_CONTENT,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": CORS_METHODS,
        "Access-Control-Allow-Headers": CORS_HEADERS,
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  if (origin && !isAllowedOrigin) {
    return c.json(
      {
        error: "Forbidden",
        message: "Origin not allowed",
      },
      HTTP_STATUS.FORBIDDEN,
    );
  }

  await next();

  // Add CORS headers to all responses
  if (origin && isAllowedOrigin) {
    c.res.headers.set("Access-Control-Allow-Origin", origin);
    c.res.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
    c.res.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
    appendVaryOrigin(c.res.headers);
  }
};
