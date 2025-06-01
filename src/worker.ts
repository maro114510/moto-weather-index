import { app } from "./interface/router";
import { scheduledHandler } from "./interface/handlers/scheduledHandler";

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler,
};
