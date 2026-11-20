import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { HTTP_STATUS } from "../constants/httpStatus";
import type { AppEnv } from "../types/env";
import { errorHandler } from "./errorHandler";
import {
  getHorizon,
  getIndex,
  searchPlaces,
} from "./handlers/internalApiHandler";
import { loggingMiddleware } from "./middleware/logging";

export const app = new Hono<AppEnv>();

// Apply global middleware
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

// Internal endpoint of the single application; reachable without any binding.
app.get("/api/status", (c) => c.json({ status: "ok" }, HTTP_STATUS.OK));

// Internal endpoints the interface calls; they are not a published contract.
app.get("/api/index", getIndex);
app.get("/api/horizon", getHorizon);
app.get("/api/places", searchPlaces);
