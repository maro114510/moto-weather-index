import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { healthCheck } from "./handlers/healthHandler";
import {
  getTouringIndex,
  getTouringIndexHistory,
  postTouringIndexBatch,
} from "./handlers/touringIndexHandler";
import { getWeather } from "./handlers/weatherHandler";
import { authMiddleware } from "./middleware/auth";
import { errorHandlingMiddleware } from "./middleware/errorHandling";
import { loggingMiddleware } from "./middleware/logging";
import {
  healthRoute,
  weatherRoute,
  touringIndexRoute,
  touringIndexHistoryRoute,
  touringIndexBatchRoute,
} from "./routes/openapi";

export const app = new OpenAPIHono();

// Apply global middleware
app.use("*", loggingMiddleware);
app.use("*", errorHandlingMiddleware);

// Register OpenAPI routes
app.openapi(healthRoute, healthCheck);
app.openapi(weatherRoute, getWeather);
app.openapi(touringIndexRoute, getTouringIndex);
app.openapi(touringIndexHistoryRoute, getTouringIndexHistory);

// Apply authentication middleware only to batch endpoint
app.use("/api/v1/touring-index/batch", authMiddleware);
app.openapi(touringIndexBatchRoute, postTouringIndexBatch);

// OpenAPI documentation endpoint
app.doc("/specification", {
  openapi: "3.0.0",
  info: {
    title: "Moto Weather Index API",
    version: "1.0.0",
    description: "API for calculating motorcycle touring weather index based on weather conditions",
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
