import type { MiddlewareHandler } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";

const ALLOWED_ORIGINS = [
  "https://moto-weather-index-front.pages.dev",
  "https://moto-weather-index-front.vercel.app",
  "http://localhost:3000",
];
const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header("Origin");
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin || "")
    ? origin
    : ALLOWED_ORIGINS[0];

  // Handle preflight requests
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: HTTP_STATUS.NO_CONTENT,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin || ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Methods": CORS_METHODS,
        "Access-Control-Allow-Headers": CORS_HEADERS,
      },
    });
  }

  await next();

  // Add CORS headers to all responses
  c.res.headers.set(
    "Access-Control-Allow-Origin",
    allowedOrigin || ALLOWED_ORIGINS[0],
  );
  c.res.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  c.res.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
};
