import { Hono } from "hono";
import { getTouringIndex, getTouringIndexHistory, postTouringIndexBatch } from "./handlers/touringIndexHandler";
import { getWeather } from "./handlers/weatherHandler";
import { healthCheck } from "./handlers/healthHandler";

export const app = new Hono();

// Create API v1 router
const apiV1Router = new Hono();

// Create sub-router for touring-index related endpoints
const touringIndexRouter = new Hono();
touringIndexRouter.get("/", getTouringIndex);
touringIndexRouter.get("/history", getTouringIndexHistory);
touringIndexRouter.post("/batch", postTouringIndexBatch);

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
