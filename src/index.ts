import "./otel";
import { serve } from "@hono/node-server";
import { app } from "./interface/router";
import { logger } from "./utils/logger";

const port = process.env.PORT || 8000;

serve({
  fetch: app.fetch,
  port: port as number,
});

logger.info("Server started", {
  operation: "server_startup",
  port,
  url: `http://localhost:${port}`,
});
