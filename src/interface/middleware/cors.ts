import type { MiddlewareHandler } from "hono";
import { HTTP_STATUS } from "../../constants/httpStatus";

const CORS_ORIGIN = [
  "https://moto-weather-index-front.pages.dev",
  "https://moto-weather-index-front.vercel.app",
  "http://localhost:3000",
].join(", ");
const CORS_METHODS = "GET, POST, OPTIONS";
const CORS_HEADERS = "Content-Type";

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  // Handle preflight requests
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: HTTP_STATUS.NO_CONTENT,
      headers: {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": CORS_METHODS,
        "Access-Control-Allow-Headers": CORS_HEADERS,
      },
    });
  }

  await next();

  // Add CORS headers to all responses
  c.res.headers.set("Access-Control-Allow-Origin", CORS_ORIGIN);
  c.res.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  c.res.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
};
