import { Hono } from "hono";
import { healthCheck } from "./handlers/healthHandler";
import {
  getTouringIndex,
  getTouringIndexHistory,
  postTouringIndexBatch,
} from "./handlers/touringIndexHandler";
import { getWeather } from "./handlers/weatherHandler";
import { authMiddleware } from "./middleware/auth";
import { loggingMiddleware } from "./middleware/logging";
import { errorHandlingMiddleware } from "./middleware/errorHandling";

export const app = new Hono();

// Apply global middleware
app.use("*", loggingMiddleware);
app.use("*", errorHandlingMiddleware);

// Create API v1 router
const apiV1Router = new Hono();

// Create sub-router for touring-index related endpoints
const touringIndexRouter = new Hono();
touringIndexRouter.get("/", getTouringIndex);
touringIndexRouter.get("/history", getTouringIndexHistory);
// Apply authentication middleware only to batch endpoint
touringIndexRouter.post("/batch", authMiddleware, postTouringIndexBatch);

// Create sub-router for weather related endpoints
const weatherRouter = new Hono();
weatherRouter.get("/", getWeather);

// Mount sub-routers to API v1
apiV1Router.route("/touring-index", touringIndexRouter);
apiV1Router.route("/weather", weatherRouter);

// Mount API v1 router
app.route("/api/v1", apiV1Router);

// Health check endpoint (outside of versioned API)
app.get("/health", healthCheck);
