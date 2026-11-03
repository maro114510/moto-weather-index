import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { HTTP_STATUS } from "../constants/httpStatus";
import type { AppEnv } from "../types/env";
import { errorHandler } from "./errorHandler";
import { healthCheck, readinessCheck } from "./handlers/healthHandler";
import { getPrefectures } from "./handlers/prefectureHandler";
import {
  getTouringIndex,
  getTouringIndexHistory,
} from "./handlers/touringIndexHandler";
import { getWeather } from "./handlers/weatherHandler";
import { corsMiddleware } from "./middleware/cors";
import { loggingMiddleware } from "./middleware/logging";
import {
  healthRoute,
  prefectureListRoute,
  readinessRoute,
  touringIndexHistoryRoute,
  touringIndexRoute,
  weatherRoute,
} from "./routes/openapi";

export const app = new OpenAPIHono<AppEnv>();

// Apply global middleware
app.use("*", corsMiddleware);
app.use("*", secureHeaders());
app.use("*", requestId());
app.use("*", loggingMiddleware);

// Register the centralized error handler. Hono's compose() catches handler
// errors and calls app.onError, then resolves the middleware's await next()
// with the error response set on c.res. Therefore loggingMiddleware's post-next
// code runs for BOTH success and error cases, and response logging is handled
// there — not here.
app.onError(errorHandler);

// Not Found handler — returns JSON consistent with onError responses.
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      requestId: c.get("requestId"),
    },
    HTTP_STATUS.NOT_FOUND,
  );
});

// Register OpenAPI routes
app.openapi(healthRoute, healthCheck);
app.openapi(readinessRoute, readinessCheck);
app.openapi(weatherRoute, getWeather);
app.openapi(touringIndexRoute, getTouringIndex);
app.openapi(touringIndexHistoryRoute, getTouringIndexHistory);
app.openapi(prefectureListRoute, getPrefectures);

// OpenAPI documentation endpoint
app.doc("/specification", {
  openapi: "3.0.0",
  info: {
    title: "Moto Weather Index API",
    version: "1.0.0",
    description:
      "API for calculating motorcycle touring weather index based on weather conditions",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
  ],
});

// Swagger UI endpoint
app.get("/doc", swaggerUI({ url: "/specification" }));
