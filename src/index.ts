import { serve } from "@hono/node-server";
import {
  getValidatedEnvironment,
  validateEnvironmentOnStartup,
} from "./config/environmentValidation";
import { app } from "./interface/router";
import { logger } from "./utils/logger";

// Validate environment variables on startup
validateEnvironmentOnStartup();

const env = getValidatedEnvironment();
const port = env.PORT;

serve({
  fetch: app.fetch,
  port: port as number,
});

logger.info("Server started", {
  operation: "server_startup",
  port,
  url: `http://localhost:${port}`,
});
