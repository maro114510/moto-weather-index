import { scheduledHandler } from "./interface/handlers/scheduledHandler";
import { app } from "./interface/router";

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
